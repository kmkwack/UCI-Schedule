import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Comment = {
  id: string;
  author: string;
  content: string;
  timeAgo: string;
};

type Post = {
  id: string;
  name: string;
  role: string;
  timeAgo: string;
  category: string;
  title: string;
  body: string;
  likes: number;
  comments: Comment[];
};

const MOCK_POSTS: Post[] = [
  {
    id: '1', name: 'Sarah Chen', role: 'Computer Science', timeAgo: '2h ago',
    category: 'Study Groups',
    title: 'Looking for study group members for CS 101',
    body: 'Meeting Tuesday and Thursday at the library. Looking for 2-3 more people!',
    likes: 24,
    comments: [
      { id: 'c1', author: 'Mike Johnson', content: "I'm in!", timeAgo: '1h ago' },
      { id: 'c2', author: 'Emma Wilson', content: 'Count me in too.', timeAgo: '30m ago' },
    ],
  },
  {
    id: '2', name: 'Mike Johnson', role: 'Engineering', timeAgo: '4h ago',
    category: 'Sports',
    title: 'Basketball pickup game this Saturday',
    body: 'Looking for players for a casual pickup game at the main gym. All skill levels welcome! 3pm-5pm.',
    likes: 18,
    comments: [
      { id: 'c3', author: 'David Lee', content: "I'm down!", timeAgo: '2h ago' },
      { id: 'c4', author: 'Alex Kim', content: 'Count me in.', timeAgo: '1h ago' },
    ],
  },
  {
    id: '3', name: 'Chess Club', role: 'Student Organization', timeAgo: '1d ago',
    category: 'Club Promotions',
    title: 'Chess Club - Weekly Meetings',
    body: 'Join us every Friday evening for friendly chess matches! Beginners and experts welcome. Free pizza!',
    likes: 156,
    comments: [
      { id: 'c5', author: 'Sarah Chen', content: "I'm going!", timeAgo: '30m ago' },
      { id: 'c6', author: 'Emma Wilson', content: 'Me too.', timeAgo: '15m ago' },
    ],
  },
  {
    id: '4', name: 'Amy Park', role: 'Business', timeAgo: '2d ago',
    category: 'Marketplace',
    title: 'Selling Econ 100A textbook — $25',
    body: 'Good condition, some highlighting. Perfect for anyone taking Econ 100A this quarter.',
    likes: 9,
    comments: [
      { id: 'c7', author: 'Mike Johnson', content: 'Thanks!', timeAgo: '1h ago' },
      { id: 'c8', author: 'David Lee', content: "I'll check it out.", timeAgo: '30m ago' },
    ],
  },
  {
    id: '5', name: 'Jordan Lee', role: 'Biology', timeAgo: '3d ago',
    category: 'Study Groups',
    title: 'BIO SCI D103 midterm study session',
    body: 'Organizing a group study at the Science Library this Sunday 2-5pm. All welcome!',
    likes: 31,
    comments: [
      { id: 'c9', author: 'Alex Kim', content: "I'm down!", timeAgo: '2h ago' },
      { id: 'c10', author: 'Emma Wilson', content: 'Count me in.', timeAgo: '1h ago' },
    ],
  },
];

const CATEGORIES = ['All', 'Sports', 'Study Groups', 'Marketplace', 'Club Promotions'];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Study Groups':    { bg: '#eef1fb', text: '#4169E1' },
  'Sports':         { bg: '#f0fdf4', text: '#16a34a' },
  'Marketplace':    { bg: '#fefce8', text: '#ca8a04' },
  'Club Promotions':{ bg: '#fdf4ff', text: '#9333ea' },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_COLORS = ['#4169E1', '#22c55e', '#f97316', '#a855f7', '#ec4899'];
