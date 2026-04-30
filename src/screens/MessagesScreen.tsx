import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  InteractionManager,
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

function conversationAccent(kind: ChatKind, brand: string) {
  if (kind === 'board_anonymous') return '#111827';
  return brand;
}

export default function MessagesScreen({ onClose, openChatWith, userId, school }: Props) {
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messageListRef = useRef<FlatList<MessageBubble>>(null);
  const messageInputRef = useRef<TextInput>(null);
  const hasValidUserId = !!userId && isUuid(userId);
  const selectedConversationId = selectedChat?.conversationId ?? null;
  const composerBottomPadding = keyboardVisible ? 8 : Math.max(insets.bottom, 8);
  const keyboardListSpacer = keyboardVisible ? Math.max(keyboardHeight, Platform.OS === 'ios' ? 320 : 260) : 0;
  const messageListBottomPadding = keyboardVisible
    ? (editingMessage ? 132 : 92) + keyboardListSpacer
    : editingMessage ? 64 : 22;

  const scrollMessagesToEnd = useCallback((animated = true, delay = 0) => {
    const run = () => {
      InteractionManager.runAfterInteractions(() => {
        messageListRef.current?.scrollToEnd({ animated });
      });
    };
    if (delay > 0) {
      setTimeout(run, delay);
      return;
    }
    requestAnimationFrame(run);
  }, []);

  const settleMessagesAtEnd = useCallback((animated = true) => {
    [0, 80, 180, 340, 560, 780].forEach((delay) => scrollMessagesToEnd(animated, delay));
  }, [scrollMessagesToEnd]);

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
        .in('id', conversationIds)
        .in('kind', ['friend', 'board_anonymous']),
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
    setEditingMessage(null);
    setMessageInput('');
    setSelectedChat(conversation);
    await fetchMessages(conversation);
    await fetchConversations({ silent: true });
  }, [fetchConversations, fetchMessages]);

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
    try {
      const conversationId = target.conversationId ?? await findExistingConversationId(target);
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

      setEditingMessage(null);
      setMessageInput('');
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
  }, [fetchConversations, fetchMessages, findExistingConversationId, hasValidUserId, loadSourcePostsById]);

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
    const showEvents = Platform.OS === 'ios'
      ? (['keyboardWillShow', 'keyboardDidShow'] as const)
      : (['keyboardDidShow'] as const);
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubs = showEvents.map((eventName) => Keyboard.addListener(eventName, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? (Platform.OS === 'ios' ? 320 : 260));
      setKeyboardVisible(true);
      settleMessagesAtEnd(true);
    }));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubs.forEach((sub) => sub.remove());
      hideSub.remove();
    };
  }, [settleMessagesAtEnd]);

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
    if (!message.isMe || message.deleted) return;
    setEditingMessage(message);
    setMessageInput(message.content);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const openMessageActions = useCallback((message: MessageBubble) => {
    if (!message.isMe || message.deleted) return;

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
  }, [beginEditMessage, handleDeleteMessage]);

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
      void fetchConversations({ silent: true });
      settleMessagesAtEnd(true);
      return;
    }

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
        Alert.alert('Could not start chat', 'Please try again.');
        return;
      }
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
      requestAnimationFrame(() => messageInputRef.current?.focus());
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
    requestAnimationFrame(() => messageInputRef.current?.focus());
    if (data) {
      const row = data as ConversationMessageRow;
      setMessages((current) => {
        if (current.some((message) => message.id === row.id)) return current;
        return [...current, mapMessageRow(row)];
      });
    }
    settleMessagesAtEnd(true);
    await fetchConversations({ silent: true });
    settleMessagesAtEnd(true);
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
          behavior="height"
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
                setSelectedChat(null);
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
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{selectedChat.name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2, fontWeight: '700' }}>
                {selectedChat.label}
              </Text>
            </View>
          </View>

          {selectedChat.kind === 'board_anonymous' && selectedChat.sourcePost ? (
            <View
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
              {selectedChat.sourcePost.imageUrl ? (
                <Image
                  source={{ uri: selectedChat.sourcePost.imageUrl }}
                  style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.bgTertiary }}
                />
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
                    name={selectedChat.sourcePost.deleted ? 'trash-outline' : 'document-text-outline'}
                    size={22}
                    color={colors.textTertiary}
                  />
                </View>
              )}
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                  {selectedChat.sourcePost.title}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.textSecondary }}>
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
              onLayout={() => {
                if (messages.length > 0) settleMessagesAtEnd(false);
              }}
              onContentSizeChange={() => {
                if (messages.length > 0) settleMessagesAtEnd(true);
              }}
              ListEmptyComponent={() => (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
                  <Text style={{ fontSize: 14, color: colors.textTertiary }}>Start the conversation.</Text>
                </View>
              )}
              renderItem={({ item: msg }) => (
                <View style={{ flexDirection: 'row', justifyContent: msg.isMe ? 'flex-end' : 'flex-start' }}>
                  <TouchableOpacity
                    activeOpacity={msg.isMe && !msg.deleted ? 0.78 : 1}
                    onLongPress={() => openMessageActions(msg)}
                    delayLongPress={260}
                    style={{
                      maxWidth: '78%',
                      backgroundColor: msg.isMe ? colors.brand : colors.bgTertiary,
                      borderRadius: 18,
                      borderBottomRightRadius: msg.isMe ? 6 : 18,
                      borderBottomLeftRadius: msg.isMe ? 18 : 6,
                      paddingHorizontal: 13,
                      paddingVertical: 9,
                      opacity: msg.deleted ? 0.68 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: msg.isMe ? 'white' : colors.text, lineHeight: 19 }}>
                      {msg.content}
                    </Text>
                    <Text style={{ fontSize: 10, color: msg.isMe ? 'rgba(255,255,255,0.65)' : colors.textTertiary, marginTop: 3 }}>
                      {msg.timestamp}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
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
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '700', color: colors.brand }}>
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
                setKeyboardHeight(0);
              }}
              onFocus={() => {
                setKeyboardHeight((height) => height || (Platform.OS === 'ios' ? 320 : 260));
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
                    backgroundColor: conversationAccent(chat.kind, colors.brand),
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
