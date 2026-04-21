import { useState, useEffect } from "react";
import { Search, Send, ArrowLeft, MoreVertical } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import React from "react";

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  isMe: boolean;
}

interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  type: "friend" | "post";
}

const mockChats: Chat[] = [
  {
    id: "1",
    name: "Sarah Chen",
    avatar: "SC",
    lastMessage: "See you at the library!",
    timestamp: "2h ago",
    unread: 2,
    type: "friend",
  },
  {
    id: "2",
    name: "Alex Kim",
    avatar: "AK",
    lastMessage: "Thanks for the notes!",
    timestamp: "5h ago",
    unread: 0,
    type: "friend",
  },
  {
    id: "3",
    name: "Mike Johnson",
    avatar: "MJ",
    lastMessage: "About the basketball game...",
    timestamp: "1d ago",
    unread: 1,
    type: "post",
  },
  {
    id: "4",
    name: "Emma Wilson",
    avatar: "EW",
    lastMessage: "When do you want to play tennis?",
    timestamp: "2d ago",
    unread: 0,
    type: "post",
  },
];

const mockMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "m1",
      senderId: "1",
      content: "Hey! Are you free to study today?",
      timestamp: "10:30 AM",
      isMe: false,
    },
    {
      id: "m2",
      senderId: "me",
      content: "Yes! I'll be at the library around 2pm",
      timestamp: "10:35 AM",
      isMe: true,
    },
    {
      id: "m3",
      senderId: "1",
      content: "Perfect! See you at the library!",
      timestamp: "10:36 AM",
      isMe: false,
    },
  ],
  "2": [
    {
      id: "m4",
      senderId: "2",
      content: "Can you share the CS 101 notes?",
      timestamp: "Yesterday",
      isMe: false,
    },
    {
      id: "m5",
      senderId: "me",
      content: "Sure! I'll send them over",
      timestamp: "Yesterday",
      isMe: true,
    },
    {
      id: "m6",
      senderId: "2",
      content: "Thanks for the notes!",
      timestamp: "Yesterday",
      isMe: false,
    },
  ],
};

export default function Messages() {
  const location = useLocation();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [messageInput, setMessageInput] = useState<string>("");
  const [messages, setMessages] = useState<Record<string, Message[]>>(mockMessages);
  const [isDirectOpen, setIsDirectOpen] = useState<boolean>(false);

  // Check if we need to open a specific chat
  useEffect(() => {
    if (location.state?.openChatWith) {
      const author = location.state.openChatWith;
      const existingChat = chats.find(chat => chat.name === author);
      
      if (existingChat) {
        setSelectedChat(existingChat.id);
        setIsDirectOpen(true);
      } else {
        // Create a new chat for this person
        const newChat: Chat = {
          id: `new-${Date.now()}`,
          name: author,
          avatar: author.split(' ').map(n => n[0]).join('').toUpperCase(),
          lastMessage: "Start a conversation...",
          timestamp: "Now",
          unread: 0,
          type: "post",
        };
        setChats([newChat, ...chats]);
        setSelectedChat(newChat.id);
        setIsDirectOpen(true);
      }
    }
  }, [location.state]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChat) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      senderId: "me",
      content: messageInput,
      timestamp: "Just now",
      isMe: true,
    };

    setMessages({
      ...messages,
      [selectedChat]: [...(messages[selectedChat] || []), newMessage],
    });

    // Update chat preview
    setChats(
      chats.map((chat) =>
        chat.id === selectedChat
          ? { ...chat, lastMessage: messageInput, timestamp: "Just now" }
          : chat
      )
    );

    setMessageInput("");
  };

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedChatData = chats.find((chat) => chat.id === selectedChat);
  const currentMessages = selectedChat ? messages[selectedChat] || [] : [];

  return (
    <div className="h-full flex bg-white">
      {/* Chat List */}
      {!selectedChat && (
        <div className="flex flex-col w-full">
          {/* Header */}
          <div className="px-6 py-2.5 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl">Messages</h1>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-gray-100">
              {filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <p className="text-sm">No messages found</p>
                </div>
              ) : (
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChat(chat.id)}
                    className="px-6 py-4 cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-[#4169E1] text-white flex items-center justify-center font-medium text-sm">
                          {chat.avatar}
                        </div>
                        {chat.unread > 0 && (
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {chat.unread}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {chat.name}
                          </h3>
                          <span className="text-xs text-gray-400">
                            {chat.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {chat.lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat View */}
      {selectedChat && (
        <div className="flex flex-col w-full">
          {/* Chat Header */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={() => {
                if (isDirectOpen) {
                  navigate(-1);
                } else {
                  setSelectedChat(null);
                }
              }}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#4169E1] text-white flex items-center justify-center font-medium text-sm">
              {selectedChatData?.avatar}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">
                {selectedChatData?.name}
              </h2>
              <p className="text-xs text-gray-500">
                {selectedChatData?.type === "friend" ? "Friend" : "From post"}
              </p>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
            {currentMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] ${
                    message.isMe
                      ? "bg-[#4169E1] text-white"
                      : "bg-gray-100 text-gray-900"
                  } rounded-2xl px-4 py-2`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      message.isMe ? "text-[#4169E1]/20" : "text-gray-500"
                    }`}
                  >
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className="p-2.5 bg-[#4169E1] text-white rounded-full hover:bg-[#3557c7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}