import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

const MOCK_CHATS: Chat[] = [
  { id: '1', name: 'Sarah Chen', avatar: 'SC', lastMessage: 'See you at the library!', timestamp: '2h ago', unread: 2 },
  { id: '2', name: 'Alex Kim', avatar: 'AK', lastMessage: 'Thanks for the notes!', timestamp: '5h ago', unread: 0 },
  { id: '3', name: 'Mike Johnson', avatar: 'MJ', lastMessage: 'About the basketball game...', timestamp: '1d ago', unread: 1 },
  { id: '4', name: 'Emma Wilson', avatar: 'EW', lastMessage: 'When do you want to play tennis?', timestamp: '2d ago', unread: 0 },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'm1', content: 'Hey! Are you free to study today?', timestamp: '10:30 AM', isMe: false },
    { id: 'm2', content: "Yes! I'll be at the library around 2pm", timestamp: '10:35 AM', isMe: true },
    { id: 'm3', content: 'Perfect! See you at the library!', timestamp: '10:36 AM', isMe: false },
  ],
  '2': [
    { id: 'm4', content: 'Can you share the CS 101 notes?', timestamp: 'Yesterday', isMe: false },
    { id: 'm5', content: "Sure! I'll send them over", timestamp: 'Yesterday', isMe: true },
    { id: 'm6', content: 'Thanks for the notes!', timestamp: 'Yesterday', isMe: false },
  ],
};

type Props = {
  onClose: () => void;
  openChatWith?: string | null;
};

export default function MessagesScreen({ onClose, openChatWith }: Props) {
  const [chats, setChats] = useState<Chat[]>(MOCK_CHATS);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Record<string, Message[]>>(MOCK_MESSAGES);

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
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 12,
          }}>
            <TouchableOpacity onPress={() => setSelectedChatId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </TouchableOpacity>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{selectedChat.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{selectedChat.name}</Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" />
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
                  backgroundColor: msg.isMe ? '#3b82f6' : '#f3f4f6',
                  borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
                }}>
                  <Text style={{ fontSize: 14, color: msg.isMe ? 'white' : '#111827' }}>{msg.content}</Text>
                  <Text style={{ fontSize: 10, color: msg.isMe ? '#bfdbfe' : '#9ca3af', marginTop: 2 }}>
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
            borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 10,
          }}>
            <TextInput
              value={messageInput}
              onChangeText={setMessageInput}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              style={{
                flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22,
                paddingHorizontal: 16, paddingVertical: 10,
                fontSize: 14, color: '#111827',
              }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!messageInput.trim()}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: messageInput.trim() ? '#3b82f6' : '#d1d5db',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color="#111827" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111827' }}>Messages</Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#f3f4f6', borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        }}>
          <Ionicons name="search-outline" size={16} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search messages..."
            placeholderTextColor="#9ca3af"
            style={{ flex: 1, fontSize: 14, color: '#111827' }}
          />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filteredChats}
        keyExtractor={c => c.id}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 14, color: '#9ca3af' }}>No messages found</Text>
          </View>
        )}
        renderItem={({ item: chat }) => (
          <TouchableOpacity
            onPress={() => setSelectedChatId(chat.id)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 14,
              gap: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
            }}
          >
            <View style={{ position: 'relative' }}>
              <View style={{
                width: 48, height: 48, borderRadius: 24,
                backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>{chat.avatar}</Text>
              </View>
              {chat.unread > 0 && (
                <View style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>{chat.unread}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{chat.name}</Text>
                <Text style={{ fontSize: 11, color: '#9ca3af' }}>{chat.timestamp}</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#6b7280' }} numberOfLines={1}>{chat.lastMessage}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
