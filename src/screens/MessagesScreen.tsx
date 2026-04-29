import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  const selectedConversationId = selectedChat?.conversationId ?? null;

  const mapMessageRow = useCallback((row: ConversationMessageRow): MessageBubble => ({
    id: row.id,
    content: row.deleted_at ? 'Message deleted' : row.content,
    timestamp: formatMessageTime(row.created_at),
    isMe: row.sender_id === userId,
    deleted: !!row.deleted_at,
  }), [userId]);

  const loadSourcePostsById = useCallback(async (sourcePostIds: string[]) => {
    const ids = Array.from(new Set(sourcePostIds.filter(Boolean)));
    if (ids.length === 0) return {};

    const { data, error } = await supabase
      .from('posts')
      .select('id, title, category, body, attachments')
      .in('id', ids);

    if (error) {
      console.error('Failed to load message source posts:', error);
      return {};
    }

    const entries = await Promise.all(
      ((data ?? []) as Array<SourcePostPreview & { attachments?: SourcePostAttachment[] | null }>).map(async (post) => {
        const imageAttachment = sourcePostImageAttachment(post.attachments);
        let imageUrl = imageAttachment?.url ?? null;
        if (!imageUrl && imageAttachment?.path) {
          const { data: signedData } = await supabase.storage
            .from('board-attachments')
            .createSignedUrl(imageAttachment.path, 60 * 60);
          imageUrl = signedData?.signedUrl ?? null;
        }

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
  }, []);

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
    messagesByConversation: Record<string, ConversationMessageRow[]>,
    sourcePostsById: Record<string, SourcePostPreview>
  ): ConversationPreview | null => {
    const partner = participants.find((row) => row.conversation_id === conversation.id && row.user_id !== userId);
    if (!partner) return null;

    const threadMessages = messagesByConversation[conversation.id] ?? [];
    const lastMessage = threadMessages[0];
    if (!lastMessage) return null;

    const unread = threadMessages.filter((message) => (
      message.sender_id !== userId &&
      !message.deleted_at &&
      (!myParticipant.last_read_at || new Date(message.created_at) > new Date(myParticipant.last_read_at))
    )).length;
    const isAnonymous = conversation.kind === 'board_anonymous';
    const name = isAnonymous
      ? partner.alias_snapshot || anteaterAliasForId(partner.user_id)
      : namesById[partner.user_id] || anteaterAliasForId(partner.user_id);
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
  }, [userId]);

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
      if (!options.silent) setLoadingChats(false);
      return;
    }

    const conversationsRows = (conversationsData ?? []) as ConversationRow[];
    const participantsRows = (allParticipantsData ?? []) as ConversationParticipantRow[];
    const messageRows = (messagesData ?? []) as ConversationMessageRow[];
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
      .filter((preview): preview is ConversationPreview => !!preview)
      .sort((a, b) => b.sortStamp - a.sortStamp);

    setConversations(previews);
    if (!options.silent) setLoadingChats(false);
  }, [buildPreview, hasValidUserId, loadSourcePostsById, resolveProfileNames, userId]);

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

    if (!options.silent) setLoadingMessages(true);
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, content, created_at, deleted_at')
      .eq('conversation_id', conversation.conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load conversation messages:', error);
      if (!options.silent) setLoadingMessages(false);
      return;
    }

    setMessages(((data ?? []) as ConversationMessageRow[]).map(mapMessageRow));

    if (!options.silent) setLoadingMessages(false);
    await markThreadRead(conversation.conversationId);
  }, [hasValidUserId, mapMessageRow, markThreadRead]);

  const openExistingConversation = useCallback(async (conversation: ConversationPreview) => {
    setSelectedChat(conversation);
    await fetchMessages(conversation);
    await fetchConversations({ silent: true });
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

    const conversationId = target.conversationId ?? null;
    setOpeningConversation(!!conversationId);
    try {
      const name = target.kind === 'board_anonymous'
        ? anteaterAliasForId(target.id)
        : target.name?.trim() || anteaterAliasForId(target.id);
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

      setSelectedChat(preview);
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
      setOpeningConversation(false);
    }
  }, [fetchConversations, fetchMessages, hasValidUserId, loadSourcePostsById, school]);

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
          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) return current;
            return [...current, mapMessageRow(row)];
          });
          void markThreadRead(selectedConversationId);
          void fetchConversations({ silent: true });
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
  }, [fetchConversations, hasValidUserId, mapMessageRow, markThreadRead, selectedConversationId]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat || sending || !hasValidUserId) return;
    const content = messageInput.trim();
    setSending(true);

    let conversationId = selectedChat.conversationId;
    if (!conversationId) {
      const { data: conversationData, error: conversationError } = await supabase.rpc('get_or_create_conversation', {
        p_target_user_id: selectedChat.partnerId,
        p_conversation_kind: selectedChat.kind,
        p_source_post_id: selectedChat.sourcePostId ?? null,
        p_conversation_school: school,
      });

      if (conversationError) {
        setSending(false);
        Alert.alert(
          'Could not start chat',
          messageTableMissing(conversationError)
            ? 'The conversation chat SQL is not installed yet. Run supabase/sql/conversation_messages.sql in Supabase first.'
            : conversationError.message ?? 'Please try again.'
        );
        return;
      }

      conversationId = conversationData as string;
      setSelectedChat((current) => (
        current && current.partnerId === selectedChat.partnerId
          ? { ...current, conversationId }
          : current
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
    if (data) {
      const row = data as ConversationMessageRow;
      setMessages((current) => {
        if (current.some((message) => message.id === row.id)) return current;
        return [...current, mapMessageRow(row)];
      });
    }
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
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

          {selectedChat.kind === 'board_anonymous' && selectedChat.sourcePost ? (
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 2,
                borderRadius: 14,
                padding: 10,
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
              {selectedChat.sourcePost.imageUrl ? (
                <Image
                  source={{ uri: selectedChat.sourcePost.imageUrl }}
                  style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: colors.bgTertiary }}
                />
              ) : (
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 10,
                    backgroundColor: colors.bgTertiary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={selectedChat.sourcePost.deleted ? 'trash-outline' : 'document-text-outline'}
                    size={22}
                    color={colors.textTertiary}
                  />
                </View>
              )}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: colors.text }}>
                  {selectedChat.sourcePost.title}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.textSecondary }}>
                  {selectedChat.sourcePost.deleted
                    ? 'The original board post is no longer available.'
                    : truncateText(selectedChat.sourcePost.body, 88) || selectedChat.sourcePost.category || 'Board post'}
                </Text>
              </View>
            </View>
          ) : null}

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
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
                borderWidth: 1,
                borderColor: colors.border,
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(c) => c.conversationId ?? `draft-${c.kind}-${c.partnerId}`}
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
                {chat.kind === 'board_anonymous' && chat.sourcePost ? (
                  <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 3 }} numberOfLines={1}>
                    From: {chat.sourcePost.title}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{chat.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
