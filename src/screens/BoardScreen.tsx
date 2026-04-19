import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Post = {
  id: string;
  name: string;
  role: string;
  timeAgo: string;
  category: string;
  title: string;
  body: string;
  likes: number;
  comments: number;
};

const MOCK_POSTS: Post[] = [
  {
    id: '1', name: 'Sarah Chen', role: 'Computer Science', timeAgo: '2h ago',
    category: 'Study Groups',
    title: 'Looking for study group members for CS 101',
    body: 'Meeting Tuesday and Thursday at the library. Looking for 2-3 more people!',
    likes: 24, comments: 2,
  },
  {
    id: '2', name: 'Mike Johnson', role: 'Engineering', timeAgo: '4h ago',
    category: 'Sports',
    title: 'Basketball pickup game this Saturday',
    body: 'Looking for players for a casual pickup game at the main gym. All skill levels welcome! 3pm-5pm.',
    likes: 18, comments: 2,
  },
  {
    id: '3', name: 'Chess Club', role: 'Student Organization', timeAgo: '1d ago',
    category: 'Club Promotions',
    title: 'Chess Club - Weekly Meetings',
    body: 'Join us every Friday evening for friendly chess matches! Beginners and experts welcome. Free pizza!',
    likes: 156, comments: 7,
  },
  {
    id: '4', name: 'Amy Park', role: 'Business', timeAgo: '2d ago',
    category: 'Marketplace',
    title: 'Selling Econ 100A textbook — $25',
    body: 'Good condition, some highlighting. Perfect for anyone taking Econ 100A this quarter.',
    likes: 9, comments: 4,
  },
  {
    id: '5', name: 'Jordan Lee', role: 'Biology', timeAgo: '3d ago',
    category: 'Study Groups',
    title: 'BIO SCI D103 midterm study session',
    body: 'Organizing a group study at the Science Library this Sunday 2-5pm. All welcome!',
    likes: 31, comments: 6,
  },
];

const CATEGORIES = ['All', 'Sports', 'Study Groups', 'Marketplace', 'Club Promotions'];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Study Groups':    { bg: '#eff6ff', text: '#2563eb' },
  'Sports':         { bg: '#f0fdf4', text: '#16a34a' },
  'Marketplace':    { bg: '#fefce8', text: '#ca8a04' },
  'Club Promotions':{ bg: '#fdf4ff', text: '#9333ea' },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_COLORS = ['#4f6ef7', '#22c55e', '#f97316', '#a855f7', '#ec4899'];
function avatarColor(name: string): string {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function BoardScreen() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const posts = useMemo(() => {
    let result = MOCK_POSTS.filter(p => {
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      const matchSearch = search === '' ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.body.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
    if (sort === 'popular') result = [...result].sort((a, b) => b.likes - a.likes);
    return result;
  }, [activeCategory, search, sort]);

  const toggleLike = (id: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
          backgroundColor: '#4f6ef7', borderRadius: 20,
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
                backgroundColor: isActive ? '#4f6ef7' : '#f3f4f6',
              }}
            >
              <Text style={{
                fontSize: 14, fontWeight: '600',
                color: isActive ? 'white' : '#374151',
              }}>
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
          <Ionicons name="time-outline" size={15} color={sort === 'recent' ? '#4f6ef7' : '#9ca3af'} />
          <Text style={{
            fontSize: 14, fontWeight: '600',
            color: sort === 'recent' ? '#4f6ef7' : '#9ca3af',
          }}>
            Recent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSort('popular')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons name="trending-up-outline" size={15} color={sort === 'popular' ? '#4f6ef7' : '#9ca3af'} />
          <Text style={{
            fontSize: 14, fontWeight: '600',
            color: sort === 'popular' ? '#4f6ef7' : '#9ca3af',
          }}>
            Popular
          </Text>
        </TouchableOpacity>
      </View>

      {/* Posts */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {posts.map((post, index) => {
          const catStyle = CATEGORY_COLORS[post.category] ?? { bg: '#f3f4f6', text: '#374151' };
          const liked = likedIds.has(post.id);
          return (
            <View key={post.id}>
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
                  {/* Category tag */}
                  <View style={{
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                    backgroundColor: catStyle.bg,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: catStyle.text }}>
                      {post.category}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
                  {post.title}
                </Text>

                {/* Body */}
                <Text style={{ fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 12 }} numberOfLines={3}>
                  {post.body}
                </Text>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => toggleLike(post.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Ionicons
                      name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={16}
                      color={liked ? '#4f6ef7' : '#9ca3af'}
                    />
                    <Text style={{ fontSize: 13, color: liked ? '#4f6ef7' : '#9ca3af', fontWeight: '500' }}>
                      {post.likes + (liked ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="chatbubble-outline" size={15} color="#9ca3af" />
                    <Text style={{ fontSize: 13, color: '#9ca3af', fontWeight: '500' }}>{post.comments}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Separator */}
              {index < posts.length - 1 && (
                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
