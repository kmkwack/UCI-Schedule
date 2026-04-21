import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Message = {
  id: string;
  content: string;
  timestamp: string;
  isMe: boolean;
};

type Chat = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
};


type Props = {
  onClose: () => void;
  openChatWith?: string | null;
};

export default function MessagesScreen({ onClose, openChatWith }: Props) {
  const { colors } = useTheme();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    if (!openChatWith) return;
    const existing = chats.find(c => c.name === openChatWith);
    if (existing) {
      setSelectedChatId(existing.id);
    } else {
      const initials = openChatWith.split(' ').map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2);
      const newChat: Chat = {
        id: `new-${Date.now()}`,
        name: openChatWith,
        avatar: initials || '??',
        lastMessage: 'Start a conversation...',
        timestamp: 'Now',
        unread: 0,
      };
      setChats(prev => [newChat, ...prev]);
      setSelectedChatId(newChat.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatWith]);

  const handleSend = () => {
    if (!messageInput.trim() || !selectedChatId) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      content: messageInput,
      timestamp: 'Just now',
      isMe: true,
    };
    setMessages(prev => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg],
    }));
    setChats(prev => prev.map(c =>
      c.id === selectedChatId ? { ...c, lastMessage: messageInput, timestamp: 'Just now' } : c
    ));
    setMessageInput('');
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
  const currentMessages = selectedChatId ? messages[selectedChatId] || [] : [];
  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── chat view ──────────────────────────────────────────────────────────────
  if (selectedChat) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12,
          }}>
            <TouchableOpacity onPress={() => setSelectedChatId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{selectedChat.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{selectedChat.name}</Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            data={currentMessages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}
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

          {/* Input */}
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
              onPress={handleSend}
              disabled={!messageInput.trim()}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: messageInput.trim() ? colors.brand : colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="send" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── chat list ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
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

      {/* List */}
      <FlatList
        data={filteredChats}
        keyExtractor={c => c.id}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 14, color: colors.textTertiary }}>No messages found</Text>
          </View>
        )}
        renderItem={({ item: chat }) => (
          <TouchableOpacity
            onPress={() => setSelectedChatId(chat.id)}
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
                  width: 18, height: 18, borderRadius: 9,
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
    </SafeAreaView>
  );
}
