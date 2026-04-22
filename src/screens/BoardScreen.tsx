import { useState, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Switch, Alert,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import type { ChatTarget } from '../data/messages';

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

type Post = {
  id: string;
  user_id: string;
  author_name: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  likes: number;
  commentCount: number;
  liked: boolean;
};

type Board = {
  id: string;
  name: string;
  category: string | null; // null = all posts
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  iconBg: string;
};

const BOARDS: Board[] = [
  { id: 'general',    name: 'General Board',         category: null,              icon: 'chatbubbles-outline', color: '#4169E1', iconBg: '#eef1fb' },
  { id: 'sports',     name: 'Sports Board',           category: 'Sports',          icon: 'barbell-outline',     color: '#10B981', iconBg: '#ecfdf5' },
  { id: 'study',      name: 'Study Groups Board',     category: 'Study Groups',    icon: 'book-outline',        color: '#F59E0B', iconBg: '#fef9ec' },
  { id: 'market',     name: 'Marketplace Board',      category: 'Marketplace',     icon: 'bag-outline',         color: '#8B5CF6', iconBg: '#f5f3ff' },
  { id: 'clubs',      name: 'Club Promotions Board',  category: 'Club Promotions', icon: 'megaphone-outline',   color: '#EC4899', iconBg: '#fdf2f8' },
];


function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type Props = {
  onOpenMessages?: (target?: ChatTarget | null) => void;
  school: string;
  userId: string;
  boardAuthorName: string;
  boardProfileVisible: boolean;
  bottomInset?: number;
  scrollToTopTrigger?: number;
};

export default function BoardScreen({ onOpenMessages, school, userId, boardAuthorName, boardProfileVisible, bottomInset = 0, scrollToTopTrigger = 0 }: Props) {
  const { colors } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostBody, setNewPostBody] = useState('');
  const [newPostBoardId, setNewPostBoardId] = useState('general');
  const [preventEdit, setPreventEdit] = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');

  const SCREEN_W = Dimensions.get('window').width;
  const boardSlideAnim = useRef(new Animated.Value(SCREEN_W)).current;

  const swipeBoardPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) boardSlideAnim.setValue(gs.dx);
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > SCREEN_W * 0.35 || gs.vx > 0.6) {
        closeBoard();
      } else {
        Animated.spring(boardSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(boardSlideAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    },
  })).current;

  function openBoard(board: Board) {
    boardSlideAnim.setValue(SCREEN_W);
    setSelectedBoard(board);
    Animated.spring(boardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 16,
    }).start();
  }

  function closeBoard() {
    Animated.timing(boardSlideAnim, {
      toValue: SCREEN_W,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setSelectedBoard(null);
      setSearch('');
      setSort('recent');
      boardSlideAnim.setValue(SCREEN_W);
    });
  }

  const postsCacheKey = `board_posts_${school}_${userId}`;

  useEffect(() => { fetchPosts(); }, [boardAuthorName, boardProfileVisible, school, userId]);

  async function resolveAuthorNames(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const validIds = uniqueIds.filter(isUuid);
    const invalidNameMap = Object.fromEntries(
      uniqueIds
        .filter((id) => !isUuid(id))
        .map((id) => [id, 'Anonymous'])
    );

    if (validIds.length === 0) return invalidNameMap;

    const [{ data: profilesData, error: profilesError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', validIds),
      supabase.from('user_settings').select('user_id, profile_details').in('user_id', validIds),
    ]);

    if (profilesError) console.error('Failed to load board profiles:', profilesError);
    if (settingsError && settingsError.code !== 'PGRST205') console.error('Failed to load board visibility settings:', settingsError);

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
      ...invalidNameMap,
      ...Object.fromEntries(
        validIds.map((id) => {
        const profile = profilesById[id];
        const fallbackName = profile?.name?.trim() || profile?.email?.split('@')[0] || 'Anonymous';
        return [id, visibleById[id] ? fallbackName : 'Anonymous'];
        })
      ),
    };
  }

  async function fetchPosts() {
    const cached = await AsyncStorage.getItem(postsCacheKey);
    if (cached) {
      setPosts(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }

    const { data: postsData, error } = await supabase
      .from('posts').select('*').eq('school', school).order('created_at', { ascending: false });
    if (error || !postsData) { setLoading(false); return; }
    if (postsData.length === 0) { setPosts([]); setLoading(false); AsyncStorage.setItem(postsCacheKey, JSON.stringify([])); return; }
    const postIds = postsData.map((p: any) => p.id);
    const [{ data: votesData }, { data: commentsData }] = await Promise.all([
      supabase.from('post_votes').select('post_id, user_id').in('post_id', postIds),
      supabase.from('post_comments').select('post_id').in('post_id', postIds),
    ]);
    const authorNames = await resolveAuthorNames(postsData.map((p: any) => p.user_id));
    const likeCountMap: Record<string, number> = {};
    const userLikedSet = new Set<string>();
    (votesData ?? []).forEach((v: any) => {
      likeCountMap[v.post_id] = (likeCountMap[v.post_id] ?? 0) + 1;
      if (v.user_id === userId) userLikedSet.add(v.post_id);
    });
    const commentCountMap: Record<string, number> = {};
    (commentsData ?? []).forEach((c: any) => {
      commentCountMap[c.post_id] = (commentCountMap[c.post_id] ?? 0) + 1;
    });
    const freshPosts = postsData.map((p: any) => ({
      id: p.id, user_id: p.user_id,
      author_name: authorNames[p.user_id] ?? p.author_name ?? 'Anonymous',
      category: p.category ?? 'General',
      title: p.title, body: p.body ?? '',
      created_at: p.created_at,
      likes: likeCountMap[p.id] ?? 0,
      commentCount: commentCountMap[p.id] ?? 0,
      liked: userLikedSet.has(p.id),
    }));
    setPosts(freshPosts);
    setLoading(false);
    AsyncStorage.setItem(postsCacheKey, JSON.stringify(freshPosts));
  }

  async function openPost(post: Post) {
    setSelectedPost(post);
    setCommentsLoading(true);
    const { data } = await supabase.from('post_comments').select('*').eq('post_id', post.id).order('created_at', { ascending: true });
    const commentRows = (data ?? []) as Comment[];
    const authorNames = await resolveAuthorNames(commentRows.map((comment) => comment.user_id));
    setComments(commentRows.map((comment) => ({
      ...comment,
      author_name: authorNames[comment.user_id] ?? comment.author_name ?? 'Anonymous',
    })));
    setCommentsLoading(false);
  }

  async function toggleLike(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const wasLiked = post.liked;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: !wasLiked, likes: wasLiked ? p.likes - 1 : p.likes + 1 } : p));
    if (wasLiked) {
      await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('post_votes').insert({ post_id: postId, user_id: userId });
    }
  }

  async function handleAddComment() {
    if (!commentInput.trim() || !selectedPost) return;
    const authorName = boardProfileVisible ? boardAuthorName : 'Anonymous';
    const { data, error } = await supabase.from('post_comments')
      .insert({ post_id: selectedPost.id, user_id: userId, author_name: authorName, content: commentInput.trim() })
      .select().single();
    if (error || !data) return;
    setComments(prev => [...prev, { ...data, author_name: authorName }]);
    setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, commentCount: p.commentCount + 1 } : p));
    setCommentInput('');
  }

  async function handleCreatePost() {
    if (!newPostTitle.trim() || submittingPost) return;
    setSubmittingPost(true);
    const board = BOARDS.find(b => b.id === newPostBoardId) ?? BOARDS[0];
    const category = board.category ?? 'General';
    const authorName = boardProfileVisible ? boardAuthorName : 'Anonymous';
    const { data, error } = await supabase.from('posts')
      .insert({ user_id: userId, school, category, title: newPostTitle.trim(), body: newPostBody.trim(), author_name: authorName })
      .select().single();
    setSubmittingPost(false);
    if (error || !data) {
      Alert.alert('Post failed', error?.message ?? 'Unknown error');
      return;
    }
    const newPost: Post = {
      id: data.id, user_id: data.user_id, author_name: authorName,
      category: data.category ?? 'General', title: data.title, body: data.body ?? '',
      created_at: data.created_at, likes: 0, commentCount: 0, liked: false,
    };
    setPosts(prev => [newPost, ...prev]);
    setShowNewPost(false);
    setNewPostTitle(''); setNewPostBody(''); setNewPostBoardId('general'); setPreventEdit(false);
  }

  function openNewPost(boardId?: string) {
    setNewPostBoardId(boardId ?? selectedBoard?.id ?? 'general');
    setNewPostTitle('');
    setNewPostBody('');
    setPreventEdit(false);
    setShowNewPost(true);
  }

  const boardPosts = useMemo(() => {
    if (!selectedBoard) return [];
    return selectedBoard.category === null
      ? posts
      : posts.filter(p => p.category === selectedBoard.category);
  }, [posts, selectedBoard]);

  const filteredPosts = useMemo(() => {
    let result = boardPosts.filter(p =>
      search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.body.toLowerCase().includes(search.toLowerCase()) ||
      p.author_name.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'popular') result = [...result].sort((a, b) => b.likes - a.likes);
    return result;
  }, [boardPosts, search, sort]);

  const postCountForBoard = (board: Board) =>
    board.category === null ? posts.length : posts.filter(p => p.category === board.category).length;

  const boardListScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (scrollToTopTrigger > 0) boardListScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  // ── board list (always rendered as base) + overlay for board/post detail ──
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: 64, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Board</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Choose a board to explore</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          {onOpenMessages ? (
            <TouchableOpacity
              onPress={() => onOpenMessages?.(null)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => openNewPost()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brand, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>New Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={boardListScrollRef} contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 70 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            {BOARDS.map(board => (
              <TouchableOpacity
                key={board.id}
                onPress={() => openBoard(board)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.card,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1.5,
                  borderColor: colors.borderSubtle,
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.07,
                  shadowRadius: 18,
                  elevation: 4,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: colors.brandBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                    borderWidth: 1,
                    borderColor: `${colors.brand}18`,
                  }}
                >
                  <Ionicons name={board.icon} size={22} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{board.name}</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{postCountForBoard(board)} posts</Text>
                </View>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.brandBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: `${colors.brand}18`,
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.brand} />
                </View>
              </TouchableOpacity>
            ))}

            {/* Request New Board */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: `${colors.brand}40`, borderStyle: 'dashed', backgroundColor: `${colors.brand}08` }}
              activeOpacity={0.7}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${colors.brand}15`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Ionicons name="add" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.brand }}>Request New Board</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>Suggest a new community board</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.brand} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Board detail + post detail overlay — slides in over the list */}
      {selectedBoard && (
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateX: boardSlideAnim }] }}
          {...swipeBoardPan.panHandlers}
        >
          {selectedPost ? (
            // ── post detail ────────────────────────────────────────────────
            (() => {
              const post = posts.find(p => p.id === selectedPost.id) ?? selectedPost;
              return (
                <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                  <View style={{ paddingTop: 64, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={() => { setSelectedPost(null); setComments([]); setCommentInput(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="chevron-back" size={26} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Post</Text>
                  </View>
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{post.author_name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.category}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{post.title}</Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 }}>{post.body}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity onPress={() => toggleLike(post.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name={post.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={post.liked ? colors.brand : colors.textTertiary} />
                          <Text style={{ fontSize: 14, color: post.liked ? colors.brand : colors.textTertiary, fontWeight: '500' }}>{post.likes}</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
                          <Text style={{ fontSize: 14, color: colors.textTertiary, fontWeight: '500' }}>{comments.length}</Text>
                        </View>
                        {onOpenMessages && post.user_id !== userId && (
                          <TouchableOpacity onPress={() => onOpenMessages?.({ id: post.user_id, name: post.author_name })} style={{ marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="send-outline" size={16} color="white" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 }}>Comments ({comments.length})</Text>
                      {commentsLoading ? (
                        <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />
                      ) : comments.map(comment => (
                        <View key={comment.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: 'white' }}>{(comment.author_name ?? 'S').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{comment.author_name ?? 'Student'}</Text>
                              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{timeAgo(comment.created_at)}</Text>
                            </View>
                            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{comment.content}</Text>
                          </View>
                        </View>
                      ))}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <TextInput
                          value={commentInput} onChangeText={setCommentInput}
                          placeholder="Add a comment..." placeholderTextColor={colors.placeholder}
                          style={{ flex: 1, backgroundColor: colors.inputBg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: colors.text }}
                          onSubmitEditing={handleAddComment} returnKeyType="send"
                        />
                        <TouchableOpacity onPress={handleAddComment} disabled={!commentInput.trim()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: commentInput.trim() ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="send" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
              );
            })()
          ) : (
            // ── board detail ───────────────────────────────────────────────
            <View style={{ flex: 1, backgroundColor: colors.bg }}>
              <View style={{ paddingTop: 64, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <TouchableOpacity onPress={closeBoard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                  </TouchableOpacity>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: selectedBoard.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={selectedBoard.icon} size={18} color={selectedBoard.color} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: colors.text }}>{selectedBoard.name}</Text>
                  <TouchableOpacity
                    onPress={() => openNewPost(selectedBoard.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brand, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Ionicons name="add" size={15} color="white" />
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>New Post</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 8 }}>
                  <Ionicons name="search-outline" size={16} color={colors.placeholder} />
                  <TextInput placeholder="Search posts..." placeholderTextColor={colors.placeholder} value={search} onChangeText={setSearch} style={{ flex: 1, fontSize: 14, color: colors.text }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                {(['recent', 'popular'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSort(s)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: sort === s ? colors.brand : 'transparent' }}
                  >
                    <Ionicons name={s === 'recent' ? 'time-outline' : 'trending-up-outline'} size={14} color={sort === s ? 'white' : colors.textTertiary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: sort === s ? 'white' : colors.textTertiary, textTransform: 'capitalize' }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : filteredPosts.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Ionicons name="clipboard-outline" size={40} color={colors.border} />
                  <Text style={{ fontSize: 16, color: colors.textTertiary }}>No posts yet</Text>
                  <Text style={{ fontSize: 14, color: colors.border }}>Be the first to post!</Text>
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                  {filteredPosts.map((post, index) => (
                    <TouchableOpacity key={post.id} onPress={() => openPost(post)} activeOpacity={0.8}>
                      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{post.author_name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.category}</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 5 }}>{post.title}</Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>{post.body}</Text>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); toggleLike(post.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name={post.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={15} color={post.liked ? colors.brand : colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: post.liked ? colors.brand : colors.textTertiary, fontWeight: '500' }}>{post.likes}</Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="chatbubble-outline" size={14} color={colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500' }}>{post.commentCount}</Text>
                          </View>
                        </View>
                      </View>
                      {index < filteredPosts.length - 1 && <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </Animated.View>
      )}

      {/* New Post Modal — single instance at root */}
      <NewPostModal
        visible={showNewPost}
        onClose={() => setShowNewPost(false)}
        boards={BOARDS}
        selectedBoardId={newPostBoardId}
        onSelectBoard={setNewPostBoardId}
        showBoardPicker={showBoardPicker}
        onToggleBoardPicker={() => setShowBoardPicker(v => !v)}
        title={newPostTitle}
        onTitleChange={setNewPostTitle}
        body={newPostBody}
        onBodyChange={setNewPostBody}
        preventEdit={preventEdit}
        onPreventEditChange={setPreventEdit}
        onSubmit={handleCreatePost}
        submitting={submittingPost}
        colors={colors}
      />
    </View>
  );
}

type NewPostModalProps = {
  visible: boolean;
  onClose: () => void;
  boards: Board[];
  selectedBoardId: string;
  onSelectBoard: (id: string) => void;
  showBoardPicker: boolean;
  onToggleBoardPicker: () => void;
  title: string;
  onTitleChange: (v: string) => void;
  body: string;
  onBodyChange: (v: string) => void;
  preventEdit: boolean;
  onPreventEditChange: (v: boolean) => void;
  onSubmit: () => void;
  submitting: boolean;
  colors: ReturnType<typeof import('../context/ThemeContext').useTheme>['colors'];
};

function NewPostModal({
  visible, onClose, boards, selectedBoardId, onSelectBoard,
  showBoardPicker, onToggleBoardPicker, title, onTitleChange,
  body, onBodyChange, preventEdit, onPreventEditChange,
  onSubmit, submitting, colors,
}: NewPostModalProps) {
  const selectedBoard = boards.find(b => b.id === selectedBoardId) ?? boards[0];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>New Post</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Board */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
            Board <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>
          <TouchableOpacity
            onPress={onToggleBoardPicker}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 20 }}
          >
            <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{selectedBoard.name}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          {showBoardPicker && (
            <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: -16, marginBottom: 20, overflow: 'hidden' }}>
              {boards.map((board, i) => (
                <TouchableOpacity
                  key={board.id}
                  onPress={() => { onSelectBoard(board.id); onToggleBoardPicker(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: i < boards.length - 1 ? 1 : 0, borderBottomColor: colors.borderSubtle }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: board.iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Ionicons name={board.icon} size={14} color={board.color} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{board.name}</Text>
                  {board.id === selectedBoardId && <Ionicons name="checkmark" size={18} color={colors.brand} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Title */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
            Title <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={onTitleChange}
            placeholder="Write a clear and descriptive title..."
            placeholderTextColor={colors.placeholder}
            style={{ backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.text, marginBottom: 20 }}
          />

          {/* Content */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
            Content <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>
          <TextInput
            value={body}
            onChangeText={onBodyChange}
            placeholder="Share your thoughts, ask questions, or provide details..."
            placeholderTextColor={colors.placeholder}
            multiline
            style={{ backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.text, marginBottom: 20, minHeight: 160, textAlignVertical: 'top' }}
          />

          {/* Attachments */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 }}>Attachments</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 13 }}>
              <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Add Images</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingVertical: 13 }}>
              <Ionicons name="attach-outline" size={18} color={colors.textSecondary} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Add Files</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

          {/* Post Options */}
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 }}>Post Options</Text>
          <View style={{ backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Prevent Edit/Delete</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Lock this post after publishing</Text>
            </View>
            <Switch
              value={preventEdit}
              onValueChange={onPreventEditChange}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor="white"
            />
          </View>
        </ScrollView>

        {/* Footer buttons */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.inputBg }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!title.trim() || submitting}
            style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: title.trim() ? colors.brand : colors.border }}
          >
            {submitting ? <ActivityIndicator color="white" /> : <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>Post</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
