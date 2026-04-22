import { useState, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import type { ChatTarget } from '../data/messages';
import { anteaterAliasForId } from '../data/anonymousAliases';

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  parent_comment_id?: string | null;
};

type CommentVoteRow = {
  comment_id: string;
  user_id: string;
};

type CommentNode = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  likes: number;
  liked: boolean;
  replies: CommentNode[];
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
  category: string | null;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  iconBg: string;
};

type ReportTarget = {
  id: string;
  type: 'post' | 'comment';
  label: string;
};

const BOARDS: Board[] = [
  { id: 'general', name: 'General Board', category: null, icon: 'chatbubbles-outline', color: '#4169E1', iconBg: '#eef1fb' },
  { id: 'sports', name: 'Sports Board', category: 'Sports', icon: 'barbell-outline', color: '#10B981', iconBg: '#ecfdf5' },
  { id: 'study', name: 'Study Groups Board', category: 'Study Groups', icon: 'book-outline', color: '#F59E0B', iconBg: '#fef9ec' },
  { id: 'market', name: 'Marketplace Board', category: 'Marketplace', icon: 'bag-outline', color: '#8B5CF6', iconBg: '#f5f3ff' },
  { id: 'clubs', name: 'Club Promotions Board', category: 'Club Promotions', icon: 'megaphone-outline', color: '#EC4899', iconBg: '#fdf2f8' },
];

const REPORT_REASONS = [
  'Spam',
  'Harassment or hate',
  'Inappropriate content',
  'False information',
  'Scam or unsafe transaction',
  'Other',
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

function countComments(nodes: CommentNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countComments(node.replies), 0);
}

function updateCommentTree(
  nodes: CommentNode[],
  commentId: string,
  updater: (comment: CommentNode) => CommentNode
): CommentNode[] {
  return nodes.map((node) => {
    if (node.id === commentId) return updater(node);
    if (node.replies.length === 0) return node;
    return { ...node, replies: updateCommentTree(node.replies, commentId, updater) };
  });
}

function buildCommentTree(rows: CommentRow[], votes: CommentVoteRow[], userId: string, authorNames: Record<string, string>) {
  const likeCountMap: Record<string, number> = {};
  const likedCommentIds = new Set<string>();

  votes.forEach((vote) => {
    likeCountMap[vote.comment_id] = (likeCountMap[vote.comment_id] ?? 0) + 1;
    if (vote.user_id === userId) likedCommentIds.add(vote.comment_id);
  });

  const byId = new Map<string, CommentNode>();
  rows.forEach((row) => {
    byId.set(row.id, {
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      author_name: authorNames[row.user_id] ?? row.author_name ?? anteaterAliasForId(row.user_id),
      content: row.content,
      created_at: row.created_at,
      parent_comment_id: row.parent_comment_id ?? null,
      likes: likeCountMap[row.id] ?? 0,
      liked: likedCommentIds.has(row.id),
      replies: [],
    });
  });

  const roots: CommentNode[] = [];
  rows.forEach((row) => {
    const current = byId.get(row.id);
    if (!current) return;
    if (row.parent_comment_id && byId.has(row.parent_comment_id)) {
      byId.get(row.parent_comment_id)?.replies.push(current);
    } else {
      roots.push(current);
    }
  });

  return roots;
}

