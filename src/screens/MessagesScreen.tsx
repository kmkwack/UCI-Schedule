import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
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
import { anteaterAliasForId } from '../data/anonymousAliases';

type ConversationPreview = {
  conversationId: string;
  partnerId: string;
  kind: ChatKind;
  name: string;
  avatar: string;
  label: string;
  sourcePostId: string | null;
  sourceLabel: string | null;
  lastMessage: string;
  timestamp: string;
  unread: number;
  sortStamp: number;
};

type MessageBubble = {
  id: string;
  content: string;
  timestamp: string;
  isMe: boolean;
  deleted: boolean;
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
  return kind === 'friend' ? 'ClassMate' : 'Anonymous board chat';
}

function messageTableMissing(error: any) {
  return error?.code === 'PGRST205' || String(error?.message ?? '').includes('conversation');
}

export default function MessagesScreen({ onClose, openChatWith, userId, school }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedChat, setSelectedChat] = useState<ConversationPreview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const hasValidUserId = !!userId && isUuid(userId);

  const resolveProfileNames = useCallback(async (partnerIds: string[]) => {
    const validIds = Array.from(new Set(partnerIds.filter(isUuid)));
    if (validIds.length === 0) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', validIds);

    if (error) {
      console.error('Failed to load message profiles:', error);
      return {};
    }

    return Object.fromEntries(
      ((data ?? []) as ProfileRow[]).map((profile) => [
        profile.id,
        profile.name?.trim() || profile.email?.split('@')[0] || anteaterAliasForId(profile.id),
      ])
    );
  }, []);

  const buildPreview = useCallback((
    conversation: ConversationRow,
    myParticipant: ConversationParticipantRow,
    participants: ConversationParticipantRow[],
    namesById: Record<string, string>,
    messagesByConversation: Record<string, ConversationMessageRow[]>
  ): ConversationPreview | null => {
    const partner = participants.find((row) => row.conversation_id === conversation.id && row.user_id !== userId);
    if (!partner) return null;

    const threadMessages = messagesByConversation[conversation.id] ?? [];
    const lastMessage = threadMessages[0];
    const unread = threadMessages.filter((message) => (
      message.sender_id !== userId &&
      !message.deleted_at &&
      (!myParticipant.last_read_at || new Date(message.created_at) > new Date(myParticipant.last_read_at))
    )).length;
    const isAnonymous = conversation.kind === 'board_anonymous';
    const name = isAnonymous
      ? partner.alias_snapshot || anteaterAliasForId(partner.user_id)
      : namesById[partner.user_id] || anteaterAliasForId(partner.user_id);
    const sortStamp = new Date(lastMessage?.created_at ?? conversation.updated_at ?? conversation.created_at).getTime();

    return {
      conversationId: conversation.id,
      partnerId: partner.user_id,
      kind: conversation.kind,
      name,
      avatar: getInitials(name),
      label: conversationLabel(conversation.kind),
      sourcePostId: conversation.source_post_id,
      sourceLabel: isAnonymous && conversation.source_post_id ? 'From Board' : null,
      lastMessage: lastMessage?.deleted_at ? 'Message deleted' : lastMessage?.content || 'Start the conversation.',
      timestamp: formatMessageTime(lastMessage?.created_at ?? conversation.updated_at ?? conversation.created_at),
      unread,
      sortStamp,
    };
  }, [userId]);

  const fetchConversations = useCallback(async () => {
    if (!hasValidUserId) return;
    setLoadingChats(true);

    const { data: myParticipantsData, error: myParticipantsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, display_mode, alias_snapshot, last_read_at')
      .eq('user_id', userId);

    if (myParticipantsError) {
      console.error('Failed to load conversations:', myParticipantsError);
      setLoadingChats(false);
      return;
    }

    const myParticipants = (myParticipantsData ?? []) as ConversationParticipantRow[];
    const conversationIds = myParticipants.map((row) => row.conversation_id);
    if (conversationIds.length === 0) {
      setConversations([]);
      setLoadingChats(false);
      return;
    }

    const [
      { data: conversationsData, error: conversationsError },
      { data: allParticipantsData, error: participantsError },
      { data: messagesData, error: messagesError },
    ] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, school, kind, source_post_id, created_at, updated_at')
        .in('id', conversationIds),
      supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, display_mode, alias_snapshot, last_read_at')
        .in('conversation_id', conversationIds),
      supabase
        .from('conversation_messages')
        .select('id, conversation_id, sender_id, content, created_at, deleted_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(Math.max(200, conversationIds.length * 20)),
    ]);

    if (conversationsError || participantsError || messagesError) {
      console.error('Failed to load message previews:', conversationsError ?? participantsError ?? messagesError);
      setLoadingChats(false);
      return;
    }

    const conversationsRows = (conversationsData ?? []) as ConversationRow[];
    const participantsRows = (allParticipantsData ?? []) as ConversationParticipantRow[];
    const messageRows = (messagesData ?? []) as ConversationMessageRow[];
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
          messagesByConversation
        );
      })
      .filter((preview): preview is ConversationPreview => !!preview)
      .sort((a, b) => b.sortStamp - a.sortStamp);

    setConversations(previews);
    setLoadingChats(false);
  }, [buildPreview, hasValidUserId, resolveProfileNames, userId]);

  const markThreadRead = useCallback(async (conversationId: string) => {
    if (!hasValidUserId) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }, [hasValidUserId, userId]);

  const fetchMessages = useCallback(async (conversation: ConversationPreview) => {
    if (!hasValidUserId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, content, created_at, deleted_at')
      .eq('conversation_id', conversation.conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load conversation messages:', error);
      setLoadingMessages(false);
      return;
    }

    setMessages(
      ((data ?? []) as ConversationMessageRow[]).map((row) => ({
        id: row.id,
        content: row.deleted_at ? 'Message deleted' : row.content,
        timestamp: formatMessageTime(row.created_at),
        isMe: row.sender_id === userId,
        deleted: !!row.deleted_at,
      }))
    );

    setLoadingMessages(false);
    await markThreadRead(conversation.conversationId);
  }, [hasValidUserId, markThreadRead, userId]);

  const openExistingConversation = useCallback(async (conversation: ConversationPreview) => {
    setSelectedChat(conversation);
    await fetchMessages(conversation);
    await fetchConversations();
  }, [fetchConversations, fetchMessages]);

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
    try {
      let conversationId = target.conversationId ?? null;
      if (!conversationId) {
        const { data, error } = await supabase.rpc('get_or_create_conversation', {
          p_target_user_id: target.id,
          p_conversation_kind: target.kind,
          p_source_post_id: target.sourcePostId ?? null,
          p_conversation_school: school,
        });

        if (error) throw error;
        conversationId = data as string;
      }

      const name = target.kind === 'board_anonymous'
        ? anteaterAliasForId(target.id)
        : target.name?.trim() || anteaterAliasForId(target.id);
      const preview: ConversationPreview = {
        conversationId,
        partnerId: target.id,
        kind: target.kind,
        name,
        avatar: getInitials(name),
        label: conversationLabel(target.kind),
        sourcePostId: target.sourcePostId ?? null,
        sourceLabel: target.kind === 'board_anonymous' ? (target.sourceLabel ?? 'From Board') : null,
        lastMessage: 'Start the conversation.',
        timestamp: '',
        unread: 0,
        sortStamp: Date.now(),
      };

      setSelectedChat(preview);
      await fetchMessages(preview);
      await fetchConversations();
    } catch (error: any) {
      Alert.alert(
        'Could not open chat',
        messageTableMissing(error)
          ? 'The conversation chat SQL is not installed yet. Run supabase/sql/conversation_messages.sql in Supabase first.'
          : error?.message ?? 'Please try again.'
      );
    } finally {
      setOpeningConversation(false);
    }
  }, [fetchConversations, fetchMessages, hasValidUserId, school]);

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
      void fetchConversations();
      if (selectedChat) void fetchMessages(selectedChat);
    }, 7000);

    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, hasValidUserId, selectedChat]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat || sending || !hasValidUserId) return;
    const content = messageInput.trim();
    setSending(true);

    const { error } = await supabase.from('conversation_messages').insert({
      conversation_id: selectedChat.conversationId,
      sender_id: userId,
      content,
    });

    if (error) {
      setSending(false);
      Alert.alert(
        'Could not send message',
        messageTableMissing(error)
          ? 'The conversation chat SQL is not installed yet. Run supabase/sql/conversation_messages.sql in Supabase first.'
          : error.message
      );
      return;
    }

    setSending(false);
    setMessageInput('');
    await fetchMessages(selectedChat);
    await fetchConversations();
  };

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((chat) => (
      chat.name.toLowerCase().includes(query) ||
      chat.label.toLowerCase().includes(query) ||
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
          }}>
            <TouchableOpacity onPress={() => { setSelectedChat(null); setMessageInput(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: selectedChat.kind === 'friend' ? colors.brand : '#111827',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{selectedChat.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{selectedChat.name}</Text>
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{selectedChat.label}</Text>
            </View>
          </View>

          {loadingMessages || openingConversation ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>
                {openingConversation ? 'Opening conversation...' : 'Loading messages...'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12, flexGrow: 1 }}
              ListEmptyComponent={() => (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                  <Text style={{ fontSize: 14, color: colors.textTertiary }}>Start the conversation.</Text>
                </View>
              )}
              renderItem={({ item: msg }) => (
                <View style={{ flexDirection: 'row', justifyContent: msg.isMe ? 'flex-end' : 'flex-start' }}>
                  <View style={{
                    maxWidth: '78%',
                    backgroundColor: msg.isMe ? colors.brand : colors.bgTertiary,
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    opacity: msg.deleted ? 0.68 : 1,
                  }}>
                    <Text style={{ fontSize: 14, color: msg.isMe ? 'white' : colors.text, lineHeight: 19 }}>
                      {msg.content}
                    </Text>
                    <Text style={{ fontSize: 10, color: msg.isMe ? 'rgba(255,255,255,0.65)' : colors.textTertiary, marginTop: 3 }}>
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 8) + 8,
            borderTopWidth: 1, borderTopColor: colors.border, gap: 10,
          }}>
            <TextInput
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                maxHeight: 112,
                backgroundColor: colors.inputBg,
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 14,
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
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
              {sending ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={16} color="white" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(c) => c.conversationId}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 24 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={42} color={colors.border} />
              <Text style={{ marginTop: 12, fontSize: 15, fontWeight: '700', color: colors.text }}>No messages yet</Text>
              <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.textTertiary, textAlign: 'center' }}>
                Friend chats use real names. Board chats stay anonymous.
              </Text>
            </View>
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
                  backgroundColor: chat.kind === 'friend' ? colors.brand : '#111827',
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
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>{chat.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{chat.timestamp}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <View style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: chat.kind === 'friend' ? colors.brand : '#111827',
                  }} />
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>{chat.label}</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{chat.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
