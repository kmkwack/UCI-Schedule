import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import type {
  ChatTarget,
  ConversationListRow,
  MessageRow,
} from '../data/messages';
import { formatMessageTime } from '../data/messages';

type ConversationPreview = {
  conversationId: string;
  partnerId: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
};

type MessageBubble = {
  id: string;
  content: string;
  timestamp: string;
  isMe: boolean;
};

type ActiveConversation = ChatTarget & {
  conversationId: string;
};

type Props = {
  onClose: () => void;
  openChatWith?: ChatTarget | null;
  userId: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function makeUuid() {
  const cryptoUuid = globalThis.crypto?.randomUUID?.();
  if (cryptoUuid) return cryptoUuid;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function MessagesScreen({ onClose, openChatWith, userId }: Props) {
  const { colors } = useTheme();
  const isGuestUser = userId.startsWith('guest');
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ActiveConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!userId || isGuestUser) return;
    setLoadingChats(true);

    const { data, error } = await supabase.rpc('get_user_conversations');

    if (error) {
      console.error('Failed to load conversation list:', error);
      setLoadingChats(false);
      return;
    }

    const rows = (data ?? []) as ConversationListRow[];
    if (rows.length === 0) {
      setConversations([]);
      setLoadingChats(false);
      return;
    }

    const previewsByPartner = new Map<string, ConversationPreview & { sortStamp: number }>();
    rows.forEach((row) => {
      const name = row.partner_name?.trim() || row.partner_email?.split('@')[0] || 'Student';
      const stamp = row.last_message_at ?? row.updated_at;
      const sortStamp = new Date(stamp).getTime();
      const nextPreview = {
        conversationId: row.conversation_id,
        partnerId: row.partner_id,
        name,
        avatar: getInitials(name),
        lastMessage: row.last_message_text ?? 'Start the conversation.',
        timestamp: formatMessageTime(stamp),
        unread: row.unread_count ?? 0,
        sortStamp,
      };

      const existing = previewsByPartner.get(row.partner_id);
      if (!existing || sortStamp > existing.sortStamp) {
        previewsByPartner.set(row.partner_id, nextPreview);
      }
    });

    setConversations(
      Array.from(previewsByPartner.values())
        .sort((a, b) => b.sortStamp - a.sortStamp)
        .map(({ sortStamp: _sortStamp, ...preview }) => preview)
    );
    setLoadingChats(false);
  }, [isGuestUser, userId]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!conversationId || !userId) return;

    const now = new Date().toISOString();
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: now })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }, [userId]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!userId || isGuestUser || !conversationId) return;
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      setLoadingMessages(false);
      return;
    }

    setMessages(
      ((data ?? []) as MessageRow[]).map((row) => ({
        id: row.id,
        content: row.content,
        timestamp: formatMessageTime(row.created_at),
        isMe: row.sender_id === userId,
      }))
    );
    setLoadingMessages(false);
    await markConversationRead(conversationId);
  }, [isGuestUser, markConversationRead, userId]);

  const createConversation = useCallback(async (partner: ChatTarget) => {
    const now = new Date().toISOString();
    const conversationId = makeUuid();

    const { error: conversationError } = await supabase
      .from('conversations')
      .insert({
        id: conversationId,
        updated_at: now,
        last_message_text: null,
        last_message_at: null,
        last_message_sender_id: null,
      });

    if (conversationError) {
      throw conversationError;
    }

    const { error: participantError } = await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: conversationId, user_id: userId, last_read_at: now },
        { conversation_id: conversationId, user_id: partner.id, last_read_at: null },
      ]);

    if (participantError) {
      throw participantError;
    }

    return conversationId;
  }, [userId]);

  const getOrCreateConversation = useCallback(async (partner: ChatTarget) => {
    const { data, error } = await supabase.rpc('get_user_conversations');

    if (error) throw error;

    const rows = (data ?? []) as ConversationListRow[];
    const existingConversation = rows.find((row) => row.partner_id === partner.id);

    if (existingConversation?.conversation_id) {
      return existingConversation.conversation_id;
    }

    return createConversation(partner);
  }, [createConversation]);

  const openConversation = useCallback(async (partner: ChatTarget, conversationId?: string) => {
    if (!userId || isGuestUser) return;
    setOpeningConversation(true);

    try {
      const resolvedConversationId = conversationId ?? await getOrCreateConversation(partner);
      setSelectedConversation({ ...partner, conversationId: resolvedConversationId });
      await fetchMessages(resolvedConversationId);
      await fetchConversations();
    } catch (error: any) {
      Alert.alert(
        'Could not open chat',
        error?.code === 'PGRST205'
          ? 'The conversations/messages tables are missing in Supabase. Run the required SQL first.'
          : error?.message ?? 'Please try again.'
      );
    } finally {
      setOpeningConversation(false);
    }
  }, [fetchConversations, fetchMessages, getOrCreateConversation, isGuestUser, userId]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!openChatWith?.id || isGuestUser) return;
    void openConversation(openChatWith);
  }, [isGuestUser, openChatWith, openConversation]);

  useEffect(() => {
    if (isGuestUser) return;
    const interval = setInterval(() => {
      void fetchConversations();
      if (selectedConversation?.conversationId) {
        void fetchMessages(selectedConversation.conversationId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, isGuestUser, selectedConversation]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedConversation || sending) return;
    setSending(true);
    const content = messageInput.trim();
    const now = new Date().toISOString();

    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.conversationId,
      sender_id: userId,
      content,
      created_at: now,
    });

    if (messageError) {
      setSending(false);
      Alert.alert(
        'Could not send message',
        messageError.code === 'PGRST205'
          ? 'The conversations/messages tables are missing in Supabase. Run the required SQL first.'
          : messageError.message
      );
      return;
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .update({
        updated_at: now,
        last_message_text: content,
        last_message_at: now,
        last_message_sender_id: userId,
      })
      .eq('id', selectedConversation.conversationId);

    if (conversationError) {
      console.error('Failed to update conversation metadata:', conversationError);
    }

    const { error: selfReadError } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: now })
      .eq('conversation_id', selectedConversation.conversationId)
      .eq('user_id', userId);

    if (selfReadError) {
      console.error('Failed to update sender read state:', selfReadError);
    }

    setSending(false);
    setMessageInput('');
    await fetchMessages(selectedConversation.conversationId);
    await fetchConversations();
  };

  const filteredChats = useMemo(
    () => conversations.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [conversations, searchQuery]
  );

  if (isGuestUser) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>Messages</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Ionicons name="chatbubbles-outline" size={60} color={colors.border} />
          <Text style={{ marginTop: 14, fontSize: 16, fontWeight: '700', color: colors.text }}>Sign in required</Text>
          <Text style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.textTertiary, textAlign: 'center' }}>
            Messages are available only for signed-in university accounts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedConversation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
          }}>
            <TouchableOpacity onPress={() => setSelectedConversation(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{getInitials(selectedConversation.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{selectedConversation.name}</Text>
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
                    maxWidth: '70%',
                    backgroundColor: msg.isMe ? colors.brand : colors.bgTertiary,
                    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
                  }}>
                    <Text style={{ fontSize: 14, color: msg.isMe ? 'white' : colors.text }}>{msg.content}</Text>
                    <Text style={{ fontSize: 10, color: msg.isMe ? 'rgba(255,255,255,0.65)' : colors.textTertiary, marginTop: 2 }}>
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}

          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: colors.border, gap: 10,
          }}>
            <TextInput
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.placeholder}
              style={{
                flex: 1, backgroundColor: colors.inputBg, borderRadius: 22,
                paddingHorizontal: 16, paddingVertical: 10,
                fontSize: 14, color: colors.text,
              }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={() => { void handleSend(); }}
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>Messages</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: colors.inputBg, borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, gap: 8,
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
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(c) => c.conversationId}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>No messages found</Text>
            </View>
          )}
          renderItem={({ item: chat }) => (
            <TouchableOpacity
              onPress={() => { void openConversation({ id: chat.partnerId, name: chat.name }, chat.conversationId); }}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 14,
                gap: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
              }}
            >
              <View style={{ position: 'relative' }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{chat.avatar}</Text>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{chat.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>{chat.timestamp}</Text>
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>{chat.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
