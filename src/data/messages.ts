export type ChatTarget = {
  id: string;
  name: string;
};

export type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
};

export type ConversationParticipantRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ConversationListRow = {
  conversation_id: string;
  partner_id: string;
  partner_name: string | null;
  partner_email: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  updated_at: string;
  unread_count: number | null;
};

export function formatMessageTime(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