function buildPostScopedAliasMap(rows: CommentRow[], postAuthorId: string) {
  const aliasMap: Record<string, string> = {
    [postAuthorId]: 'Author',
  };
  let anteaterNumber = 1;

  rows.forEach((row) => {
    if (!row.user_id || aliasMap[row.user_id]) return;
    aliasMap[row.user_id] = `Anteater ${anteaterNumber}`;
    anteaterNumber += 1;
  });

  return aliasMap;
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

export default function BoardScreen({
  onOpenMessages,
  school,
  userId,
  boardAuthorName,
  boardProfileVisible,
  bottomInset = 0,
  scrollToTopTrigger = 0,
}: Props) {
  const { colors } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; authorName: string } | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostBody, setNewPostBody] = useState('');
  const [newPostBoardId, setNewPostBoardId] = useState('general');
  const [preventEdit, setPreventEdit] = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const SCREEN_W = Dimensions.get('window').width;
  const boardSlideAnim = useRef(new Animated.Value(SCREEN_W)).current;
  const postsCacheKey = `board_posts_${school}_${userId}`;
  const boardListScrollRef = useRef<ScrollView>(null);

  const swipeBoardPan = useRef(
    PanResponder.create({
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
    })
  ).current;

  useEffect(() => {
    void fetchPosts();
  }, [boardAuthorName, boardProfileVisible, school, userId]);

  useEffect(() => {
    if (scrollToTopTrigger > 0) boardListScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  async function resolveAuthorNames(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const validIds = uniqueIds.filter(isUuid);
    const invalidNameMap = Object.fromEntries(uniqueIds.filter((id) => !isUuid(id)).map((id) => [id, anteaterAliasForId(id)]));

    if (validIds.length === 0) return invalidNameMap;

    const [{ data: profilesData, error: profilesError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', validIds),
      supabase.from('user_settings').select('user_id, profile_details').in('user_id', validIds),
    ]);

    if (profilesError) console.error('Failed to load board profiles:', profilesError);
    if (settingsError && settingsError.code !== 'PGRST205') {
      console.error('Failed to load board visibility settings:', settingsError);
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
      ...invalidNameMap,
      ...Object.fromEntries(
        validIds.map((id) => {
          const profile = profilesById[id];
          const fallbackName = profile?.name?.trim() || profile?.email?.split('@')[0] || anteaterAliasForId(id);
          return [id, visibleById[id] ? fallbackName : anteaterAliasForId(id)];
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
      .from('posts')
      .select('*')
      .eq('school', school)
      .order('created_at', { ascending: false });

    if (error || !postsData) {
      setLoading(false);
      return;
    }

    if (postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      await AsyncStorage.setItem(postsCacheKey, JSON.stringify([]));
      return;
    }

    const postIds = postsData.map((post: any) => post.id);
    const [{ data: votesData }, { data: commentsData }] = await Promise.all([
      supabase.from('post_votes').select('post_id, user_id').in('post_id', postIds),
      supabase.from('post_comments').select('id, post_id').in('post_id', postIds),
    ]);

    const authorNames = await resolveAuthorNames(postsData.map((post: any) => post.user_id));
    const likeCountMap: Record<string, number> = {};
    const userLikedSet = new Set<string>();
    (votesData ?? []).forEach((vote: any) => {
      likeCountMap[vote.post_id] = (likeCountMap[vote.post_id] ?? 0) + 1;
      if (vote.user_id === userId) userLikedSet.add(vote.post_id);
    });

    const commentCountMap: Record<string, number> = {};
    (commentsData ?? []).forEach((comment: any) => {
      commentCountMap[comment.post_id] = (commentCountMap[comment.post_id] ?? 0) + 1;
    });

    const freshPosts = postsData.map((post: any) => ({
      id: post.id,
      user_id: post.user_id,
      author_name: authorNames[post.user_id] ?? post.author_name ?? anteaterAliasForId(post.user_id),
      category: post.category ?? 'General',
      title: post.title,
      body: post.body ?? '',
      created_at: post.created_at,
      likes: likeCountMap[post.id] ?? 0,
      commentCount: commentCountMap[post.id] ?? 0,
      liked: userLikedSet.has(post.id),
    }));

    setPosts(freshPosts);
    setLoading(false);
    await AsyncStorage.setItem(postsCacheKey, JSON.stringify(freshPosts));
  }

  async function loadCommentsForPost(postId: string) {
    setCommentsLoading(true);
    const { data: commentsData, error: commentsError } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Failed to load comments:', commentsError);
      setComments([]);
      setCommentsLoading(false);
      return;
    }

    const commentRows = (commentsData ?? []) as CommentRow[];
    const commentIds = commentRows.map((comment) => comment.id);
    const [{ data: commentVoteData, error: commentVotesError }, authorNames] = await Promise.all([
      commentIds.length > 0
        ? supabase.from('post_comment_votes').select('comment_id, user_id').in('comment_id', commentIds)
        : Promise.resolve({ data: [], error: null }),
      resolveAuthorNames(commentRows.map((comment) => comment.user_id)),
    ]);

    if (commentVotesError && (commentVotesError as any).code !== 'PGRST205') {
      console.error('Failed to load comment likes:', commentVotesError);
    }

    const postAuthorId = selectedPost?.user_id ?? posts.find((post) => post.id === postId)?.user_id ?? '';
    const scopedAliases = postAuthorId ? buildPostScopedAliasMap(commentRows, postAuthorId) : {};
    const mergedNames = { ...authorNames, ...scopedAliases };
    setComments(buildCommentTree(commentRows, ((commentVoteData ?? []) as CommentVoteRow[]), userId, mergedNames));
    setCommentsLoading(false);
  }

  async function openPost(post: Post) {
    setSelectedPost(post);
    setReplyingToComment(null);
    setCommentInput('');
    await loadCommentsForPost(post.id);
  }

  async function togglePostLike(postId: string) {
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return;

    const wasLiked = post.liked;
    setPosts((prev) =>
      prev.map((entry) =>
        entry.id === postId ? { ...entry, liked: !wasLiked, likes: wasLiked ? entry.likes - 1 : entry.likes + 1 } : entry
      )
    );

    if (wasLiked) {
      await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('post_votes').insert({ post_id: postId, user_id: userId });
    }
  }

  async function toggleCommentLike(commentId: string, liked: boolean) {
    setComments((prev) =>
      updateCommentTree(prev, commentId, (comment) => ({
        ...comment,
        liked: !liked,
        likes: liked ? Math.max(0, comment.likes - 1) : comment.likes + 1,
      }))
    );

    const query = liked
      ? supabase.from('post_comment_votes').delete().eq('comment_id', commentId).eq('user_id', userId)
      : supabase.from('post_comment_votes').insert({ comment_id: commentId, user_id: userId });

    const { error } = await query;
    if (error) {
      setComments((prev) =>
        updateCommentTree(prev, commentId, (comment) => ({
          ...comment,
          liked,
          likes: liked ? comment.likes + 1 : Math.max(0, comment.likes - 1),
        }))
      );
      Alert.alert(
        'Could not update comment like',
        error.code === 'PGRST205'
          ? 'The post_comment_votes table is missing in Supabase. Run the SQL update first.'
          : error.message
      );
    }
  }

  async function handleAddComment() {
    if (!commentInput.trim() || !selectedPost) return;

    const authorName = boardProfileVisible ? boardAuthorName : anteaterAliasForId(userId);
    const { error } = await supabase.from('post_comments').insert({
      post_id: selectedPost.id,
      user_id: userId,
      author_name: authorName,
      content: commentInput.trim(),
      parent_comment_id: replyingToComment?.id ?? null,
    });

    if (error) {
      Alert.alert(
        'Comment failed',
        error.code === 'PGRST204' || error.code === '42703'
          ? 'The post_comments table is missing the parent_comment_id column. Run the SQL update first.'
          : error.message
      );
      return;
    }

    setPosts((prev) =>
      prev.map((post) =>
        post.id === selectedPost.id ? { ...post, commentCount: post.commentCount + 1 } : post
      )
    );
    setCommentInput('');
    setReplyingToComment(null);
    await loadCommentsForPost(selectedPost.id);
  }

  async function handleCreatePost() {
    if (!newPostTitle.trim() || submittingPost) return;
    setSubmittingPost(true);

    const board = BOARDS.find((entry) => entry.id === newPostBoardId) ?? BOARDS[0];
    const category = board.category ?? 'General';
    const authorName = boardProfileVisible ? boardAuthorName : anteaterAliasForId(userId);
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        school,
        category,
        title: newPostTitle.trim(),
        body: newPostBody.trim(),
        author_name: authorName,
      })
      .select()
      .single();

    setSubmittingPost(false);
    if (error || !data) {
      Alert.alert('Post failed', error?.message ?? 'Unknown error');
      return;
    }

    const newPost: Post = {
      id: data.id,
      user_id: data.user_id,
      author_name: authorName,
      category: data.category ?? 'General',
      title: data.title,
      body: data.body ?? '',
      created_at: data.created_at,
      likes: 0,
      commentCount: 0,
      liked: false,
    };

    setPosts((prev) => [newPost, ...prev]);
    setShowNewPost(false);
    setNewPostTitle('');
    setNewPostBody('');
    setNewPostBoardId('general');
    setPreventEdit(false);
  }

  function openNewPost(boardId?: string) {
    setNewPostBoardId(boardId ?? selectedBoard?.id ?? 'general');
    setNewPostTitle('');
    setNewPostBody('');
    setPreventEdit(false);
    setShowNewPost(true);
  }

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
      setSelectedPost(null);
      setComments([]);
      setReplyingToComment(null);
      setCommentInput('');
      setSearch('');
      setSort('recent');
      boardSlideAnim.setValue(SCREEN_W);
    });
  }

  function openReport(target: ReportTarget) {
    setReportTarget(target);
    setReportReason(REPORT_REASONS[0]);
    setReportDetails('');
  }

  async function submitReport() {
    if (!reportTarget || submittingReport) return;

    setSubmittingReport(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId,
      school,
      target_type: reportTarget.type,
      target_id: reportTarget.id,
      reason: reportReason,
      details: reportDetails.trim() || null,
      status: 'pending',
    });
    setSubmittingReport(false);

    if (error) {
      Alert.alert(
        'Could not send report',
        error.code === 'PGRST205'
          ? 'The reports table is missing in Supabase. Run the report-platform SQL first.'
          : error.message
      );
      return;
    }

    Alert.alert('Report sent', 'Thanks. We will review this report soon.');
    setReportTarget(null);
    setReportDetails('');
  }

  const boardPosts = useMemo(() => {
    if (!selectedBoard) return [];
    return selectedBoard.category === null ? posts : posts.filter((post) => post.category === selectedBoard.category);
  }, [posts, selectedBoard]);

  const filteredPosts = useMemo(() => {
    let result = boardPosts.filter((post) => {
      const query = search.toLowerCase();
      return (
        search === '' ||
        post.title.toLowerCase().includes(query) ||
        post.body.toLowerCase().includes(query) ||
        post.author_name.toLowerCase().includes(query)
      );
    });

    if (sort === 'popular') result = [...result].sort((a, b) => b.likes - a.likes);
    return result;
  }, [boardPosts, search, sort]);

  const postCountForBoard = (board: Board) =>
    board.category === null ? posts.length : posts.filter((post) => post.category === board.category).length;

  const selectedPostCommentCount = useMemo(() => countComments(comments), [comments]);

  const renderComment = (comment: CommentNode, depth = 0): React.ReactNode => {
    const indent = Math.min(depth, 2) * 18;
    return (
      <View key={comment.id} style={{ marginLeft: indent, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'white' }}>
              {(comment.author_name ?? 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{comment.author_name ?? anteaterAliasForId(comment.user_id)}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{timeAgo(comment.created_at)}</Text>
            </View>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{comment.content}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => void toggleCommentLike(comment.id, comment.liked)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Ionicons
                  name={comment.liked ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={14}
                  color={comment.liked ? colors.brand : colors.textTertiary}
                />
                <Text style={{ fontSize: 12, color: comment.liked ? colors.brand : colors.textTertiary, fontWeight: '600' }}>
                  {comment.likes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setReplyingToComment({ id: comment.id, authorName: comment.author_name })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Ionicons name="return-up-forward-outline" size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openReport({
                  id: comment.id,
                  type: 'comment',
                  label: `Comment by ${comment.author_name}`,
                })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Ionicons name="flag-outline" size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {comment.replies.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          paddingTop: 64,
          paddingHorizontal: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
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
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.brand,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>New Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={boardListScrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + 70 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            {BOARDS.map((board) => (
              <TouchableOpacity
                key={board.id}
                onPress={() => openBoard(board)}
                activeOpacity={0.7}
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

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 16,
                padding: 16,
                borderWidth: 2,
                borderColor: `${colors.brand}40`,
                borderStyle: 'dashed',
                backgroundColor: `${colors.brand}08`,
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: `${colors.brand}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
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

      {selectedBoard && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateX: boardSlideAnim }],
          }}
          {...swipeBoardPan.panHandlers}
        >
          {selectedPost ? (
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View
                style={{
                  paddingTop: 64,
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPost(null);
                    setComments([]);
                    setReplyingToComment(null);
                    setCommentInput('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Post</Text>
              </View>

              {(() => {
                const post = posts.find((entry) => entry.id === selectedPost.id) ?? selectedPost;
                return (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                    <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>Author</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.category}</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{post.title}</Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 }}>{post.body}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity onPress={() => void togglePostLike(post.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name={post.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={post.liked ? colors.brand : colors.textTertiary} />
                          <Text style={{ fontSize: 14, color: post.liked ? colors.brand : colors.textTertiary, fontWeight: '500' }}>{post.likes}</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
                          <Text style={{ fontSize: 14, color: colors.textTertiary, fontWeight: '500' }}>{selectedPostCommentCount}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => openReport({ id: post.id, type: 'post', label: post.title })}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                        >
                          <Ionicons name="flag-outline" size={16} color={colors.textTertiary} />
                          <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>Report</Text>
                        </TouchableOpacity>
                        {onOpenMessages && post.user_id !== userId ? (
                          <TouchableOpacity
                            onPress={() => onOpenMessages?.({ id: post.user_id, name: post.author_name })}
                            style={{
                              marginLeft: 'auto',
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: colors.brand,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="send-outline" size={16} color="white" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                        Comments ({selectedPostCommentCount})
                      </Text>
                      {commentsLoading ? (
                        <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />
                      ) : comments.length > 0 ? (
                        comments.map((comment) => renderComment(comment))
                      ) : (
                        <Text style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 18 }}>No comments yet.</Text>
                      )}

                      {replyingToComment ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: colors.brandBg,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            marginBottom: 10,
                          }}
                        >
                          <Text style={{ fontSize: 13, color: colors.brand, fontWeight: '600', flex: 1 }}>
                            Replying to {replyingToComment.authorName}
                          </Text>
                          <TouchableOpacity onPress={() => setReplyingToComment(null)}>
                            <Ionicons name="close" size={18} color={colors.brand} />
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                        <TextInput
                          value={commentInput}
                          onChangeText={setCommentInput}
                          placeholder={replyingToComment ? 'Write a reply...' : 'Add a comment...'}
                          placeholderTextColor={colors.placeholder}
                          style={{
                            flex: 1,
                            backgroundColor: colors.inputBg,
                            borderRadius: 22,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            fontSize: 14,
                            color: colors.text,
                          }}
                          onSubmitEditing={() => void handleAddComment()}
                          returnKeyType="send"
                        />
                        <TouchableOpacity
                          onPress={() => void handleAddComment()}
                          disabled={!commentInput.trim()}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: commentInput.trim() ? colors.brand : colors.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="send" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ScrollView>
                );
              })()}
            </KeyboardAvoidingView>
          ) : (
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
                  <TextInput
                    placeholder="Search posts..."
                    placeholderTextColor={colors.placeholder}
                    value={search}
                    onChangeText={setSearch}
                    style={{ flex: 1, fontSize: 14, color: colors.text }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                {(['recent', 'popular'] as const).map((value) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setSort(value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: sort === value ? colors.brand : 'transparent',
                    }}
                  >
                    <Ionicons name={value === 'recent' ? 'time-outline' : 'trending-up-outline'} size={14} color={sort === value ? 'white' : colors.textTertiary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: sort === value ? 'white' : colors.textTertiary, textTransform: 'capitalize' }}>
                      {value}
                    </Text>
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
                    <TouchableOpacity key={post.id} onPress={() => void openPost(post)} activeOpacity={0.8}>
                      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{post.author_name}</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.category}</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 5 }}>{post.title}</Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>
                              {post.body}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={(event: any) => {
                              event.stopPropagation?.();
                              openReport({ id: post.id, type: 'post', label: post.title });
                            }}
                            style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name="flag-outline" size={16} color={colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                          <TouchableOpacity
                            onPress={(event: any) => {
                              event.stopPropagation?.();
                              void togglePostLike(post.id);
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          >
                            <Ionicons name={post.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={15} color={post.liked ? colors.brand : colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: post.liked ? colors.brand : colors.textTertiary, fontWeight: '500' }}>{post.likes}</Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="chatbubble-outline" size={14} color={colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '500' }}>{post.commentCount}</Text>
                          </View>
                        </View>
                      </View>
                      {index < filteredPosts.length - 1 ? (
                        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </Animated.View>
      )}

      <NewPostModal
        visible={showNewPost}
        onClose={() => setShowNewPost(false)}
        boards={BOARDS}
        selectedBoardId={newPostBoardId}
        onSelectBoard={setNewPostBoardId}
        showBoardPicker={showBoardPicker}
        onToggleBoardPicker={() => setShowBoardPicker((value) => !value)}
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

      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
        reason={reportReason}
        onReasonChange={setReportReason}
        details={reportDetails}
        onDetailsChange={setReportDetails}
        onSubmit={() => void submitReport()}
        submitting={submittingReport}
        colors={colors}
      />
    </View>
  );
}

type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  target: ReportTarget | null;
  reason: string;
  onReasonChange: (value: string) => void;
  details: string;
  onDetailsChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
};

function ReportModal({
  visible,
  onClose,
  target,
  reason,
  onReasonChange,
  details,
  onDetailsChange,
  onSubmit,
  submitting,
  colors,
}: ReportModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Report</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 16 }}>
            Tell us what is wrong with {target?.type === 'comment' ? 'this comment' : 'this post'} and we will review it.
          </Text>

          {target ? (
            <View
              style={{
                backgroundColor: colors.bgTertiary,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 4 }}>Target</Text>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '700' }}>{target.label}</Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Reason</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {REPORT_REASONS.map((option) => {
              const active = reason === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => onReasonChange(option)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    backgroundColor: active ? colors.brandBg : colors.bgTertiary,
                  }}
                >
                  <Text style={{ fontSize: 13, color: active ? colors.brand : colors.textSecondary, fontWeight: '600' }}>
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Details</Text>
          <TextInput
            value={details}
            onChangeText={onDetailsChange}
            placeholder="Optional: add more context"
            placeholderTextColor={colors.placeholder}
            multiline
            style={{
              backgroundColor: colors.inputBg,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: 110,
              textAlignVertical: 'top',
              fontSize: 14,
              color: colors.text,
              marginBottom: 18,
            }}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: colors.bgTertiary,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                backgroundColor: '#ef4444',
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
                opacity: submitting ? 0.72 : 1,
              }}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>Send Report</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  colors: ReturnType<typeof useTheme>['colors'];
};

function NewPostModal({
  visible,
  onClose,
  boards,
  selectedBoardId,
  onSelectBoard,
  showBoardPicker,
  onToggleBoardPicker,
  title,
  onTitleChange,
  body,
  onBodyChange,
  preventEdit,
  onPreventEditChange,
  onSubmit,
  submitting,
  colors,
}: NewPostModalProps) {
  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? boards[0];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>New Post</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

          {showBoardPicker ? (
            <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: -16, marginBottom: 20, overflow: 'hidden' }}>
              {boards.map((board, index) => (
                <TouchableOpacity
                  key={board.id}
                  onPress={() => {
                    onSelectBoard(board.id);
                    onToggleBoardPicker();
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: index < boards.length - 1 ? 1 : 0, borderBottomColor: colors.borderSubtle }}
                >
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: board.iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Ionicons name={board.icon} size={14} color={board.color} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{board.name}</Text>
                  {board.id === selectedBoardId ? <Ionicons name="checkmark" size={18} color={colors.brand} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

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

        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity onPress={onClose} style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.inputBg }}>
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