function avatarColor(name: string): string {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

type Props = {
  onOpenMessages?: (name: string) => void;
};

export default function BoardScreen({ onOpenMessages }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [commentInput, setCommentInput] = useState('');

  const filteredPosts = useMemo(() => {
    let result = posts.filter(p => {
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      const matchSearch = search === '' ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.body.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
    if (sort === 'popular') result = [...result].sort((a, b) => b.likes - a.likes);
    return result;
  }, [posts, activeCategory, search, sort]);

  const toggleLike = (id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddComment = (postId: string) => {
    if (!commentInput.trim()) return;
    const newComment: Comment = {
      id: `c${Date.now()}`,
      author: 'You',
      content: commentInput,
      timeAgo: 'Just now',
    };
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p
    ));
    setCommentInput('');
  };

  const selectedPost = posts.find(p => p.id === selectedPostId) ?? null;

  // ── post detail view ──────────────────────────────────────────────────────
  if (selectedPost) {
    const liked = likedIds.has(selectedPost.id);
    const catStyle = CATEGORY_COLORS[selectedPost.category] ?? { bg: '#f3f4f6', text: '#374151' };

    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: 'white' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={{
          paddingTop: 60, paddingHorizontal: 16, paddingBottom: 14,
          borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <TouchableOpacity onPress={() => { setSelectedPostId(null); setCommentInput(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={26} color="#111827" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Post</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {/* Post content */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            {/* Author */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: avatarColor(selectedPost.name),
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                  {getInitials(selectedPost.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{selectedPost.name}</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>·</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>{selectedPost.role}</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>·</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>{selectedPost.timeAgo}</Text>
                </View>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: catStyle.bg }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: catStyle.text }}>{selectedPost.category}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10 }}>{selectedPost.title}</Text>
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 16 }}>{selectedPost.body}</Text>

            {/* Actions */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity
                onPress={() => toggleLike(selectedPost.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Ionicons
                  name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={18}
                  color={liked ? '#4169E1' : '#9ca3af'}
                />
                <Text style={{ fontSize: 14, color: liked ? '#4169E1' : '#9ca3af', fontWeight: '500' }}>
                  {selectedPost.likes + (liked ? 1 : 0)}
                </Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="chatbubble-outline" size={16} color="#9ca3af" />
                <Text style={{ fontSize: 14, color: '#9ca3af', fontWeight: '500' }}>{selectedPost.comments.length}</Text>
              </View>
              {onOpenMessages && (
                <TouchableOpacity
                  onPress={() => onOpenMessages(selectedPost.name)}
                  style={{
                    marginLeft: 'auto',
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="send-outline" size={16} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Comments */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 }}>
              Comments ({selectedPost.comments.length})
            </Text>

            {selectedPost.comments.map(comment => (
              <View key={comment.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>
                    {comment.author.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{comment.author}</Text>
                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>{comment.timeAgo}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: '#374151', lineHeight: 20 }}>{comment.content}</Text>
                </View>
              </View>
            ))}

            {/* Add comment */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb',
            }}>
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#9ca3af"
                style={{
                  flex: 1, backgroundColor: '#f3f4f6', borderRadius: 22,
                  paddingHorizontal: 16, paddingVertical: 10,
                  fontSize: 14, color: '#111827',
                }}
                onSubmitEditing={() => handleAddComment(selectedPost.id)}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={() => handleAddComment(selectedPost.id)}
                disabled={!commentInput.trim()}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: commentInput.trim() ? '#4169E1' : '#d1d5db',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="send" size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── posts list ────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{
        paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827' }}>Community</Text>
        <TouchableOpacity style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: '#4169E1', borderRadius: 20,
          paddingHorizontal: 14, paddingVertical: 8,
        }}>
          <Ionicons name="add" size={16} color="white" />
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>New Post</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#f3f4f6', borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        }}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            placeholder="Search posts..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, fontSize: 15, color: '#111827' }}
          />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
        style={{ marginBottom: 12, flexGrow: 0 }}
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                backgroundColor: isActive ? '#4169E1' : '#f3f4f6',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? 'white' : '#374151' }}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort tabs */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 16, gap: 20,
        marginBottom: 4, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
      }}>
        <TouchableOpacity
          onPress={() => setSort('recent')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons name="time-outline" size={15} color={sort === 'recent' ? '#4169E1' : '#9ca3af'} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: sort === 'recent' ? '#4169E1' : '#9ca3af' }}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSort('popular')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons name="trending-up-outline" size={15} color={sort === 'popular' ? '#4169E1' : '#9ca3af'} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: sort === 'popular' ? '#4169E1' : '#9ca3af' }}>
            Popular
          </Text>
        </TouchableOpacity>
      </View>

      {/* Posts */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {filteredPosts.map((post, index) => {
          const catStyle = CATEGORY_COLORS[post.category] ?? { bg: '#f3f4f6', text: '#374151' };
          const liked = likedIds.has(post.id);
          return (
            <TouchableOpacity key={post.id} onPress={() => setSelectedPostId(post.id)} activeOpacity={0.8}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                {/* Post header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: avatarColor(post.name),
                    alignItems: 'center', justifyContent: 'center', marginRight: 10,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                      {getInitials(post.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>{post.name}</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af' }}>·</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af' }}>{post.role}</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af' }}>·</Text>
                      <Text style={{ fontSize: 12, color: '#9ca3af' }}>{post.timeAgo}</Text>
                    </View>
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: catStyle.bg }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: catStyle.text }}>{post.category}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
                  {post.title}
                </Text>
                <Text style={{ fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 12 }} numberOfLines={3}>
                  {post.body}
                </Text>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); toggleLike(post.id); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Ionicons
                      name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={16}
                      color={liked ? '#4169E1' : '#9ca3af'}
                    />
                    <Text style={{ fontSize: 13, color: liked ? '#4169E1' : '#9ca3af', fontWeight: '500' }}>
                      {post.likes + (liked ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="chatbubble-outline" size={15} color="#9ca3af" />
                    <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '500' }}>{post.comments.length}</Text>
                  </View>
                </View>
              </View>

              {index < filteredPosts.length - 1 && (
                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
