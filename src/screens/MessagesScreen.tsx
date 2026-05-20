import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import type {
  ChatKind,
  ChatTarget,
  ConversationMessageRow,
  ConversationParticipantRow,
  ConversationRow,
} from '../data/messages';
import { formatMessageTime } from '../data/messages';
import { campusAliasForId } from '../data/anonymousAliases';
import { EmptyState, SkeletonBlock } from '../components/Polish';
import { triggerSuccessHaptic } from '../utils/haptics';

const BOARD_ATTACHMENTS_BUCKET = 'board-attachments';

type ConversationPreview = {
  conversationId: string | null;
  partnerId: string;
  kind: ChatKind;
  name: string;
  avatar: string;
  label: string;
  sourcePostId: string | null;
  sourceLabel: string | null;
  sourcePost: SourcePostPreview | null;
  lastMessage: string;
  timestamp: string;
  unread: number;
  sortStamp: number;
};

type SourcePostPreview = {
  id: string;
  title: string;
  category: string | null;
  body: string | null;
  imageUrl: string | null;
  deleted?: boolean;
};

type SourcePostAttachment = {
  type?: string | null;
  url?: string | null;
  path?: string | null;
  mimeType?: string | null;
};

type MessageBubble = {
  id: string;
  content: string;
  timestamp: string;
  createdAt: string;
  isMe: boolean;
  deleted: boolean;
  status: 'sending' | 'sent' | 'failed';
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type Props = {
  onClose: () => void;
  openChatWith?: ChatTarget | null;
  userId: string;
  school: string;
  onOpenSourcePost?: (postId: string) => void;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function conversationLabel(kind: ChatKind) {
  if (kind === 'friend') return 'ClassMate';
  return 'Anonymous board chat';
}

function messageTableMissing(error: any) {
  return error?.code === 'PGRST205' || String(error?.message ?? '').includes('conversation');
}

function truncateText(value: string | null | undefined, maxLength = 96) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function sourcePostImageAttachment(attachments: SourcePostAttachment[] | null | undefined) {
  return (attachments ?? []).find((attachment) => (
    attachment?.type === 'image' ||
    String(attachment?.mimeType ?? '').toLowerCase().startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|heic)$/i.test(String(attachment?.path ?? attachment?.url ?? ''))
  ));
}

async function resolveSourcePostImageUrl(attachment: SourcePostAttachment | null | undefined) {
  if (!attachment) return null;

  if (attachment.path) {
    const { data: signedData, error } = await supabase.storage
      .from(BOARD_ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.path, 60 * 60 * 24 * 7);

    if (!error && signedData?.signedUrl) return signedData.signedUrl;

    const { data: publicData } = supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(attachment.path);
    if (publicData?.publicUrl) return publicData.publicUrl;
  }

  return attachment.url ?? null;
}

function conversationAccent(kind: ChatKind, brand: string) {
  if (kind === 'board_anonymous') return '#111827';
  return brand;
}

function chatIdentityKey(kind: ChatKind, partnerId: string, sourcePostId?: string | null) {
  return kind === 'board_anonymous'
    ? `${kind}:${partnerId}:${sourcePostId ?? 'none'}`
    : `${kind}:${partnerId}`;
}

function conversationIdentityKey(conversation: Pick<ConversationPreview, 'kind' | 'partnerId' | 'sourcePostId'>) {
  return chatIdentityKey(conversation.kind, conversation.partnerId, conversation.sourcePostId);
}

function targetIdentityKey(target: ChatTarget) {
  return chatIdentityKey(target.kind, target.id, target.sourcePostId ?? null);
}

function sameMessageDay(a: MessageBubble | null | undefined, b: MessageBubble | null | undefined) {
  if (!a || !b) return false;
  return new Date(a.createdAt).toDateString() === new Date(b.createdAt).toDateString();
}

function shouldGroupMessages(current: MessageBubble, adjacent: MessageBubble | null | undefined) {
  if (!adjacent || current.isMe !== adjacent.isMe || !sameMessageDay(current, adjacent)) return false;
  const diff = Math.abs(new Date(current.createdAt).getTime() - new Date(adjacent.createdAt).getTime());
  return diff <= 5 * 60 * 1000;
}

function formatMessageDateHeader(isoString: string) {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function SourcePostPreviewImage({
  uri,
  colors,
}: {
  uri: string | null;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          backgroundColor: colors.bgTertiary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="image-outline" size={20} color={colors.textTertiary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      onError={() => setFailed(true)}
      style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.bgTertiary }}
    />
  );
}

const REPORT_REASONS = [
  'Spam',
  'Harassment or hate',
  'Inappropriate content',
  'False information',
  'Scam or unsafe transaction',
  'Other',
];

export default function MessagesScreen({ onClose, openChatWith, userId, school, onOpenSourcePost }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedChat, setSelectedChat] = useState<ConversationPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [editingMessage, setEditingMessage] = useState<MessageBubble | null>(null);
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);
  const blockedPartnerIdsRef = useRef<Set<string>>(new Set());
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const reportBackdropAnim = useRef(new Animated.Value(0)).current;
  const reportSheetAnim = useRef(new Animated.Value(600)).current;
  const selectedChatRef = useRef<ConversationPreview | null>(null);
  const messageListRef = useRef<FlatList<MessageBubble>>(null);
  const messageInputRef = useRef<TextInput>(null);
  const messageScrollTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shouldStickToMessageEndRef = useRef(true);
  const hasValidUserId = !!userId && isUuid(userId);
  const selectedConversationId = selectedChat?.conversationId ?? null;
  const composerBottomPadding = keyboardVisible ? 8 : Math.max(insets.bottom, 8);
  const messageListBottomPadding = keyboardVisible
    ? editingMessage ? 96 : 56
    : editingMessage ? 72 : 22;

  const selectChat = useCallback((conversation: ConversationPreview | null) => {
    selectedChatRef.current = conversation;
    setSelectedChat(conversation);
  }, []);

  const clearPendingMessageScrolls = useCallback(() => {
    messageScrollTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    messageScrollTimeoutsRef.current = [];
  }, []);

  const scrollMessagesToEnd = useCallback((animated = true, delay = 0) => {
    const run = () => {
      InteractionManager.runAfterInteractions(() => {
        messageListRef.current?.scrollToEnd({ animated });
      });
    };
    if (delay > 0) {
      const timeoutId = setTimeout(run, delay);
      messageScrollTimeoutsRef.current.push(timeoutId);
      return;
    }
    requestAnimationFrame(run);
  }, []);

  const settleMessagesAtEnd = useCallback((animated = true, delay = animated ? 80 : 0) => {
    clearPendingMessageScrolls();
    scrollMessagesToEnd(animated, delay);
  }, [clearPendingMessageScrolls, scrollMessagesToEnd]);

  const updateMessageScrollStickiness = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldStickToMessageEndRef.current = distanceFromBottom < 120;
  }, []);

  const mapMessageRow = useCallback((row: ConversationMessageRow): MessageBubble => ({
    id: row.id,
    content: row.deleted_at ? 'Message deleted' : row.content,
    timestamp: formatMessageTime(row.created_at),
    createdAt: row.created_at,
    isMe: row.sender_id === userId,
    deleted: !!row.deleted_at,
    status: 'sent',
  }), [userId]);

  const mergeServerMessage = useCallback((row: ConversationMessageRow) => {
    const mapped = mapMessageRow(row);
    setMessages((current) => {
      if (current.some((message) => message.id === mapped.id)) return current;
      const optimisticIndex = current.findIndex((message) => (
        message.status === 'sending' &&
        message.isMe &&
        message.content === mapped.content
      ));
      if (optimisticIndex >= 0) {
        return current.map((message, index) => (index === optimisticIndex ? mapped : message));
      }
      return [...current, mapped];
    });
  }, [mapMessageRow]);

  const loadSourcePostsById = useCallback(async (sourcePostIds: string[]) => {
    const ids = Array.from(new Set(sourcePostIds.filter(Boolean)));
    if (ids.length === 0) return {};

    const { data, error } = await supabase
      .from('posts')
      .select('id, title, category, body, attachments')
      .eq('school', school)
      .in('id', ids);

    if (error) {
      console.error('Failed to load message source posts:', error);
      return {};
    }

    const entries = await Promise.all(
      ((data ?? []) as Array<SourcePostPreview & { attachments?: SourcePostAttachment[] | null }>).map(async (post) => {
        const imageAttachment = sourcePostImageAttachment(post.attachments);
        const imageUrl = await resolveSourcePostImageUrl(imageAttachment);

        return [post.id, {
          id: post.id,
          title: post.title,
          category: post.category,
          body: post.body,
          imageUrl,
        }] as const;
      })
    );

    return Object.fromEntries(entries);
  }, [school]);

  const resolveProfileNames = useCallback(async (partnerIds: string[]) => {
    const validIds = Array.from(new Set(partnerIds.filter(isUuid)));
    if (validIds.length === 0) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('school', school)
      .in('id', validIds);

    if (error) {
      console.error('Failed to load message profiles:', error);
      return {};
    }

    return Object.fromEntries(
      ((data ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile.name?.trim() || profile.email?.split('@')[0] || campusAliasForId(profile.id, school),
      ])
    );
  }, [school]);

  const buildPreview = useCallback((
    conversation: ConversationRow,
    myParticipant: ConversationParticipantRow,
    participants: ConversationParticipantRow[],
    namesById: Record<string, string>,
    messagesByConversation: Record<string, ConversationMessageRow[]>,
    sourcePostsById: Record<string, SourcePostPreview>
  ): ConversationPreview | null => {
    const threadMessages = messagesByConversation[conversation.id] ?? [];
    const lastMessage = threadMessages[0];
    if (!lastMessage) return null;

    const unread = threadMessages.filter((message) => (
      message.sender_id !== userId &&
      !message.deleted_at &&
      (!myParticipant.last_read_at || new Date(message.created_at) > new Date(myParticipant.last_read_at))
    )).length;
    const isAnonymous = conversation.kind === 'board_anonymous';
    const partner = participants.find((row) => row.conversation_id === conversation.id && row.user_id !== userId);
    if (!partner) return null;

    const name = isAnonymous
      ? partner.alias_snapshot || campusAliasForId(partner.user_id, school)
      : namesById[partner.user_id] || campusAliasForId(partner.user_id, school);
    const sortStamp = new Date(lastMessage.created_at).getTime();
    const sourcePost = isAnonymous && conversation.source_post_id
      ? sourcePostsById[conversation.source_post_id] ?? {
          id: conversation.source_post_id,
          title: 'This post was deleted',
          category: null,
          body: null,
          imageUrl: null,
          deleted: true,
        }
      : null;
    return {
      conversationId: conversation.id,
      partnerId: partner.user_id,
      kind: conversation.kind,
      name,
      avatar: getInitials(name),
      label: conversationLabel(conversation.kind),
      sourcePostId: conversation.source_post_id,
      sourceLabel: sourcePost?.title ?? null,
      sourcePost,
      lastMessage: lastMessage.deleted_at ? 'Message deleted' : lastMessage.content,
      timestamp: formatMessageTime(lastMessage.created_at),
      unread,
      sortStamp,
    };
  }, [school, userId]);

  const fetchConversations = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!hasValidUserId) return;
    if (!options.silent) setLoadingChats(true);

    const { data: myParticipantsData, error: myParticipantsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, display_mode, alias_snapshot, last_read_at')
      .eq('user_id', userId);

    if (myParticipantsError) {
      console.error('Failed to load conversations:', myParticipantsError);
      if (!options.silent) setLoadingChats(false);
      return;
    }

    const myParticipants = (myParticipantsData ?? []) as ConversationParticipantRow[];
    const conversationIds = myParticipants.map((row) => row.conversation_id);
    if (conversationIds.length === 0) {
      setConversations([]);
      if (!options.silent) setLoadingChats(false);
      return;
    }

    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, school, kind, source_post_id, created_at, updated_at')
      .eq('school', school)
      .in('id', conversationIds)
      .in('kind', ['friend', 'board_anonymous']);

    if (conversationsError) {
      console.error('Failed to load message previews:', conversationsError);
      if (!options.silent) setLoadingChats(false);
      return;
    }

    const conversationsRows = (conversationsData ?? []) as ConversationRow[];
    const scopedConversationIds = conversationsRows.map((conversation) => conversation.id);
    if (scopedConversationIds.length === 0) {
      setConversations([]);
      if (!options.silent) setLoadingChats(false);
      return;
    }

    const [
      { data: allParticipantsData, error: participantsError },
      { data: messagesData, error: messagesError },
    ] = await Promise.all([
      supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, display_mode, alias_snapshot, last_read_at')
        .in('conversation_id', scopedConversationIds),
      supabase
        .from('conversation_messages')
        .select('id, conversation_id, sender_id, content, created_at, deleted_at')
        .in('conversation_id', scopedConversationIds)
        .order('created_at', { ascending: false })
        .limit(Math.max(200, scopedConversationIds.length * 20)),
    ]);

    if (participantsError || messagesError) {
      console.error('Failed to load message previews:', participantsError ?? messagesError);
      if (!options.silent) setLoadingChats(false);
      return;
    }

    const scopedConversationIdSet = new Set(scopedConversationIds);
    const participantsRows = (allParticipantsData ?? []) as ConversationParticipantRow[];
    const messageRows = ((messagesData ?? []) as ConversationMessageRow[])
      .filter((message) => scopedConversationIdSet.has(message.conversation_id));
    const sourcePostIds = Array.from(new Set(
      conversationsRows
        .map((conversation) => conversation.source_post_id)
        .filter((id): id is string => !!id)
    ));
    const sourcePostsById = await loadSourcePostsById(sourcePostIds);
    const namesById = await resolveProfileNames(participantsRows.map((row) => row.user_id));
    const myParticipantByConversation = Object.fromEntries(myParticipants.map((row) => [row.conversation_id, row]));
    const messagesByConversation: Record<string, ConversationMessageRow[]> = {};
    messageRows.forEach((message) => {
      messagesByConversation[message.conversation_id] = [
        ...(messagesByConversation[message.conversation_id] ?? []),
        message,
      ];
    });

    const previews = conversationsRows
      .map((conversation) => {
        const myParticipant = myParticipantByConversation[conversation.id];
        if (!myParticipant) return null;
        return buildPreview(
          conversation,
          myParticipant,
          participantsRows,
          namesById,
          messagesByConversation,
          sourcePostsById
        );
      })
      .filter((preview): preview is ConversationPreview => !!preview && !blockedPartnerIdsRef.current.has(preview.partnerId))
      .sort((a, b) => b.sortStamp - a.sortStamp);

    setConversations(previews);
    if (!options.silent) setLoadingChats(false);
  }, [buildPreview, hasValidUserId, loadSourcePostsById, resolveProfileNames, school, userId]);

  const markThreadRead = useCallback(async (conversationId: string) => {
    if (!hasValidUserId) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }, [hasValidUserId, userId]);

  const fetchMessages = useCallback(async (conversation: ConversationPreview, options: { silent?: boolean } = {}) => {
    if (!hasValidUserId || !conversation.conversationId) {
      setMessages([]);
      return;
    }

    if (!options.silent) {
      setLoadingMessages(true);
      setMessages([]);
    }

    const isStillRequestedConversation = () => {
      const currentChat = selectedChatRef.current;
      if (!currentChat) return false;
      if (conversationIdentityKey(currentChat) !== conversationIdentityKey(conversation)) return false;
      return !currentChat.conversationId || currentChat.conversationId === conversation.conversationId;
    };

    const { data: scopedConversation, error: scopedConversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversation.conversationId)
      .eq('school', school)
      .maybeSingle();

    if (!isStillRequestedConversation()) return;

    if (scopedConversationError || !scopedConversation) {
      if (scopedConversationError) console.error('Failed to scope conversation messages:', scopedConversationError);
      setMessages([]);
      if (!options.silent) setLoadingMessages(false);
      return;
    }

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, content, created_at, deleted_at')
      .eq('conversation_id', conversation.conversationId)
      .order('created_at', { ascending: true });

    if (!isStillRequestedConversation()) return;

    if (error) {
      console.error('Failed to load conversation messages:', error);
      if (!options.silent) setLoadingMessages(false);
      return;
    }

    setMessages(((data ?? []) as ConversationMessageRow[]).map(mapMessageRow));

    if (!options.silent) setLoadingMessages(false);
    await markThreadRead(conversation.conversationId);
    setConversations((current) => current.map((chat) => (
      chat.conversationId === conversation.conversationId ? { ...chat, unread: 0 } : chat
    )));
  }, [hasValidUserId, mapMessageRow, markThreadRead, school]);

  const openExistingConversation = useCallback(async (conversation: ConversationPreview) => {
    setEditingMessage(null);
    setMessageInput('');
    setMessages([]);
    shouldStickToMessageEndRef.current = true;
    selectChat(conversation);
    await fetchMessages(conversation);
    await fetchConversations({ silent: true });
  }, [fetchConversations, fetchMessages, selectChat]);

  const findExistingConversationId = useCallback(async (target: ChatTarget) => {
    if (!hasValidUserId) return null;

    const { data: myParticipantsData, error: myParticipantsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (myParticipantsError) throw myParticipantsError;

    const myConversationIds = Array.from(new Set(
      ((myParticipantsData ?? []) as Array<{ conversation_id: string }>).map((row) => row.conversation_id)
    ));
    if (myConversationIds.length === 0) return null;

    const { data: conversationsData, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, school, kind, source_post_id, created_at, updated_at')
      .in('id', myConversationIds)
      .eq('school', school)
      .eq('kind', target.kind)
      .order('updated_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    const candidateConversations = ((conversationsData ?? []) as ConversationRow[]).filter((conversation) => {
      if (target.kind === 'friend') return true;
      return conversation.source_post_id === (target.sourcePostId ?? null);
    });
    if (candidateConversations.length === 0) return null;

    const candidateIds = candidateConversations.map((conversation) => conversation.id);
    const { data: targetParticipantsData, error: targetParticipantsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .in('conversation_id', candidateIds)
      .eq('user_id', target.id);

    if (targetParticipantsError) throw targetParticipantsError;

    const targetConversationIds = new Set(
      ((targetParticipantsData ?? []) as Array<{ conversation_id: string }>).map((row) => row.conversation_id)
    );
    const pairConversations = candidateConversations.filter((conversation) => targetConversationIds.has(conversation.id));
    if (pairConversations.length === 0) return null;

    const { data: messageRows, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('conversation_id, created_at')
      .in('conversation_id', pairConversations.map((conversation) => conversation.id))
      .order('created_at', { ascending: false })
      .limit(200);

    if (messagesError) throw messagesError;

    const conversationsWithMessages = new Set(
      ((messageRows ?? []) as Array<{ conversation_id: string }>).map((row) => row.conversation_id)
    );
    return pairConversations.find((conversation) => conversationsWithMessages.has(conversation.id))?.id ?? null;
  }, [hasValidUserId, school, userId]);

  const openTargetConversation = useCallback(async (target: ChatTarget) => {
    if (!hasValidUserId) {
      Alert.alert('Sign in required', 'Messages are available only for signed-in university accounts.');
      return;
    }

    if (!isUuid(target.id)) {
      Alert.alert('Could not open chat', 'This user cannot be messaged from this older board item.');
      return;
    }

    setOpeningConversation(true);
    const requestKey = targetIdentityKey(target);
    const draftName = target.kind === 'board_anonymous'
      ? campusAliasForId(target.id, school)
      : target.name?.trim() || campusAliasForId(target.id, school);
    const draftSourcePost = target.kind === 'board_anonymous' && target.sourcePostId
      ? {
          id: target.sourcePostId,
          title: target.sourceLabel?.trim() || 'This post was deleted',
          category: null,
          body: null,
          imageUrl: null,
          deleted: !target.sourceLabel?.trim(),
        }
      : null;
    const draftPreview: ConversationPreview = {
      conversationId: target.conversationId ?? null,
      partnerId: target.id,
      kind: target.kind,
      name: draftName,
      avatar: getInitials(draftName),
      label: conversationLabel(target.kind),
      sourcePostId: target.sourcePostId ?? null,
      sourceLabel: draftSourcePost?.title ?? null,
      sourcePost: draftSourcePost,
      lastMessage: 'Start the conversation.',
      timestamp: '',
      unread: 0,
      sortStamp: Date.now(),
    };
    setEditingMessage(null);
    setMessageInput('');
    setMessages([]);
    selectChat(draftPreview);

    try {
      const conversationId = target.conversationId ?? await findExistingConversationId(target);
      if (selectedChatRef.current && conversationIdentityKey(selectedChatRef.current) !== requestKey) return;
      const name = target.kind === 'board_anonymous'
        ? campusAliasForId(target.id, school)
        : target.name?.trim() || campusAliasForId(target.id, school);
      const sourcePostsById = target.kind === 'board_anonymous' && target.sourcePostId
        ? await loadSourcePostsById([target.sourcePostId])
        : {};
      const sourcePost = target.kind === 'board_anonymous' && target.sourcePostId
        ? sourcePostsById[target.sourcePostId] ?? {
            id: target.sourcePostId,
            title: target.sourceLabel?.trim() || 'This post was deleted',
            category: null,
            body: null,
            imageUrl: null,
            deleted: !target.sourceLabel?.trim(),
          }
        : null;
      const preview: ConversationPreview = {
        conversationId,
        partnerId: target.id,
        kind: target.kind,
        name,
        avatar: getInitials(name),
        label: conversationLabel(target.kind),
        sourcePostId: target.sourcePostId ?? null,
        sourceLabel: sourcePost?.title ?? null,
        sourcePost,
        lastMessage: 'Start the conversation.',
        timestamp: '',
        unread: 0,
        sortStamp: Date.now(),
      };

      selectChat(preview);
      if (conversationId) {
        await fetchMessages(preview);
        await fetchConversations({ silent: true });
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      Alert.alert(
        'Could not open chat',
        messageTableMissing(error)
          ? 'The conversation chat SQL is not installed yet. Run supabase/sql/conversation_messages.sql in Supabase first.'
          : error?.message ?? 'Please try again.'
      );
    } finally {
      if (!selectedChatRef.current || conversationIdentityKey(selectedChatRef.current) === requestKey) {
        setOpeningConversation(false);
      }
    }
  }, [fetchConversations, fetchMessages, findExistingConversationId, hasValidUserId, loadSourcePostsById, school, selectChat]);

  useEffect(() => {
    if (!hasValidUserId) return;
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId).then(({ data }) => {
      if (data) blockedPartnerIdsRef.current = new Set(data.map((r: any) => r.blocked_id as string));
    });
  }, [hasValidUserId, userId]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!openChatWith?.id) return;
    void openTargetConversation(openChatWith);
  }, [openChatWith, openTargetConversation]);

  useEffect(() => {
    if (!hasValidUserId) return;
    const interval = setInterval(() => {
      void fetchConversations({ silent: true });
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchConversations, hasValidUserId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const duration = Math.max(event.duration ?? 250, 180);
      setKeyboardVisible(true);
      settleMessagesAtEnd(false, duration + 40);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [settleMessagesAtEnd]);

  useEffect(() => {
    return () => clearPendingMessageScrolls();
  }, [clearPendingMessageScrolls]);

  useEffect(() => {
    if (!selectedChat || messages.length === 0) return;
    settleMessagesAtEnd(true);
  }, [messages.length, selectedChat, settleMessagesAtEnd]);

  useEffect(() => {
    if (!hasValidUserId || !selectedConversationId) return;

    const channel = supabase
      .channel(`conversation-messages:${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const row = payload.new as ConversationMessageRow;
          mergeServerMessage(row);
          void markThreadRead(selectedConversationId);
          void fetchConversations({ silent: true });
          if (row.sender_id === userId || shouldStickToMessageEndRef.current) {
            settleMessagesAtEnd(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const row = payload.new as ConversationMessageRow;
          setMessages((current) => current.map((message) => (
            message.id === row.id ? mapMessageRow(row) : message
          )));
          void fetchConversations({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchConversations, hasValidUserId, mapMessageRow, markThreadRead, mergeServerMessage, selectedConversationId, settleMessagesAtEnd, userId]);

  const cancelMessageEdit = useCallback(() => {
    setEditingMessage(null);
    setMessageInput('');
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const handleDeleteMessage = useCallback(async (message: MessageBubble) => {
    if (!selectedConversationId || !message.isMe || message.deleted) return;

    Alert.alert(
      'Delete message?',
      'This will remove the message from this conversation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const deletedAt = new Date().toISOString();
            setMessages((current) => current.map((item) => (
              item.id === message.id
                ? { ...item, content: 'Message deleted', deleted: true }
                : item
            )));
            if (editingMessage?.id === message.id) cancelMessageEdit();

            const { data, error } = await supabase
              .from('conversation_messages')
              .update({ deleted_at: deletedAt })
              .eq('id', message.id)
              .eq('sender_id', userId)
              .select('id, conversation_id, sender_id, content, created_at, deleted_at')
              .single();

            if (error) {
              Alert.alert('Could not delete message', error.message);
              void fetchMessages(selectedChat as ConversationPreview, { silent: true });
              return;
            }

            if (data) {
              const row = data as ConversationMessageRow;
              setMessages((current) => current.map((item) => (
                item.id === row.id ? mapMessageRow(row) : item
              )));
            }
            void fetchConversations({ silent: true });
          },
        },
      ]
    );
  }, [
    cancelMessageEdit,
    editingMessage?.id,
    fetchConversations,
    fetchMessages,
    mapMessageRow,
    selectedChat,
    selectedConversationId,
    userId,
  ]);

  const beginEditMessage = useCallback((message: MessageBubble) => {
    if (!message.isMe || message.deleted || message.status !== 'sent') return;
    setEditingMessage(message);
    setMessageInput(message.content);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const retryFailedMessage = useCallback((message: MessageBubble) => {
    if (message.status !== 'failed') return;
    setMessages((current) => current.filter((item) => item.id !== message.id));
    setMessageInput(message.content);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const openMessageActions = useCallback((message: MessageBubble) => {
    if (!message.isMe || message.deleted) return;

    if (message.status === 'failed') {
      Alert.alert(
        'Message not sent',
        undefined,
        [
          { text: 'Try Again', onPress: () => retryFailedMessage(message) },
          { text: 'Remove', style: 'destructive', onPress: () => setMessages((current) => current.filter((item) => item.id !== message.id)) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (message.status !== 'sent') return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Edit Message', 'Delete Message', 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
          userInterfaceStyle: 'light',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) beginEditMessage(message);
          if (buttonIndex === 1) void handleDeleteMessage(message);
        }
      );
      return;
    }

    Alert.alert(
      'Message options',
      undefined,
      [
        { text: 'Edit Message', onPress: () => beginEditMessage(message) },
        { text: 'Delete Message', style: 'destructive', onPress: () => void handleDeleteMessage(message) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [beginEditMessage, handleDeleteMessage, retryFailedMessage]);

  function openConversationMenu() {
    if (!selectedChat) return;
    const isAnonymous = selectedChat.kind === 'board_anonymous';
    const name = selectedChat.name;
    const blockMessage = isAnonymous
      ? "Block this anonymous user? You won't see their messages."
      : `Block ${name}? They will be removed from your ClassMates and won't be able to contact you.`;

    const doBlock = async () => {
      if (!selectedChat) return;
      const partnerId = selectedChat.partnerId;
      const source = isAnonymous ? 'board' : 'friend';
      setBlockingUser(true);
      await supabase.from('blocks').upsert(
        { blocker_id: userId, blocked_id: partnerId, source },
        { onConflict: 'blocker_id,blocked_id' }
      );
      if (!isAnonymous) {
        await Promise.all([
          supabase.from('friend_requests').delete().eq('sender_id', userId).eq('receiver_id', partnerId),
          supabase.from('friend_requests').delete().eq('sender_id', partnerId).eq('receiver_id', userId),
        ]);
      }
      blockedPartnerIdsRef.current = new Set([...blockedPartnerIdsRef.current, partnerId]);
      setBlockingUser(false);
      selectChat(null);
      setMessages([]);
      setMessageInput('');
      setEditingMessage(null);
      setConversations((prev) => prev.filter((c) => c.partnerId !== partnerId));
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Report', 'Block'], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        (index) => {
          if (index === 1) {
            setTimeout(() => openReportModal(), 350);
          } else if (index === 2) {
            Alert.alert('Block User', blockMessage, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => void doBlock() },
            ]);
          }
        }
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Report', onPress: () => openReportModal() },
        { text: 'Block', style: 'destructive', onPress: () => Alert.alert('Block User', blockMessage, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: () => void doBlock() },
        ]) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  function openReportModal() {
    setReportReason(REPORT_REASONS[0]);
    setReportDetails('');
    reportBackdropAnim.setValue(0);
    reportSheetAnim.setValue(600);
    setShowReportModal(true);
    Animated.parallel([
      Animated.spring(reportSheetAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }),
      Animated.timing(reportBackdropAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function closeReportModal() {
    Animated.parallel([
      Animated.timing(reportSheetAnim, { toValue: 600, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(reportBackdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setShowReportModal(false));
  }

  async function submitMessageReport() {
    if (!selectedChat || submittingReport) return;
    Keyboard.dismiss();
    setSubmittingReport(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId,
      school,
      target_type: 'message',
      target_id: selectedChat.conversationId,
      reason: reportReason,
      details: reportDetails.trim() || null,
      status: 'pending',
    });
    setSubmittingReport(false);
    if (error) {
      Alert.alert('Could not send report', error.message);
      return;
    }
    closeReportModal();
    setReportDetails('');
    Alert.alert('Report sent', 'Thanks. We will review this report soon.');
  }

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat || sending || !hasValidUserId) return;
    const content = messageInput.trim();
    setSending(true);
    messageInputRef.current?.focus();

    if (editingMessage) {
      const messageToEdit = editingMessage;
      const previousInput = messageInput;
      setEditingMessage(null);
      setMessageInput('');

      const { data, error } = await supabase
        .from('conversation_messages')
        .update({ content })
        .eq('id', messageToEdit.id)
        .eq('sender_id', userId)
        .is('deleted_at', null)
        .select('id, conversation_id, sender_id, content, created_at, deleted_at')
        .single();

      setSending(false);
      requestAnimationFrame(() => messageInputRef.current?.focus());

      if (error) {
        setEditingMessage(messageToEdit);
        setMessageInput(previousInput);
        Alert.alert('Could not edit message', error.message);
        return;
      }

      if (data) {
        const row = data as ConversationMessageRow;
        setMessages((current) => current.map((item) => (
          item.id === row.id ? mapMessageRow(row) : item
        )));
      }
      triggerSuccessHaptic();
      void fetchConversations({ silent: true });
      settleMessagesAtEnd(true);
      return;
    }

    const optimisticId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticCreatedAt = new Date().toISOString();
    const optimisticMessage: MessageBubble = {
      id: optimisticId,
      content,
      timestamp: formatMessageTime(optimisticCreatedAt),
      createdAt: optimisticCreatedAt,
      isMe: true,
      deleted: false,
      status: 'sending',
    };
    setMessageInput('');
    setMessages((current) => [...current, optimisticMessage]);
    shouldStickToMessageEndRef.current = true;
    settleMessagesAtEnd(true);

    let conversationId = selectedChat.conversationId;
    if (!conversationId) {
      let conversationData: string | null = null;
      let conversationError: any = null;

      const result = await supabase.rpc('get_or_create_conversation', {
        p_target_user_id: selectedChat.partnerId,
        p_conversation_kind: selectedChat.kind,
        p_source_post_id: selectedChat.sourcePostId ?? null,
        p_conversation_school: school,
      });
      conversationData = result.data as string | null;
      conversationError = result.error;

      if (conversationError) {
        setSending(false);
        requestAnimationFrame(() => messageInputRef.current?.focus());
        setMessages((current) => current.map((message) => (
          message.id === optimisticId ? { ...message, status: 'failed' } : message
        )));
        Alert.alert(
          'Could not start chat',
          messageTableMissing(conversationError)
            ? 'The conversation chat SQL is not installed yet. Run supabase/sql/conversation_messages.sql in Supabase first.'
            : conversationError.message ?? 'Please try again.'
        );
        return;
      }

      conversationId = conversationData;
      if (!conversationId) {
        setSending(false);
        requestAnimationFrame(() => messageInputRef.current?.focus());
        setMessages((current) => current.map((message) => (
          message.id === optimisticId ? { ...message, status: 'failed' } : message
        )));
        Alert.alert('Could not start chat', 'Please try again.');
        return;
      }
      setSelectedChat((current) => (
        (() => {
          const next = current && conversationIdentityKey(current) === conversationIdentityKey(selectedChat)
            ? { ...current, conversationId }
            : current;
          selectedChatRef.current = next;
          return next;
        })()
      ));
    }

    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
      })
      .select('id, conversation_id, sender_id, content, created_at, deleted_at')
      .single();

    if (error) {
      setSending(false);
      requestAnimationFrame(() => messageInputRef.current?.focus());
      setMessages((current) => current.map((message) => (
        message.id === optimisticId ? { ...message, status: 'failed' } : message
      )));
      Alert.alert(
        'Could not send message',
        messageTableMissing(error)
          ? 'The conversation chat SQL is not installed yet. Run supabase/sql/conversation_messages.sql in Supabase first.'
          : error.message
      );
      return;
    }

    setSending(false);
    requestAnimationFrame(() => messageInputRef.current?.focus());
    if (data) {
      const row = data as ConversationMessageRow;
      setMessages((current) => current.map((message) => (
        message.id === optimisticId ? mapMessageRow(row) : message
      )));
    }
    triggerSuccessHaptic();
    settleMessagesAtEnd(true);
    await fetchConversations({ silent: true });
  };

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((chat) => (
      chat.name.toLowerCase().includes(query) ||
      chat.label.toLowerCase().includes(query) ||
      (chat.sourcePost?.title ?? '').toLowerCase().includes(query) ||
      (chat.sourcePost?.category ?? '').toLowerCase().includes(query) ||
      (chat.sourcePost?.body ?? '').toLowerCase().includes(query) ||
      chat.lastMessage.toLowerCase().includes(query)
    ));
  }, [conversations, searchQuery]);

  if (!hasValidUserId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: 18, paddingTop: insets.top + 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>Messages</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Ionicons name="chatbubbles-outline" size={60} color={colors.border} />
          <Text style={{ marginTop: 14, fontSize: 16, fontWeight: '700', color: colors.text }}>Sign in required</Text>
          <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.textTertiary, textAlign: 'center' }}>
            Messages are available only for signed-in university accounts.
          </Text>
        </View>
      </View>
    );
  }

  if (selectedChat) {
    const selectedSourcePost = selectedChat.kind === 'board_anonymous' ? selectedChat.sourcePost : null;

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            backgroundColor: colors.card,
            gap: 10,
          }}>
            <TouchableOpacity
              onPress={() => {
                selectChat(null);
                setMessages([]);
                setLoadingMessages(false);
                setOpeningConversation(false);
                setMessageInput('');
                setEditingMessage(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: conversationAccent(selectedChat.kind, colors.brand),
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>{selectedChat.avatar}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{selectedChat.name}</Text>
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2, fontWeight: '700' }}>
                {selectedChat.label}
              </Text>
            </View>
            <TouchableOpacity
              onPress={openConversationMenu}
              disabled={blockingUser}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {blockingUser
                ? <ActivityIndicator size="small" color={colors.textSecondary} />
                : <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          {selectedSourcePost ? (
            <TouchableOpacity
              activeOpacity={selectedSourcePost.deleted ? 1 : 0.82}
              disabled={selectedSourcePost.deleted || !onOpenSourcePost}
              onPress={() => {
                if (!selectedSourcePost.deleted) onOpenSourcePost?.(selectedSourcePost.id);
              }}
              style={{
                marginHorizontal: 16,
                marginTop: 10,
                marginBottom: 0,
                borderRadius: 12,
                padding: 9,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                flexDirection: 'row',
                gap: 10,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              {selectedSourcePost.imageUrl ? (
                <SourcePostPreviewImage uri={selectedSourcePost.imageUrl} colors={colors} />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: colors.bgTertiary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={selectedSourcePost.deleted ? 'trash-outline' : 'document-text-outline'}
                    size={22}
                    color={colors.textTertiary}
                  />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                  {selectedSourcePost.title}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.textSecondary }}>
                  {selectedSourcePost.deleted
                    ? 'The original board post is no longer available.'
                    : truncateText(selectedSourcePost.body, 88) || selectedSourcePost.category || 'Board post'}
                </Text>
              </View>
              {!selectedSourcePost.deleted ? (
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} style={{ alignSelf: 'center' }} />
              ) : null}
            </TouchableOpacity>
          ) : null}

          {(openingConversation || loadingMessages) && messages.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>
                {openingConversation ? 'Opening conversation...' : 'Loading messages...'}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={messageListRef}
              style={{ flex: 1 }}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={[
                { paddingHorizontal: 16, paddingTop: 16, paddingBottom: messageListBottomPadding, gap: 10 },
                messages.length === 0 ? { flexGrow: 1 } : null,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              bounces
              alwaysBounceVertical
              overScrollMode="always"
              onLayout={() => {
                if (messages.length > 0) settleMessagesAtEnd(false);
              }}
              onContentSizeChange={() => {
                if (messages.length > 0 && shouldStickToMessageEndRef.current) settleMessagesAtEnd(false);
              }}
              onScroll={updateMessageScrollStickiness}
              scrollEventThrottle={16}
              ListEmptyComponent={() => (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                  <Text style={{ fontSize: 14, color: colors.textTertiary }}>Start the conversation.</Text>
                </View>
              )}
              renderItem={({ item: msg, index }) => {
                const previous = messages[index - 1];
                const next = messages[index + 1];
                const showDateHeader = !previous || !sameMessageDay(previous, msg);
                const groupedWithPrevious = shouldGroupMessages(msg, previous);
                const groupedWithNext = shouldGroupMessages(msg, next);
                const showMeta = !groupedWithNext || msg.status !== 'sent';
                const statusLabel = msg.status === 'sending'
                  ? 'Sending...'
                  : msg.status === 'failed'
                    ? 'Not sent'
                    : msg.timestamp;

                return (
                  <View style={{ gap: showDateHeader ? 10 : 0, marginTop: groupedWithPrevious ? -4 : 0 }}>
                    {showDateHeader ? (
                      <View style={{ alignItems: 'center', marginVertical: 4 }}>
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.bgTertiary }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
                            {formatMessageDateHeader(msg.createdAt)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    <View style={{ flexDirection: 'row', justifyContent: msg.isMe ? 'flex-end' : 'flex-start' }}>
                      <TouchableOpacity
                        activeOpacity={msg.isMe && !msg.deleted ? 0.78 : 1}
                        onLongPress={() => openMessageActions(msg)}
                        delayLongPress={260}
                        style={{
                          maxWidth: '78%',
                          backgroundColor: msg.isMe
                            ? msg.status === 'failed' ? colors.destructive : colors.brand
                            : colors.bgTertiary,
                          borderRadius: 18,
                          borderTopRightRadius: msg.isMe && groupedWithPrevious ? 7 : 18,
                          borderBottomRightRadius: msg.isMe && groupedWithNext ? 7 : msg.isMe ? 6 : 18,
                          borderTopLeftRadius: !msg.isMe && groupedWithPrevious ? 7 : 18,
                          borderBottomLeftRadius: !msg.isMe && groupedWithNext ? 7 : !msg.isMe ? 6 : 18,
                          paddingHorizontal: 13,
                          paddingVertical: 9,
                          opacity: msg.deleted ? 0.68 : msg.status === 'sending' ? 0.78 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: msg.isMe ? 'white' : colors.text, lineHeight: 19 }}>
                          {msg.content}
                        </Text>
                        {showMeta ? (
                          <Text style={{
                            fontSize: 10,
                            color: msg.isMe ? 'rgba(255,255,255,0.72)' : colors.textTertiary,
                            marginTop: 3,
                            fontWeight: msg.status === 'failed' ? '800' : '500',
                          }}>
                            {statusLabel}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 12,
            paddingTop: 9,
            paddingBottom: composerBottomPadding,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
            backgroundColor: colors.card,
            gap: 8,
          }}>
            {editingMessage ? (
              <View
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: 58 + composerBottomPadding,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: colors.brandBg,
                  borderWidth: 1,
                  borderColor: `${colors.brand}30`,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="create-outline" size={15} color={colors.brand} />
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: '700', color: colors.brand }}>
                  Editing message
                </Text>
                <TouchableOpacity onPress={cancelMessageEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={17} color={colors.brand} />
                </TouchableOpacity>
              </View>
            ) : null}
            <TextInput
              ref={messageInputRef}
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
              placeholderTextColor={colors.placeholder}
              multiline
              blurOnSubmit={false}
              maxLength={2000}
              onBlur={() => {
                setKeyboardVisible(false);
              }}
              onFocus={() => {
                setKeyboardVisible(true);
                settleMessagesAtEnd(true);
              }}
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 104,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                lineHeight: 19,
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPressIn={() => messageInputRef.current?.focus()}
              onPress={() => {
                void handleSend();
              }}
              disabled={!messageInput.trim() || sending}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: messageInput.trim() ? colors.brand : colors.border,
                alignItems: 'center', justifyContent: 'center',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={editingMessage ? 19 : 16} color="white" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={showReportModal} transparent animationType="none" onRequestClose={closeReportModal}>
          <Animated.View style={{
            flex: 1, justifyContent: 'flex-end',
            backgroundColor: reportBackdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] }),
          }}>
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={closeReportModal} />
            <Animated.View style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              transform: [{ translateY: reportSheetAnim }],
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Report</Text>
                <TouchableOpacity onPress={closeReportModal}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 16 }}>
                Tell us what is wrong with this conversation and we will review it.
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Reason</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {REPORT_REASONS.map((option) => {
                  const active = reportReason === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setReportReason(option)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1,
                        borderColor: active ? colors.brand : colors.border,
                        backgroundColor: active ? colors.brandBg : colors.bgTertiary,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: active ? colors.brand : colors.textSecondary, fontWeight: '600' }}>{option}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Details</Text>
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Optional: add more context"
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  backgroundColor: colors.inputBg, borderRadius: 14,
                  paddingHorizontal: 14, paddingVertical: 12,
                  minHeight: 110, textAlignVertical: 'top',
                  fontSize: 14, color: colors.text, marginBottom: 18,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={closeReportModal}
                  style={{ flex: 1, backgroundColor: colors.bgTertiary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void submitMessageReport()}
                  disabled={submittingReport}
                  style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: submittingReport ? 0.72 : 1 }}
                >
                  {submittingReport
                    ? <ActivityIndicator color="white" />
                    : <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>Send Report</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingHorizontal: 18,
        paddingTop: insets.top + 10,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>Messages</Text>
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        }}>
          <Ionicons name="search-outline" size={16} color={colors.placeholder} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search messages..."
            placeholderTextColor={colors.placeholder}
            style={{ flex: 1, fontSize: 14, color: colors.text }}
          />
        </View>
      </View>

      {loadingChats ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 12 }}>
          {[0, 1, 2, 3].map((index) => (
            <View key={`message-skeleton-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SkeletonBlock width={48} height={48} radius={24} />
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <SkeletonBlock height={14} radius={7} width={index % 2 === 0 ? '72%' : '58%'} />
                <SkeletonBlock height={12} radius={6} width={index % 2 === 0 ? '90%' : '76%'} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(c) => c.conversationId ?? `draft-${c.kind}-${c.partnerId}`}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={() => (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No messages yet"
              body="Friend chats use real names. Board chats stay anonymous."
            />
          )}
          renderItem={({ item: chat }) => (
            <TouchableOpacity
              onPress={() => { void openExistingConversation(chat); }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 14,
                gap: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
              }}
            >
              <View style={{ position: 'relative' }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: conversationAccent(chat.kind, colors.brand),
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{chat.avatar}</Text>
                </View>
                {chat.unread > 0 && (
                  <View style={{
                    position: 'absolute', top: -2, right: -2,
                    minWidth: 18, height: 18, borderRadius: 9,
                    paddingHorizontal: chat.unread > 9 ? 4 : 0,
                    backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{chat.unread}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 8 }}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', color: colors.text }}>{chat.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{chat.timestamp}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <View style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: conversationAccent(chat.kind, colors.brand),
                  }} />
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>{chat.label}</Text>
                </View>
                {chat.kind === 'board_anonymous' && chat.sourcePost ? (
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 3 }} numberOfLines={1} ellipsizeMode="tail">
                    From: {chat.sourcePost.title}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1} ellipsizeMode="tail">{chat.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

    </View>
  );
}
