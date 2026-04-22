type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, any> | null;
  old_record?: Record<string, any> | null;
};

type NotificationSettings = {
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  friendRequests?: boolean;
  comments?: boolean;
  likes?: boolean;
  messages?: boolean;
};

type Recipient = {
  userId: string;
  email: string | null;
  pushToken: string | null;
  settings: NotificationSettings;
};

type UserSettingsRow = {
  user_id: string;
  expo_push_token: string | null;
  notification_settings: NotificationSettings | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
};

type PostRow = {
  id: string;
  user_id: string;
  title: string | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  post_id: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const FROM_EMAIL = Deno.env.get('NOTIFICATIONS_FROM_EMAIL') ?? 'ClassMate <notifications@classmate.app>';

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fetchRows<T>(path: string): Promise<T[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: supabaseHeaders,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase query failed for ${path}: ${errorText}`);
  }
  return (await response.json()) as T[];
}

async function updateRow(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase update failed for ${path}: ${errorText}`);
  }
}

async function fetchRecipient(userId: string): Promise<Recipient | null> {
  const [settings] = await fetchRows<UserSettingsRow>(
    `user_settings?user_id=eq.${userId}&select=user_id,expo_push_token,notification_settings&limit=1`
  );
  const [profile] = await fetchRows<ProfileRow>(
    `profiles?id=eq.${userId}&select=id,email&limit=1`
  );

  if (!profile) return null;

  return {
    userId,
    email: profile.email,
    pushToken: settings?.expo_push_token ?? null,
    settings: settings?.notification_settings ?? {},
  };
}

async function sendPush(recipient: Recipient, title: string, body: string, data: Record<string, unknown>) {
  if (!recipient.pushToken || recipient.settings.pushNotifications !== true) return;

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      to: recipient.pushToken,
      title,
      body,
      data,
      sound: 'default',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Expo push failed:', errorText);
    return;
  }

  const result = await response.json();
  const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
  if (ticket?.details?.error === 'DeviceNotRegistered') {
    await updateRow(`user_settings?user_id=eq.${recipient.userId}`, { expo_push_token: null });
  }
}

async function sendEmail(recipient: Recipient, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  if (!recipient.email || recipient.settings.emailNotifications !== true) return;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: recipient.email,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend email failed:', errorText);
  }
}

async function notifyRecipient(
  userId: string,
  preferenceKey: keyof NotificationSettings,
  title: string,
  body: string,
  emailSubject: string,
  emailHtml: string,
  data: Record<string, unknown>
) {
  const recipient = await fetchRecipient(userId);
  if (!recipient) return;
  if (recipient.settings[preferenceKey] !== true) return;

  await Promise.all([
    sendPush(recipient, title, body, data),
    sendEmail(recipient, emailSubject, emailHtml),
  ]);
}

async function handleFriendRequest(record: Record<string, any>) {
  if (record.status !== 'pending') return;
  await notifyRecipient(
    record.receiver_id,
    'friendRequests',
    'New friend request',
    'Someone wants to connect with you on ClassMate.',
    'New friend request on ClassMate',
    '<p>You have a new friend request waiting in ClassMate.</p>',
    { type: 'friend-request', requestId: record.id }
  );
}

async function handleDirectMessage(record: Record<string, any>) {
  const content = typeof record.content === 'string' && record.content.trim()
    ? record.content.trim().slice(0, 120)
    : 'Open ClassMate to read it.';
  await notifyRecipient(
    record.receiver_id,
    'messages',
    'New message',
    content,
    'New direct message on ClassMate',
    `<p>You received a new direct message in ClassMate.</p><p>${content}</p>`,
    { type: 'direct-message', messageId: record.id, senderId: record.sender_id }
  );
}

async function handlePostComment(record: Record<string, any>) {
  const [post] = await fetchRows<PostRow>(
    `posts?id=eq.${record.post_id}&select=id,user_id,title&limit=1`
  );

  const targets = new Map<string, { title: string; body: string; subject: string; html: string; data: Record<string, unknown> }>();
  const postTitle = post?.title?.trim() || 'your post';

  if (post?.user_id && post.user_id !== record.user_id) {
    targets.set(post.user_id, {
      title: 'New comment on your post',
      body: `Someone commented on ${postTitle}.`,
      subject: 'New comment on your ClassMate post',
      html: `<p>Someone commented on your post, <strong>${postTitle}</strong>.</p>`,
      data: { type: 'post-comment', postId: record.post_id, commentId: record.id },
    });
  }

  if (record.parent_comment_id) {
    const [parentComment] = await fetchRows<Pick<CommentRow, 'id' | 'user_id'>>(
      `post_comments?id=eq.${record.parent_comment_id}&select=id,user_id&limit=1`
    );
    if (parentComment?.user_id && parentComment.user_id !== record.user_id) {
      targets.set(parentComment.user_id, {
        title: 'New reply to your comment',
        body: `Someone replied on ${postTitle}.`,
        subject: 'New reply to your ClassMate comment',
        html: `<p>Someone replied to one of your comments on <strong>${postTitle}</strong>.</p>`,
        data: { type: 'comment-reply', postId: record.post_id, commentId: record.id, parentCommentId: record.parent_comment_id },
      });
    }
  }

  await Promise.all(
    Array.from(targets.entries()).map(([targetUserId, content]) =>
      notifyRecipient(
        targetUserId,
        'comments',
        content.title,
        content.body,
        content.subject,
        content.html,
        content.data
      )
    )
  );
}

async function handlePostLike(record: Record<string, any>) {
  const [post] = await fetchRows<PostRow>(
    `posts?id=eq.${record.post_id}&select=id,user_id,title&limit=1`
  );
  if (!post?.user_id || post.user_id === record.user_id) return;
  const postTitle = post.title?.trim() || 'your post';
  await notifyRecipient(
    post.user_id,
    'likes',
    'New like on your post',
    `Someone liked ${postTitle}.`,
    'New like on your ClassMate post',
    `<p>Someone liked your post, <strong>${postTitle}</strong>.</p>`,
    { type: 'post-like', postId: record.post_id, actorId: record.user_id }
  );
}

async function handleCommentLike(record: Record<string, any>) {
  const [comment] = await fetchRows<CommentRow>(
    `post_comments?id=eq.${record.comment_id}&select=id,user_id,post_id&limit=1`
  );
  if (!comment?.user_id || comment.user_id === record.user_id) return;
  await notifyRecipient(
    comment.user_id,
    'likes',
    'New like on your comment',
    'Someone liked one of your board comments.',
    'New like on your ClassMate comment',
    '<p>Someone liked one of your comments in ClassMate.</p>',
    { type: 'comment-like', commentId: record.comment_id, actorId: record.user_id, postId: comment.post_id }
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    const record = payload.record ?? null;
    const table = payload.table ?? '';
    const eventType = payload.type ?? '';

    if (!record || eventType !== 'INSERT') {
      return jsonResponse({ ok: true, skipped: 'No insert record to process' });
    }

    switch (table) {
      case 'friend_requests':
        await handleFriendRequest(record);
        break;
      case 'direct_messages':
        await handleDirectMessage(record);
        break;
      case 'post_comments':
        await handlePostComment(record);
        break;
      case 'post_votes':
        await handlePostLike(record);
        break;
      case 'post_comment_votes':
        await handleCommentLike(record);
        break;
      default:
        return jsonResponse({ ok: true, skipped: `Unsupported table: ${table}` });
    }

    return jsonResponse({ ok: true, table, eventType });
  } catch (error) {
    console.error('social-notifier failed:', error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
