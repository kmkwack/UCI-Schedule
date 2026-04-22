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
import type { ChatTarget, DirectMessageRow } from '../data/messages';
import { formatMessageTime } from '../data/messages';

type ConversationPreview = {
  partnerId: string;
  name: string;
  avatar: string;
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
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default function MessagesScreen({ onClose, openChatWith, userId }: {
  onClose: () => void;
  openChatWith?: ChatTarget | null;
  userId: string;
}) {
  const { colors } = useTheme();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatTarget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<MessageBubble[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const hasValidUserId = !!userId && isUuid(userId);

  const resolvePartnerNames = useCallback(async (partnerIds: string[]) => {
    const uniqueIds = Array.from(new Set(partnerIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const validIds = uniqueIds.filter(isUuid);
    const invalidNames = Object.fromEntries(uniqueIds.filter((id) => !isUuid(id)).map((id) => [id, 'Anonymous']));
    if (validIds.length === 0) return invalidNames;

    const [{ data: profilesData, error: profilesError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', validIds),
      supabase.from('user_settings').select('user_id, profile_details').in('user_id', validIds),
    ]);

    if (profilesError) console.error('Failed to load message profiles:', profilesError);
    if (settingsError && settingsError.code !== 'PGRST205') {
      console.error('Failed to load message visibility settings:', settingsError);
    }

    const profilesById = Object.fromEntries(
      ((profilesData ?? []) as Array<{ id: string; name: string | null; email: string | null }>).map((row) => [row.id, row])
    );
    const visibleById = Object.fromEntries(
      ((settingsData ?? []) as Array<{ user_id: string; profile_details: Record<string, any> | null }>).map((row) => [
        row.user_id,
        row.profile_details?.boardProfileVisible === true,
      ])
    );

    return {
      ...invalidNames,
      ...Object.fromEntries(
        validIds.map((id) => {
          const profile = profilesById[id];
          const fallbackName = profile?.name?.trim() || profile?.email?.split('@')[0] || 'Anonymous';
          return [id, visibleById[id] ? fallbackName : 'Anonymous'];
        })
      ),
    };
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!userId || !hasValidUserId) return;
    setLoadingChats(true);

    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load direct messages:', error);
      setLoadingChats(false);
      return;
    }

    const rows = (data ?? []) as DirectMessageRow[];
    if (rows.length === 0) {
      setConversations([]);
      setLoadingChats(false);
      return;
    }

    const partnerIds = rows.map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id));
    const namesById = await resolvePartnerNames(partnerIds);
    const previewsByPartner = new Map<string, ConversationPreview>();

    rows.forEach((row) => {
      const partnerId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      const existing = previewsByPartner.get(partnerId);
      const sortStamp = new Date(row.created_at).getTime();

      if (!existing) {
        const name = namesById[partnerId] ?? 'Anonymous';
        previewsByPartner.set(partnerId, {
          partnerId,
          name,
          avatar: getInitials(name),
          lastMessage: row.content || 'Start the conversation.',
          timestamp: formatMessageTime(row.created_at),
          unread: row.receiver_id === userId && !row.read_at ? 1 : 0,
          sortStamp,
        });
        return;
      }

      if (row.receiver_id === userId && !row.read_at) {
        existing.unread += 1;
      }
    });

    setConversations(Array.from(previewsByPartner.values()).sort((a, b) => b.sortStamp - a.sortStamp));
    setLoadingChats(false);
  }, [hasValidUserId, resolvePartnerNames, userId]);

  const markThreadRead = useCallback(async (partnerId: string) => {
    if (!userId || !partnerId || !hasValidUserId || !isUuid(partnerId)) return;
    const now = new Date().toISOString();
    await supabase
      .from('direct_messages')
      .update({ read_at: now })
      .eq('sender_id', partnerId)
      .eq('receiver_id', userId)
      .is('read_at', null);
  }, [hasValidUserId, userId]);

  const fetchMessages = useCallback(async (partner: ChatTarget) => {
    if (!userId || !hasValidUserId || !isUuid(partner.id)) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load direct thread:', error);
      setLoadingMessages(false);
      return;
    }

    setMessages(
      ((data ?? []) as DirectMessageRow[]).map((row) => ({
        id: row.id,
        content: row.content,
        timestamp: formatMessageTime(row.created_at),
        isMe: row.sender_id === userId,
      }))
    );

    setLoadingMessages(false);
    await markThreadRead(partner.id);
  }, [hasValidUserId, markThreadRead, userId]);

  const openConversation = useCallback(async (partner: ChatTarget) => {
    if (!userId || !hasValidUserId || !isUuid(partner.id)) {
      Alert.alert('Sign in required', 'Direct messages are available only for signed-in university accounts.');
      return;
    }
    setOpeningConversation(true);

    try {
      setSelectedChat(partner);
      await fetchMessages(partner);
      await fetchConversations();
    } catch (error: any) {
      Alert.alert(
        'Could not open chat',
        error?.code === 'PGRST205'
          ? 'The direct_messages table is missing in Supabase. Recreate that table first.'
          : error?.message ?? 'Please try again.'
      );
    } finally {
      setOpeningConversation(false);
    }
  }, [fetchConversations, fetchMessages, hasValidUserId, userId]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!openChatWith?.id || !hasValidUserId || !isUuid(openChatWith.id)) return;
    void openConversation(openChatWith);
  }, [hasValidUserId, openChatWith, openConversation]);

  useEffect(() => {
    if (!hasValidUserId) return;
    const interval = setInterval(() => {
      void fetchConversations();
      if (selectedChat) {
        void fetchMessages(selectedChat);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, hasValidUserId, selectedChat]);

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat || sending || !hasValidUserId || !isUuid(selectedChat.id)) return;
    setSending(true);
    const content = messageInput.trim();

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: userId,
      receiver_id: selectedChat.id,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
    });

    if (error) {
      setSending(false);
      Alert.alert(
        'Could not send message',
        error.code === 'PGRST205'
          ? 'The direct_messages table is missing in Supabase. Recreate that table first.'
          : error.message
      );
      return;
    }

    setSending(false);
    setMessageInput('');
    await fetchMessages(selectedChat);
    await fetchConversations();
  };

  const filteredChats = useMemo(
    () => conversations.filter((chat) => chat.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [conversations, searchQuery]
  );

  if (!hasValidUserId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Messages</Text>
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

  if (selectedChat) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
          }}>
            <TouchableOpacity onPress={() => setSelectedChat(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{getInitials(selectedChat.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{selectedChat.name}</Text>
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
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Messages</Text>
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
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(c) => c.partnerId}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 14, color: colors.textTertiary }}>No messages found</Text>
            </View>
          )}
          renderItem={({ item: chat }) => (
            <TouchableOpacity
              onPress={() => { void openConversation({ id: chat.partnerId, name: chat.name }); }}
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
