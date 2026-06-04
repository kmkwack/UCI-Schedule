import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  ActionSheetIOS,
  Animated,
  LayoutAnimation,
  PanResponder,
  Linking,
  Keyboard,
  Image as RNImage,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { campusAliasForId } from '../data/anonymousAliases';
import { colorForDepartment } from '../data/courses';
import { departmentsForSchoolId } from '../data/schoolDepartments';
import { getSchoolConfig } from '../data/schools';
import type { ChatTarget } from '../data/messages';
import { abbreviateMajor } from '../data/userPreferences';
import {
  COMMUNITY_GUIDELINES_MESSAGE,
  evaluateModerationText,
  moderationRulesFromCustomBlocklist,
  moderationUserMessage,
  shouldBlockModerationResult,
  type ModerationPolicyRule,
} from '../data/moderationPolicy';
import { themedIconBackground, themedIconBorder, themedIconColor } from '../utils/themeTint';
import { useKeyboardInset } from '../utils/useKeyboardInset';
import { triggerSuccessHaptic } from '../utils/haptics';
import {
  BACKDROP_DURATION,
  BACKDROP_EXIT_DURATION,
  HORIZONTAL_SWIPE_ACTIVATION_DX,
  HORIZONTAL_SWIPE_DOMINANCE_RATIO,
  MOTION,
  SHEET_CORNER_RADIUS,
  SHEET_DRAG_DISMISS_DISTANCE,
  SHEET_DRAG_DISMISS_VELOCITY,
  SHEET_INITIAL_TRANSLATE_Y,
  SHEET_OUT_DURATION,
  SHEET_RESET_SPRING,
  SHEET_SPRING,
} from '../utils/motion';
import { EmptyState } from '../components/Polish';
import { MiniLoader } from '../components/ScheduleLoader';

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
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
  author_meta: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  parent_comment_id: string | null;
  likes: number;
  liked: boolean;
  replies: CommentNode[];
};

type Post = {
  id: string;
  user_id: string;
  author_name: string;
  author_meta: string | null;
  category: string;
  title: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  likes: number;
  commentCount: number;
  liked: boolean;
  attachments: BoardAttachment[];
  is_locked: boolean;
};

type BoardAttachment = {
  id: string;
  name: string;
  type: 'image' | 'file';
  url?: string;
  path?: string;
  localUri?: string;
  mimeType?: string | null;
  size?: number | null;
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

const FALLBACK_BOARDS: Board[] = [
  { id: 'general', name: 'General Board', category: 'General', icon: 'chatbubbles-outline', color: '#4169E1', iconBg: '#eef1fb' },
  { id: 'sports', name: 'Sports Board', category: 'Sports', icon: 'barbell-outline', color: '#10B981', iconBg: '#ecfdf5' },
  { id: 'study', name: 'Study Groups Board', category: 'Study Groups', icon: 'book-outline', color: '#F59E0B', iconBg: '#fef9ec' },
  { id: 'career', name: 'Career Board', category: 'Career', icon: 'briefcase-outline', color: '#0EA5E9', iconBg: '#f0f9ff' },
  { id: 'market', name: 'Marketplace Board', category: 'Marketplace', icon: 'bag-outline', color: '#8B5CF6', iconBg: '#f5f3ff' },
  { id: 'clubs', name: 'Club Promotions Board', category: 'Club Promotions', icon: 'megaphone-outline', color: '#EC4899', iconBg: '#fdf2f8' },
];

const HOT_BOARD: Board = {
  id: 'hot',
  name: 'Hot Board',
  category: null,
  icon: 'flame-outline',
  color: '#F97316',
  iconBg: '#fff7ed',
};

const REPORT_REASONS = [
  'Spam',
  'Harassment or hate',
  'Inappropriate content',
  'False information',
  'Scam or unsafe transaction',
  'Other',
];

const BOARD_ATTACHMENTS_BUCKET = 'board-attachments';
const DEPARTMENT_BOARD_CATEGORY_PREFIX = 'Department: ';
const BOARD_TAB_BAR_CLEARANCE = 96;
const SUPPORTED_BOARD_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const BOARD_FILE_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function departmentBoardCategory(department: string) {
  return `${DEPARTMENT_BOARD_CATEGORY_PREFIX}${department}`;
}

function departmentFromCategory(category: string) {
  return category.startsWith(DEPARTMENT_BOARD_CATEGORY_PREFIX)
    ? category.slice(DEPARTMENT_BOARD_CATEGORY_PREFIX.length)
    : null;
}

function boardContextLabel(category: string) {
  if (!category || category === 'General') return 'Post';
  return `Post / ${departmentFromCategory(category) ?? category}`;
}

function boardCategory(board: Board) {
  return board.category ?? 'General';
}

function isServerModerationError(error: { message?: string } | null | undefined) {
  return typeof error?.message === 'string' && error.message.includes('ClassMate moderation policy');
}

function supportedMimeTypeForAttachmentName(name: string, mimeType?: string | null) {
  const normalizedMime = mimeType?.toLowerCase();
  if (normalizedMime && SUPPORTED_BOARD_FILE_MIME_TYPES.has(normalizedMime)) return normalizedMime;
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return BOARD_FILE_MIME_BY_EXTENSION[extension] ?? null;
}

function withDefaultBoards(remoteBoards: Board[]) {
  const seenCategories = new Set(remoteBoards.map((board) => boardCategory(board).toLowerCase()));
  const missingDefaults = FALLBACK_BOARDS.filter((board) => !seenCategories.has(boardCategory(board).toLowerCase()));
  return [...remoteBoards, ...missingDefaults];
}

function isHotBoard(board: Board | null) {
  return board?.id === HOT_BOARD.id;
}

function boardListDescription(board: Board) {
  const category = boardCategory(board);
  if (category === 'General') return 'Everyday chat';
  if (category === 'Sports') return 'Find your sports crew';
  if (category === 'Study Groups') return 'Find study partners';
  if (category === 'Career') return 'Career information';
  if (category === 'Marketplace') return 'Buy, sell, and trade';
  if (category === 'Club Promotions') return 'Club events and announcements';
  const department = departmentFromCategory(category);
  if (department) return `${department} classes and department talk`;
  return 'Student posts and campus updates';
}

function departmentBoardFor(department: string): Board {
  const color = colorForDepartment(department);
  return {
    id: `department-${department.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: `${department} Board`,
    category: departmentBoardCategory(department),
    icon: 'school-outline',
    color,
    iconBg: `${color}18`,
  };
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

function formatFileSize(size?: number | null) {
  if (!size || Number.isNaN(size)) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeAttachments(value: unknown): BoardAttachment[] {
  if (!Array.isArray(value)) return [];
  const normalized: BoardAttachment[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const candidate = item as Record<string, unknown>;
    const type = candidate.type === 'image' ? 'image' : 'file';
    const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : `Attachment ${index + 1}`;
    const url = typeof candidate.url === 'string' ? candidate.url : undefined;
    const path = typeof candidate.path === 'string' ? candidate.path : undefined;
    normalized.push({
      id: typeof candidate.id === 'string' ? candidate.id : `${type}-${index}-${name}`,
      name,
      type,
      url,
      path,
      mimeType: typeof candidate.mimeType === 'string' ? candidate.mimeType : null,
      size: typeof candidate.size === 'number' ? candidate.size : null,
    });
  });
  return normalized;
}

function isImageAttachment(attachment: BoardAttachment) {
  return attachment.type === 'image' || attachment.mimeType?.startsWith('image/');
}

function attachmentUri(attachment: BoardAttachment) {
  return attachment.localUri ?? attachment.url ?? '';
}

function isNetworkRequestError(error: unknown) {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed')
  );
}

function isMissingSchemaError(error: unknown) {
  const message = String((error as { message?: unknown } | null | undefined)?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the') ||
    (error as { code?: unknown } | null | undefined)?.code === 'PGRST205'
  );
}

function BoardAttachmentImage({
  uri,
  style,
  colors,
  contentFit = 'cover',
}: {
  uri: string;
  style: any;
  colors: ReturnType<typeof useTheme>['colors'];
  contentFit?: 'cover' | 'contain';
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View
        style={[
          style,
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bgTertiary,
          },
        ]}
      >
        <Ionicons name="image-outline" size={22} color={colors.textTertiary} />
        <Text style={{ marginTop: 6, fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>
          Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <RNImage
      source={{ uri }}
      resizeMode={contentFit === 'cover' ? 'cover' : 'contain'}
      onError={() => {
        setFailed(true);
      }}
      style={style}
    />
  );
}

function BoardPostImage({
  attachment,
  colors,
  onPress,
}: {
  attachment: BoardAttachment;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
}) {
  const uri = attachmentUri(attachment);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!uri) {
      setAspectRatio(null);
      return;
    }

    let active = true;
    RNImage.getSize(
      uri,
      (width, height) => {
        if (!active || width <= 0 || height <= 0) return;
        setAspectRatio(width / height);
      },
      () => {
        if (active) setAspectRatio(null);
      }
    );

    return () => {
      active = false;
    };
  }, [uri]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: colors.bgTertiary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      <BoardAttachmentImage
        uri={uri}
        colors={colors}
        contentFit="contain"
        style={{
          width: '100%',
          aspectRatio: aspectRatio ?? 4 / 3,
          minHeight: 160,
          backgroundColor: colors.bgTertiary,
        }}
      />
    </TouchableOpacity>
  );
}

function extensionFromName(name: string) {
  const parts = name.split('.');
  if (parts.length < 2) return null;
  const extension = parts.pop()?.trim().toLowerCase();
  return extension || null;
}

function imageExtensionForAttachment(attachment: BoardAttachment) {
  const extension = attachment.name.split('.').pop()?.toLowerCase();
  if (extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension)) return extension;

  const mime = attachment.mimeType?.toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

async function cacheImageAttachment(attachment: BoardAttachment, remoteUrl: string) {
  if (!isImageAttachment(attachment) || Platform.OS === 'web' || !FileSystem.cacheDirectory) {
    return attachment;
  }

  try {
    const safeId = sanitizeFileName(attachment.path ?? attachment.id) || `image-${attachment.id}`;
    const localUri = `${FileSystem.cacheDirectory}board-${Date.now()}-${safeId}.${imageExtensionForAttachment(attachment)}`;

    const downloaded = await FileSystem.downloadAsync(remoteUrl, localUri);
    const info = await FileSystem.getInfoAsync(downloaded.uri);
    if ('size' in info && typeof info.size === 'number' && info.size <= 0) {
      await FileSystem.deleteAsync(downloaded.uri, { idempotent: true });
      return { ...attachment, url: remoteUrl, localUri: undefined };
    }
    return { ...attachment, localUri: downloaded.uri, url: remoteUrl };
  } catch (error) {
    if (!isNetworkRequestError(error)) console.warn('Failed to cache board image attachment:', error);
    return { ...attachment, url: remoteUrl };
  }
}

async function resolveAttachmentDisplayUrls(attachments: BoardAttachment[]) {
  return Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment.path) return attachment;

      const { data, error } = await supabase.storage
        .from(BOARD_ATTACHMENTS_BUCKET)
        .createSignedUrl(attachment.path, 60 * 60 * 24 * 7);

      if (!error && data?.signedUrl) {
        return cacheImageAttachment(attachment, data.signedUrl);
      }

      const { data: publicData } = supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(attachment.path);
      return publicData?.publicUrl ? cacheImageAttachment(attachment, publicData.publicUrl) : attachment;
    })
  );
}

function isHeicImage(name?: string | null, mimeType?: string | null) {
  const lowerName = name?.toLowerCase() ?? '';
  const lowerMime = mimeType?.toLowerCase() ?? '';
  return lowerMime === 'image/heic' || lowerMime === 'image/heif' || lowerName.endsWith('.heic') || lowerName.endsWith('.heif');
}

function jpegNameForImage(name: string, fallbackName: string) {
  const baseName = (name.trim() || fallbackName).replace(/\.[^.]+$/i, '').trim() || fallbackName.replace(/\.[^.]+$/i, '');
  return `${baseName}.jpg`;
}

async function readLocalFileAsArrayBuffer(uri: string) {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error('Selected file is no longer available. Please choose it again.');
  }
  if ('size' in fileInfo && typeof fileInfo.size === 'number' && fileInfo.size <= 0) {
    throw new Error('Selected file is empty. Please choose another file.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decode(base64);
}

function fileExtensionForAttachment(attachment: BoardAttachment) {
  const extension = attachment.name.split('.').pop();
  if (extension && extension !== attachment.name) return extension.toLowerCase();
  const mime = attachment.mimeType?.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'txt';
  if (mime === 'application/msword') return 'doc';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mime === 'application/vnd.ms-powerpoint') return 'ppt';
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (mime === 'application/vnd.ms-excel') return 'xls';
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  return 'file';
}

function fileUtiForAttachment(attachment: BoardAttachment) {
  const extension = fileExtensionForAttachment(attachment);
  if (extension === 'pdf') return 'com.adobe.pdf';
  if (extension === 'txt') return 'public.plain-text';
  if (extension === 'doc') return 'com.microsoft.word.doc';
  if (extension === 'docx') return 'org.openxmlformats.wordprocessingml.document';
  if (extension === 'ppt') return 'com.microsoft.powerpoint.ppt';
  if (extension === 'pptx') return 'org.openxmlformats.presentationml.presentation';
  if (extension === 'xls') return 'com.microsoft.excel.xls';
  if (extension === 'xlsx') return 'org.openxmlformats.spreadsheetml.sheet';
  return undefined;
}

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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

function hasCommentReplies(comment: CommentNode) {
  return comment.replies.length > 0;
}

function removeCommentFromTree(nodes: CommentNode[], commentId: string): CommentNode[] {
  return nodes.flatMap((node) => {
    if (node.id === commentId) return node.replies;
    if (node.replies.length === 0) return [node];
    return [{ ...node, replies: removeCommentFromTree(node.replies, commentId) }];
  });
}

function buildCommentTree(rows: CommentRow[], votes: CommentVoteRow[], userId: string, authorNames: Record<string, string>, school: string) {
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
      author_name: authorNames[row.user_id] ?? campusAliasForId(row.user_id, school),
      author_meta: null,
      content: row.content,
      created_at: row.created_at,
      edited_at: row.edited_at ?? null,
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

type AuthorSummary = {
  displayName: string;
  meta: string | null;
};

type AuthorProfileMetadata = {
  id?: string | null;
  user_id?: string | null;
  major?: string | null;
  year?: string | null;
};

function formatAuthorMeta(major?: string | null, year?: string | null, verified = false) {
  const parts = [abbreviateMajor(major), year?.trim()].filter(Boolean);
  if (parts.length === 0 && verified) return 'Verified student';
  return parts.length > 0 ? parts.join(' · ') : null;
}

type Props = {
  school: string;
  userId: string;
  boardAuthorName: string;
  boardProfileVisible: boolean;
  topInset?: number;
  bottomInset?: number;
  scrollToTopTrigger?: number;
  onOpenMessages?: () => void;
  onOpenChat?: (target: ChatTarget) => void;
  unreadMessageCount?: number;
  openPostId?: string | null;
  openPostRequestId?: number;
  onOpenPostHandled?: (postId: string) => void;
};

export default function BoardScreen({
  school,
  userId,
  topInset = 0,
  bottomInset = 0,
  scrollToTopTrigger = 0,
  onOpenMessages,
  onOpenChat,
  unreadMessageCount = 0,
  openPostId = null,
  openPostRequestId = 0,
  onOpenPostHandled,
}: Props) {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const screenWidthRef = useRef(screenWidth);
  useEffect(() => { screenWidthRef.current = screenWidth; }, [screenWidth]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; authorName: string } | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; authorName: string } | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostBody, setNewPostBody] = useState('');
  const [newPostBoardId, setNewPostBoardId] = useState('general');
  const [newPostAttachments, setNewPostAttachments] = useState<BoardAttachment[]>([]);
  const [newPostLocked, setNewPostLocked] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [imageViewerAttachment, setImageViewerAttachment] = useState<BoardAttachment | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const customModerationRulesRef = useRef<ModerationPolicyRule[]>([]);
  const [showRequestBoard, setShowRequestBoard] = useState(false);
  const [requestBoardName, setRequestBoardName] = useState('');
  const [requestBoardDesc, setRequestBoardDesc] = useState('');
  const [submittingBoardRequest, setSubmittingBoardRequest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [boards, setBoards] = useState<Board[]>(FALLBACK_BOARDS);
  const [showDepartmentBoards, setShowDepartmentBoards] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [departmentCodes, setDepartmentCodes] = useState<string[]>([]);

  const boardSlideAnim = useRef(new Animated.Value(screenWidth)).current;
  const postsCacheKey = `board_posts_${school}_${userId}`;
  const boardsCacheKey = `board_catalog_${school}`;
  const boardLastSeenKey = `board_last_seen_${school}_${userId}`;
  // Set of board categories that have posts newer than last-seen
  const [newBoardCategories, setNewBoardCategories] = useState<Set<string>>(new Set());
  const boardListScrollRef = useRef<ScrollView>(null);
  const selectedPostScrollRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const postsRef = useRef<Post[]>([]);
  const handledOpenPostRequestRef = useRef<string | null>(null);
  const boardKeyboard = useKeyboardInset({ bottomInset });
  const boardKeyboardVisible = boardKeyboard.visible;
  const shouldShowCommentComposer =
    commentComposerOpen ||
    boardKeyboardVisible ||
    !!replyingToComment ||
    !!editingComment ||
    commentInput.trim().length > 0;
  const commentComposerBottomPadding = boardKeyboardVisible ? 8 : 12;
  const commentComposerBottomMargin = boardKeyboardVisible ? 0 : bottomInset + BOARD_TAB_BAR_CLEARANCE;
  const selectedPostScrollBottomPadding = shouldShowCommentComposer
    ? (boardKeyboardVisible ? 88 : 112 + bottomInset + BOARD_TAB_BAR_CLEARANCE)
    : bottomInset + BOARD_TAB_BAR_CLEARANCE + 40;
  const scrollSelectedPostToComposer = useCallback((animated = true, delay = 0) => {
    const run = () => selectedPostScrollRef.current?.scrollToEnd({ animated });
    if (delay > 0) {
      setTimeout(run, delay);
      return;
    }
    requestAnimationFrame(run);
  }, []);
  const settleSelectedPostComposer = useCallback((animated = true) => {
    [0, 80, 180, 340].forEach((delay) => scrollSelectedPostToComposer(animated, delay));
  }, [scrollSelectedPostToComposer]);
  const openSelectedPostCommentComposer = useCallback(() => {
    setCommentComposerOpen(true);
    requestAnimationFrame(() => {
      commentInputRef.current?.focus();
      settleSelectedPostComposer(true);
    });
  }, [settleSelectedPostComposer]);
  const schoolConfig = useMemo(() => getSchoolConfig(school), [school]);
  const localDepartmentOptions = useMemo(() => departmentsForSchoolId(schoolConfig.id), [schoolConfig.id]);
  const departmentBoards = useMemo(() => departmentCodes.map(departmentBoardFor), [departmentCodes]);
  const hotPosts = useMemo(() => {
    return posts
      .filter((post) => post.likes > 10)
      .sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        if (b.commentCount !== a.commentCount) return b.commentCount - a.commentCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [posts]);
  const composerBoards = useMemo(() => {
    if (selectedBoard && departmentFromCategory(selectedBoard.category ?? '')) {
      return [selectedBoard, ...boards];
    }
    return boards;
  }, [boards, selectedBoard]);

  const swipeBoardPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dx > HORIZONTAL_SWIPE_ACTIVATION_DX && Math.abs(gs.dx) > Math.abs(gs.dy) * HORIZONTAL_SWIPE_DOMINANCE_RATIO,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) boardSlideAnim.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > screenWidthRef.current * 0.35 || gs.vx > 0.6) {
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
    setDepartmentCodes(localDepartmentOptions);
    void fetchBoards();
    void fetchDepartmentBoards();
    void fetchPosts();
    void fetchBlockedUsers();
    void fetchBannedWords();
  }, [localDepartmentOptions, school, userId]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    if (scrollToTopTrigger > 0) boardListScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopTrigger]);

  useEffect(() => {
    if (boardKeyboard.visible && selectedPost) settleSelectedPostComposer(true);
  }, [boardKeyboard.visible, selectedPost, settleSelectedPostComposer]);

  function resetComposer() {
    setEditingPostId(null);
    setShowBoardPicker(false);
    setNewPostTitle('');
    setNewPostBody('');
    setNewPostBoardId(selectedBoard?.id ?? boards[0]?.id ?? '');
    setNewPostAttachments([]);
    setNewPostLocked(false);
  }

  function closeComposer() {
    setShowNewPost(false);
    resetComposer();
  }

  function currentAuthorSummary(): AuthorSummary {
    return {
      displayName: campusAliasForId(userId, school),
      meta: null,
    };
  }

  async function resolveCurrentAuthorSummary(): Promise<AuthorSummary> {
    const summaries = await resolveAuthorSummaries([userId]);
    return summaries[userId] ?? currentAuthorSummary();
  }

  async function resolveAuthorSummaries(userIds: string[]): Promise<Record<string, AuthorSummary>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const validIds = uniqueIds.filter(isUuid);
    const invalidAuthorMap = Object.fromEntries(
      uniqueIds
        .filter((id) => !isUuid(id))
        .map((id) => [id, { displayName: campusAliasForId(id, school), meta: null }])
    );

    if (validIds.length === 0) return invalidAuthorMap;

    let profileRows: AuthorProfileMetadata[] = [];
    const { data: metadataData, error: metadataError } = await supabase.rpc('get_board_author_metadata', {
      author_ids: validIds,
      target_school: school,
    });

    if (!metadataError) {
      profileRows = (metadataData ?? []) as AuthorProfileMetadata[];
    } else {
      if (metadataError.code !== 'PGRST202' && !isNetworkRequestError(metadataError)) {
        console.warn('Failed to load verified board author metadata:', metadataError);
      }
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, major, year')
        .eq('school', school)
        .in('id', validIds);

      if (profilesError && !isNetworkRequestError(profilesError)) {
        console.warn('Failed to load board profile metadata:', profilesError);
      }
      profileRows = (profilesData ?? []) as AuthorProfileMetadata[];
    }

    const profilesById = Object.fromEntries(
      profileRows
        .map((row) => [row.user_id ?? row.id, row] as const)
        .filter((entry): entry is readonly [string, AuthorProfileMetadata] => !!entry[0])
    );

    return {
      ...invalidAuthorMap,
      ...Object.fromEntries(
        validIds.map((id) => {
          const profile = profilesById[id];
          return [
            id,
            {
              displayName: campusAliasForId(id, school),
              meta: formatAuthorMeta(profile?.major, profile?.year, !!profile),
            },
          ];
        })
      ),
    };
  }

  async function uploadAttachment(attachment: BoardAttachment) {
    if (attachment.url || !attachment.localUri) return attachment;

    const inferredExtension =
      extensionFromName(attachment.name) ||
      attachment.mimeType?.split('/').pop() ||
      (attachment.type === 'image' ? 'jpg' : 'bin');
    const fileNameBase = sanitizeFileName(attachment.name.replace(/\.[^.]+$/, '')) || `${attachment.type}-attachment`;
    const path = `${userId}/${Date.now()}-${attachment.id}-${fileNameBase}.${inferredExtension}`;

    const fileBody = await readLocalFileAsArrayBuffer(attachment.localUri);
    const { error } = await supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).upload(path, fileBody, {
      contentType: attachment.mimeType ?? undefined,
      upsert: false,
    });

    if (error) throw error;

    const [{ data: signedData }, { data: publicData }] = await Promise.all([
      supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7),
      Promise.resolve(supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).getPublicUrl(path)),
    ]);

    return {
      ...attachment,
      url: signedData?.signedUrl ?? publicData.publicUrl,
      path,
      localUri: undefined,
    };
  }

  async function removeStoragePaths(paths: string[]) {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(BOARD_ATTACHMENTS_BUCKET).remove(paths);
    if (error) console.error('Failed to delete board attachments:', error);
  }

  async function openAttachment(attachment: BoardAttachment) {
    const [resolvedAttachment] = await resolveAttachmentDisplayUrls([attachment]);

    if (!resolvedAttachment.url) {
      Alert.alert('File unavailable', 'This attachment does not have a downloadable file yet.');
      return;
    }

    if (isImageAttachment(resolvedAttachment)) return;

    try {
      const Sharing = await import('expo-sharing');
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable || !FileSystem.cacheDirectory) {
        await Linking.openURL(resolvedAttachment.url);
        return;
      }

      const extension = fileExtensionForAttachment(resolvedAttachment);
      const safeBaseName = sanitizeFileName(resolvedAttachment.name.replace(/\.[^.]+$/, '')) || 'board-attachment';
      const safeFileName = `${safeBaseName}.${extension}`;
      const localUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeFileName}`;
      const downloaded = await FileSystem.downloadAsync(resolvedAttachment.url, localUri);

      if (Platform.OS === 'ios') {
        try {
          await Linking.openURL(downloaded.uri);
          return;
        } catch {
          // Fall through to the native share/preview sheet with stronger file type hints.
        }
      }

      await Sharing.shareAsync(downloaded.uri, {
        mimeType: resolvedAttachment.mimeType ?? undefined,
        UTI: fileUtiForAttachment(resolvedAttachment),
        dialogTitle: resolvedAttachment.name,
      });
    } catch (error: any) {
      Alert.alert('Could not open file', error?.message ?? 'Try again in a moment.');
    }
  }

  async function localImageUriForSaving(attachment: BoardAttachment) {
    const [resolvedAttachment] = await resolveAttachmentDisplayUrls([attachment]);
    const uri = attachmentUri(resolvedAttachment);

    if (!uri) {
      throw new Error('This image is not available yet.');
    }

    if (!/^https?:\/\//i.test(uri)) {
      return uri;
    }

    if (!FileSystem.cacheDirectory) {
      throw new Error('Image saving is not available on this device.');
    }

    const extension = imageExtensionForAttachment(resolvedAttachment);
    const safeId = sanitizeFileName(resolvedAttachment.path ?? resolvedAttachment.id) || `board-image-${Date.now()}`;
    const localUri = `${FileSystem.cacheDirectory}board-save-${Date.now()}-${safeId}.${extension}`;
    const downloaded = await FileSystem.downloadAsync(uri, localUri);
    return downloaded.uri;
  }

  async function saveImageAttachment(attachment: BoardAttachment) {
    if (Platform.OS === 'web') {
      const uri = attachmentUri(attachment);
      if (uri) await Linking.openURL(uri);
      return;
    }

    try {
      setSavingImage(true);
      const MediaLibrary = await import('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photos access needed', 'Allow photo library access to save this image.');
        return;
      }

      const localUri = await localImageUriForSaving(attachment);
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('Saved', 'The image has been saved to your photo library.');
    } catch (error: any) {
      Alert.alert('Could not save image', error?.message ?? 'Try again in a moment.');
    } finally {
      setSavingImage(false);
    }
  }

  async function handlePickImages() {
    let ImagePicker;
    try {
      ImagePicker = await import('expo-image-picker');
    } catch {
      Alert.alert(
        'Images need the installed app',
        'Image attachments are available in the TestFlight app or a development build, but not in this Expo Go preview.'
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'Allow photo library access so you can attach images to your post.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 8,
    });

    if (result.canceled || !result.assets?.length) return;

    try {
      const picked = await Promise.all(
        result.assets.map(async (asset, index) => {
          const fallbackName = `image-${index + 1}.jpg`;
          const originalName = asset.fileName || fallbackName;
          let localUri = asset.uri;

          try {
            const ImageManipulator = await import('expo-image-manipulator');
            const converted = await ImageManipulator.manipulateAsync(asset.uri, [], {
              compress: 0.9,
              format: ImageManipulator.SaveFormat.JPEG,
            });
            localUri = converted.uri;
          } catch {
            localUri = asset.uri;
          }

          return {
            id: `${Date.now()}-image-${index}-${Math.random().toString(36).slice(2, 8)}`,
            name: jpegNameForImage(originalName, fallbackName),
            type: 'image' as const,
            localUri,
            mimeType: 'image/jpeg',
            size: null,
          };
        })
      );

      setNewPostAttachments((prev) => [...prev, ...picked]);
    } catch (error: any) {
      Alert.alert('Image could not be prepared', error?.message ?? 'Try choosing the photo again.');
    }
  }

  async function handlePickFiles() {
    let result;
    try {
      const DocumentPicker = await import('expo-document-picker');
      result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: '*/*',
      });
    } catch (error: any) {
      Alert.alert(
        'Files need the installed app',
        'File attachments are available in the TestFlight app or a development build, but not in this Expo Go preview.'
      );
      return;
    }

    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets.flatMap((asset, index) => {
      const mimeType = supportedMimeTypeForAttachmentName(asset.name, asset.mimeType);
      if (!mimeType) return [];
      return [{
        id: `${Date.now()}-file-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: asset.name,
        type: 'file' as const,
        localUri: asset.uri,
        mimeType,
        size: asset.size ?? null,
      }];
    });

    if (picked.length < result.assets.length) {
      Alert.alert(
        'Some files were skipped',
        'ClassMate supports images, PDFs, text files, Word, PowerPoint, and Excel documents.'
      );
    }

    setNewPostAttachments((prev) => [...prev, ...picked]);
  }

  function removeDraftAttachment(attachmentId: string) {
    setNewPostAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }

  function hydrateAttachmentUrlsForPosts(postsToHydrate: Post[]) {
    const postsWithAttachmentPaths = postsToHydrate.filter((post) =>
      post.attachments.some((attachment) => attachment.path)
    );
    if (postsWithAttachmentPaths.length === 0) return;

    void Promise.all(
      postsWithAttachmentPaths.map(async (post) => ({
        id: post.id,
        attachments: await resolveAttachmentDisplayUrls(post.attachments),
      }))
    ).then((hydrated) => {
      const hydratedMap = new Map(hydrated.map((post) => [post.id, post.attachments]));
      setPosts((prev) =>
        prev.map((post) => {
          const attachments = hydratedMap.get(post.id);
          return attachments ? { ...post, attachments } : post;
        })
      );
      setSelectedPost((prev) => {
        if (!prev) return prev;
        const attachments = hydratedMap.get(prev.id);
        return attachments ? { ...prev, attachments } : prev;
      });
    }).catch((error) => {
      if (!isNetworkRequestError(error)) console.warn('Failed to hydrate board attachment URLs:', error);
    });
  }

  async function fetchPosts() {
    try {
      const cached = await AsyncStorage.getItem(postsCacheKey);
      if (cached) {
        try {
          const cachedPosts = (JSON.parse(cached) as Post[]).map((post) => ({
            ...post,
            author_name: campusAliasForId(post.user_id, school),
            author_meta: typeof post.author_meta === 'string' ? post.author_meta : null,
            attachments: normalizeAttachments(post.attachments),
          }));
          postsRef.current = cachedPosts;
          setPosts(cachedPosts);
          hydrateAttachmentUrlsForPosts(cachedPosts);
        } catch {}
      }
    } catch (error) {
      if (!isNetworkRequestError(error)) console.warn('Failed to read cached board posts:', error);
    }

    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('school', school)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !postsData) {
        if (error && !isNetworkRequestError(error)) console.warn('Failed to refresh board posts:', error);
        return;
      }

      if (postsData.length === 0) {
        postsRef.current = [];
        setPosts([]);
        await AsyncStorage.setItem(postsCacheKey, JSON.stringify([]));
        return;
      }

      const postIds = postsData.map((post: any) => post.id);
      const [{ data: votesData }, { data: commentsData }, authorSummaries] = await Promise.all([
        supabase.from('post_votes').select('post_id, user_id').eq('school', school).in('post_id', postIds),
        supabase.from('post_comments').select('id, post_id').eq('school', school).in('post_id', postIds),
        resolveAuthorSummaries(postsData.map((post: any) => post.user_id)),
      ]);

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
        author_name: authorSummaries[post.user_id]?.displayName ?? campusAliasForId(post.user_id, school),
        author_meta: authorSummaries[post.user_id]?.meta ?? null,
        category: post.category ?? 'General',
        title: post.title,
        body: post.body ?? '',
        created_at: post.created_at,
        edited_at: post.edited_at ?? post.updated_at ?? null,
        likes: likeCountMap[post.id] ?? 0,
        commentCount: commentCountMap[post.id] ?? 0,
        liked: userLikedSet.has(post.id),
        attachments: normalizeAttachments(post.attachments),
        is_locked: !!post.is_locked,
      }));

      postsRef.current = freshPosts;
      setPosts(freshPosts);
      await AsyncStorage.setItem(postsCacheKey, JSON.stringify(freshPosts));
      hydrateAttachmentUrlsForPosts(freshPosts);

      // Compute which boards have new posts since last visit
      try {
        const lastSeenAt = await AsyncStorage.getItem(boardLastSeenKey);
        if (lastSeenAt) {
          const lastSeenTime = new Date(lastSeenAt).getTime();
          const newCats = new Set(
            freshPosts
              .filter((p) => new Date(p.created_at ?? '').getTime() > lastSeenTime)
              .map((p) => (p.category ?? 'General') as string)
          );
          setNewBoardCategories(newCats);
        }
      } catch {}

    } catch (error) {
      if (!isNetworkRequestError(error)) console.warn('Failed to refresh board posts:', error);
    }
  }

  async function fetchBoards() {
    try {
      const cached = await AsyncStorage.getItem(boardsCacheKey);
      if (cached) {
        const cachedBoards = JSON.parse(cached) as Board[];
        if (Array.isArray(cachedBoards) && cachedBoards.length > 0) {
          setBoards(withDefaultBoards(cachedBoards));
        }
      }
    } catch (error) {
      if (!isNetworkRequestError(error)) console.warn('Failed to read cached boards:', error);
    }

    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('school', school)
        .order('created_at', { ascending: true });

      if (error) {
        if (!isNetworkRequestError(error)) console.warn('Failed to refresh boards:', error);
        return;
      }

      if (data && data.length > 0) {
        const freshBoards = (data as Array<{
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          icon: string;
          color: string;
          icon_bg: string;
        }>).map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          icon: row.icon as React.ComponentProps<typeof Ionicons>['name'],
          color: row.color,
          iconBg: row.icon_bg,
        }));
        const mergedBoards = withDefaultBoards(freshBoards);
        setBoards(mergedBoards);
        await AsyncStorage.setItem(boardsCacheKey, JSON.stringify(mergedBoards));
      }
    } catch (error) {
      if (!isNetworkRequestError(error)) console.warn('Failed to refresh boards:', error);
    }
  }

  async function fetchDepartmentBoards() {
    const departmentsSet = new Set<string>(localDepartmentOptions);

    try {
      const { data: departmentRows, error: departmentError } = await supabase
        .from('school_departments')
        .select('department')
        .eq('school', school)
        .eq('active', true)
        .order('department', { ascending: true });

      if (departmentError) {
        if (!isMissingSchemaError(departmentError) && !isNetworkRequestError(departmentError)) {
          console.warn('Failed to load school department boards:', departmentError);
        }
      } else {
        (departmentRows ?? []).forEach((row: any) => {
          if (row.department) departmentsSet.add(String(row.department).trim());
        });
      }

      const nextDepartments = Array.from(departmentsSet)
        .map((department) => department.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setDepartmentCodes(nextDepartments);
    } catch (error) {
      if (!isNetworkRequestError(error)) console.warn('Failed to refresh department boards:', error);
      setDepartmentCodes(localDepartmentOptions);
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([fetchBoards(), fetchDepartmentBoards(), fetchPosts()]);
      if (selectedPost) {
        await loadCommentsForPost(selectedPost.id);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function loadCommentsForPost(postId: string) {
    setCommentsLoading(true);
    const { data: commentsData, error: commentsError } = await supabase
      .from('post_comments')
      .select('*')
      .eq('school', school)
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
    const [{ data: commentVoteData, error: commentVotesError }, authorSummaries] = await Promise.all([
      commentIds.length > 0
        ? supabase.from('post_comment_votes').select('comment_id, user_id').eq('school', school).in('comment_id', commentIds)
        : Promise.resolve({ data: [], error: null }),
      resolveAuthorSummaries(commentRows.map((comment) => comment.user_id)),
    ]);

    if (commentVotesError && (commentVotesError as any).code !== 'PGRST205') {
      console.error('Failed to load comment likes:', commentVotesError);
    }

    const authorNames = Object.fromEntries(
      Object.entries(authorSummaries).map(([id, summary]) => [id, summary.displayName])
    );
    const commentTree = buildCommentTree(commentRows, ((commentVoteData ?? []) as CommentVoteRow[]), userId, authorNames, school).map(
      (comment) => comment
    );
    const attachMeta = (nodes: CommentNode[]): CommentNode[] =>
      nodes.map((node) => ({
        ...node,
        author_meta: authorSummaries[node.user_id]?.meta ?? null,
        replies: attachMeta(node.replies),
      }));
    setComments(attachMeta(commentTree));
    setCommentsLoading(false);
  }

  async function openPost(post: Post) {
    setSelectedPost(post);
    setReplyingToComment(null);
    setEditingComment(null);
    setCommentInput('');
    setCommentComposerOpen(false);
    await loadCommentsForPost(post.id);
  }

  async function openPostFromBoardList(post: Post) {
    Keyboard.dismiss();
    const postDepartment = departmentFromCategory(post.category);
    const targetBoard =
      boards.find((board) => boardCategory(board) === post.category) ??
      (postDepartment ? departmentBoardFor(postDepartment) : null) ??
      boards.find((board) => boardCategory(board) === 'General') ??
      boards[0];

    boardSlideAnim.setValue(screenWidthRef.current);
    setSelectedBoard(targetBoard);
    setSelectedPost(post);
    setReplyingToComment(null);
    setEditingComment(null);
    setCommentInput('');
    setCommentComposerOpen(false);
    Animated.spring(boardSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 16,
    }).start();
    await loadCommentsForPost(post.id);
  }

  async function fetchPostById(postId: string): Promise<Post | null> {
    const { data: postData, error } = await supabase
      .from('posts')
      .select('*')
      .eq('school', school)
      .eq('id', postId)
      .maybeSingle();

    if (error) {
      if (!isNetworkRequestError(error)) console.warn('Failed to load linked board post:', error);
      return null;
    }

    if (!postData) return null;

    const [{ data: votesData }, { data: commentsData }, authorSummaries] = await Promise.all([
      supabase.from('post_votes').select('post_id, user_id').eq('school', school).eq('post_id', postId),
      supabase.from('post_comments').select('id, post_id').eq('school', school).eq('post_id', postId),
      resolveAuthorSummaries([(postData as any).user_id]),
    ]);

    const row = postData as any;
    return {
      id: row.id,
      user_id: row.user_id,
      author_name: authorSummaries[row.user_id]?.displayName ?? campusAliasForId(row.user_id, school),
      author_meta: authorSummaries[row.user_id]?.meta ?? null,
      category: row.category ?? 'General',
      title: row.title,
      body: row.body ?? '',
      created_at: row.created_at,
      edited_at: row.edited_at ?? row.updated_at ?? null,
      likes: (votesData ?? []).length,
      commentCount: (commentsData ?? []).length,
      liked: (votesData ?? []).some((vote: any) => vote.user_id === userId),
      attachments: normalizeAttachments(row.attachments),
      is_locked: !!row.is_locked,
    };
  }

  async function openPostById(postId: string) {
    const existingPost = postsRef.current.find((post) => post.id === postId);
    if (existingPost) {
      await openPostFromBoardList(existingPost);
      return;
    }

    const linkedPost = await fetchPostById(postId);
    if (!linkedPost) {
      Alert.alert('Post unavailable', 'This board post may have been deleted.');
      return;
    }

    postsRef.current = [linkedPost, ...postsRef.current.filter((post) => post.id !== linkedPost.id)];
    setPosts(postsRef.current);
    hydrateAttachmentUrlsForPosts([linkedPost]);
    await openPostFromBoardList(linkedPost);
  }

  useEffect(() => {
    if (!openPostId || !openPostRequestId) return;
    const requestKey = `${openPostRequestId}:${openPostId}`;
    if (handledOpenPostRequestRef.current === requestKey) return;
    handledOpenPostRequestRef.current = requestKey;

    void openPostById(openPostId).finally(() => {
      onOpenPostHandled?.(openPostId);
    });
  }, [openPostId, openPostRequestId]);

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
      await supabase.from('post_votes').delete().eq('school', school).eq('post_id', postId).eq('user_id', userId);
    } else {
      await supabase.from('post_votes').insert({ school, post_id: postId, user_id: userId });
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
      ? supabase.from('post_comment_votes').delete().eq('school', school).eq('comment_id', commentId).eq('user_id', userId)
      : supabase.from('post_comment_votes').insert({ school, comment_id: commentId, user_id: userId });

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

  function startEditComment(comment: CommentNode) {
    if (comment.user_id !== userId) return;
    setEditingComment({ id: comment.id, authorName: comment.author_name });
    setReplyingToComment(null);
    setCommentInput(comment.content);
    setCommentComposerOpen(true);
    requestAnimationFrame(() => commentInputRef.current?.focus());
  }

  async function handleDeleteComment(comment: CommentNode) {
    if (comment.user_id !== userId) return;

    const hasReplies = hasCommentReplies(comment);
    Alert.alert('Delete comment?', hasReplies ? 'This will remove your comment and keep its replies in the thread.' : 'This will permanently remove your comment.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            let { error } = await supabase.rpc('delete_own_comment', { target_comment_id: comment.id });

            if (error) {
              if (hasReplies) {
                await supabase
                  .from('post_comments')
                  .update({ parent_comment_id: comment.parent_comment_id })
                  .eq('school', school)
                  .eq('parent_comment_id', comment.id);
              }

              await supabase.from('post_comment_votes').delete().eq('school', school).eq('comment_id', comment.id);
              const fallback = await supabase.from('post_comments').delete().eq('school', school).eq('id', comment.id).eq('user_id', userId);
              error = fallback.error;
            }

            if (error) {
              Alert.alert(
                'Delete failed',
                error.message.includes('violates foreign key')
                  ? 'This comment has replies and needs the delete_own_comment SQL helper installed in Supabase.'
                  : error.message
              );
              return;
            }

            setComments((prev) => removeCommentFromTree(prev, comment.id));
            setPosts((prev) =>
              prev.map((post) =>
                post.id === comment.post_id ? { ...post, commentCount: Math.max(0, post.commentCount - 1) } : post
              )
            );
            if (editingComment?.id === comment.id) {
              setEditingComment(null);
              setCommentInput('');
            }
            if (replyingToComment?.id === comment.id) setReplyingToComment(null);
          })();
        },
      },
    ]);
  }

  async function handleAddComment() {
    if (!commentInput.trim() || !selectedPost) return;
    const content = commentInput.trim();
    if (!(await ensurePublicTextAllowed(content, 'Comment not allowed'))) return;

    commentInputRef.current?.focus();
    if (editingComment) {
      const editedAt = new Date().toISOString();
      let { error } = await supabase
        .from('post_comments')
        .update({ content, edited_at: editedAt })
        .eq('school', school)
        .eq('id', editingComment.id)
        .eq('user_id', userId);

      if (error?.code === 'PGRST204' || error?.code === '42703') {
        const retry = await supabase
          .from('post_comments')
          .update({ content })
          .eq('school', school)
          .eq('id', editingComment.id)
          .eq('user_id', userId);
        error = retry.error;
      }

      if (error) {
        Alert.alert('Comment update failed', isServerModerationError(error) ? COMMUNITY_GUIDELINES_MESSAGE : error.message);
        return;
      }

      setComments((prev) =>
        updateCommentTree(prev, editingComment.id, (comment) => ({
          ...comment,
          content,
          edited_at: editedAt,
        }))
      );
      setEditingComment(null);
      setCommentInput('');
      setCommentComposerOpen(false);
      Keyboard.dismiss();
      settleSelectedPostComposer(true);
      triggerSuccessHaptic();
      return;
    }

    const authorName = currentAuthorSummary().displayName;
    const { error } = await supabase.from('post_comments').insert({
      school,
      post_id: selectedPost.id,
      user_id: userId,
      author_name: authorName,
      content: commentInput.trim(),
      parent_comment_id: replyingToComment?.id ?? null,
    });

    if (error) {
      Alert.alert(
        'Comment failed',
        isServerModerationError(error)
          ? COMMUNITY_GUIDELINES_MESSAGE
          : error.code === 'PGRST204' || error.code === '42703'
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
    setCommentComposerOpen(false);
    Keyboard.dismiss();
    settleSelectedPostComposer(true);
    await loadCommentsForPost(selectedPost.id);
    settleSelectedPostComposer(true);
    triggerSuccessHaptic();
  }

  async function handleCreatePost() {
    if (!newPostTitle.trim() || submittingPost) return;
    if (!(await ensurePublicTextAllowed(`${newPostTitle.trim()} ${newPostBody.trim()}`, 'Post not allowed'))) return;
    Keyboard.dismiss();
    setSubmittingPost(true);
    setUploadingAttachments(true);

    const board = composerBoards.find((entry) => entry.id === newPostBoardId) ?? boards[0];
    const category = board.category ?? 'General';
    try {
      const authorSummary = await resolveCurrentAuthorSummary();
      const authorName = authorSummary.displayName;
      const attachments = await Promise.all(newPostAttachments.map((attachment) => uploadAttachment(attachment)));
      const payload = {
        user_id: userId,
        school,
        category,
        title: newPostTitle.trim(),
        body: newPostBody.trim(),
        author_name: authorName,
        attachments,
        is_locked: newPostLocked,
      };

      if (editingPostId) {
        const existingPost = posts.find((post) => post.id === editingPostId);
        const editedAt = new Date().toISOString();
        const editPayload = { ...payload, edited_at: editedAt };
        const removedPaths = (existingPost?.attachments ?? [])
          .map((attachment) => attachment.path)
          .filter((path): path is string => !!path && !attachments.some((next) => next.path === path));

        let { data, error } = await supabase
          .from('posts')
          .update(editPayload)
          .eq('id', editingPostId)
          .eq('school', school)
          .eq('user_id', userId)
          .select()
          .single();

        if (error?.code === 'PGRST204' || error?.code === '42703') {
          const retry = await supabase
            .from('posts')
            .update(payload)
            .eq('id', editingPostId)
            .eq('school', school)
            .eq('user_id', userId)
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }

        if (error || !data) {
          Alert.alert(
            'Update failed',
            isServerModerationError(error)
              ? COMMUNITY_GUIDELINES_MESSAGE
              : error?.code === 'PGRST204' || error?.code === '42703'
              ? 'The posts table is missing the attachments or is_locked columns. Run the SQL update first.'
              : error?.message ?? 'Unknown error'
          );
          return;
        }

        const updatedPost: Post = {
          id: data.id,
          user_id: data.user_id,
          author_name: authorName,
          author_meta: authorSummary.meta,
          category: data.category ?? 'General',
          title: data.title,
          body: data.body ?? '',
          created_at: data.created_at,
          edited_at: data.edited_at ?? editedAt,
          likes: existingPost?.likes ?? 0,
          commentCount: existingPost?.commentCount ?? 0,
          liked: existingPost?.liked ?? false,
          attachments: await resolveAttachmentDisplayUrls(normalizeAttachments(data.attachments)),
          is_locked: !!data.is_locked,
        };

        setPosts((prev) => prev.map((post) => (post.id === editingPostId ? updatedPost : post)));
        if (selectedPost?.id === editingPostId) setSelectedPost(updatedPost);
        await removeStoragePaths(removedPaths);
      } else {
        const { data, error } = await supabase.from('posts').insert(payload).select().single();

        if (error || !data) {
          Alert.alert(
            'Post failed',
            isServerModerationError(error)
              ? COMMUNITY_GUIDELINES_MESSAGE
              : error?.code === 'PGRST204' || error?.code === '42703'
              ? 'The posts table is missing the attachments or is_locked columns. Run the SQL update first.'
              : error?.message ?? 'Unknown error'
          );
          return;
        }

        const newPost: Post = {
          id: data.id,
          user_id: data.user_id,
          author_name: authorName,
          author_meta: authorSummary.meta,
          category: data.category ?? 'General',
          title: data.title,
          body: data.body ?? '',
          created_at: data.created_at,
          edited_at: data.edited_at ?? null,
          likes: 0,
          commentCount: 0,
          liked: false,
          attachments: await resolveAttachmentDisplayUrls(normalizeAttachments(data.attachments)),
          is_locked: !!data.is_locked,
        };

        setPosts((prev) => [newPost, ...prev]);
      }

      closeComposer();
      triggerSuccessHaptic();
    } catch (error: any) {
      Alert.alert(
        'Attachment upload failed',
        error?.message?.includes('bucket')
          ? 'The board-attachments storage bucket is missing or unavailable. Run the storage setup first.'
          : error?.message ?? 'Could not upload one of the attachments.'
      );
    } finally {
      setUploadingAttachments(false);
      setSubmittingPost(false);
    }
  }

  function openNewPost(boardId?: string) {
    resetComposer();
    setNewPostBoardId(boardId ?? selectedBoard?.id ?? boards[0]?.id ?? '');
    setShowNewPost(true);
  }

  function openEditPost(post: Post) {
    if (post.is_locked) {
      Alert.alert('Locked post', 'This post can no longer be edited or deleted.');
      return;
    }
    setEditingPostId(post.id);
    const postDepartment = departmentFromCategory(post.category);
    const board = boards.find((entry) => boardCategory(entry) === post.category) ??
      (postDepartment ? departmentBoardFor(postDepartment) : null) ??
      boards[0];
    setNewPostBoardId(board?.id ?? '');
    setNewPostTitle(post.title);
    setNewPostBody(post.body);
    setNewPostAttachments(post.attachments);
    setNewPostLocked(post.is_locked);
    setShowBoardPicker(false);
    setShowNewPost(true);
  }

  async function handleDeletePost(post: Post) {
    if (post.is_locked) {
      Alert.alert('Locked post', 'This post can no longer be edited or deleted.');
      return;
    }

    Alert.alert('Delete post?', 'This will permanently remove the post and its replies.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { data: postRow } = await supabase
              .from('posts')
              .select('id')
              .eq('id', post.id)
              .eq('school', school)
              .eq('user_id', userId)
              .maybeSingle();
            if (!postRow) {
              Alert.alert('Delete failed', 'This post does not belong to the current school.');
              return;
            }

            const { data: commentRows } = await supabase.from('post_comments').select('id').eq('school', school).eq('post_id', post.id);
            const commentIds = (commentRows ?? []).map((row: any) => row.id);

            if (commentIds.length > 0) {
              await supabase.from('post_comment_votes').delete().eq('school', school).in('comment_id', commentIds);
            }
            await supabase.from('post_comments').delete().eq('school', school).eq('post_id', post.id);
            await supabase.from('post_votes').delete().eq('school', school).eq('post_id', post.id);

            const { error } = await supabase.from('posts').delete().eq('id', post.id).eq('school', school).eq('user_id', userId);
            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }

            await removeStoragePaths(
              post.attachments.map((attachment) => attachment.path).filter((path): path is string => !!path)
            );

            setPosts((prev) => prev.filter((entry) => entry.id !== post.id));
            if (selectedPost?.id === post.id) {
              setSelectedPost(null);
              setComments([]);
              setCommentInput('');
              setReplyingToComment(null);
              setEditingComment(null);
            }
          })();
        },
      },
    ]);
  }

  function openBoard(board: Board) {
    // Clear NEW badge for this board when user opens it
    const cat = boardCategory(board);
    setNewBoardCategories((prev) => {
      if (!prev.has(cat)) return prev;
      const next = new Set(prev);
      next.delete(cat);
      return next;
    });
    boardSlideAnim.setValue(screenWidthRef.current);
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
      toValue: screenWidthRef.current,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setSelectedBoard(null);
      setSelectedPost(null);
      setComments([]);
      setReplyingToComment(null);
      setEditingComment(null);
      setCommentInput('');
      setCommentComposerOpen(false);
      setSearch('');
      setSort('recent');
      boardSlideAnim.setValue(screenWidthRef.current);
    });
  }

  function openReport(target: ReportTarget) {
    setReportTarget(target);
    setReportReason(REPORT_REASONS[0]);
    setReportDetails('');
  }

  async function submitReport() {
    if (!reportTarget || submittingReport) return;

    Keyboard.dismiss();
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

  async function fetchBlockedUsers() {
    if (!userId) return;
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId).eq('source', 'board');
    if (data) setBlockedUserIds(new Set(data.map((row: any) => row.blocked_id as string)));
  }

  async function fetchBannedWords() {
    const { data } = await supabase.from('banned_words').select('word');
    if (data) {
      const words = (data as Array<{ word: string }>).map((r) => r.word);
      customModerationRulesRef.current = moderationRulesFromCustomBlocklist(words);
    }
  }

  async function ensurePublicTextAllowed(text: string, title: string): Promise<boolean> {
    const result = evaluateModerationText(text, { extraRules: customModerationRulesRef.current });
    if (shouldBlockModerationResult(result)) {
      Alert.alert(title, moderationUserMessage(result));
      return false;
    }
    return true;
  }

  function handleBlockUser(targetUserId: string, targetName: string) {
    Alert.alert(
      'Block User',
      `Block ${targetName}? You won't see their posts or comments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('blocks').upsert(
              { blocker_id: userId, blocked_id: targetUserId, source: 'board' },
              { onConflict: 'blocker_id,blocked_id' }
            );
            if (error) {
              Alert.alert('Error', 'Could not block user. Please try again.');
              return;
            }
            setBlockedUserIds((prev) => new Set([...prev, targetUserId]));
            setSelectedPost(null);
            setComments([]);
            setReplyingToComment(null);
            setCommentInput('');
            setCommentComposerOpen(false);
          },
        },
      ]
    );
  }

  async function submitBoardRequest() {
    const name = requestBoardName.trim();
    if (!name) {
      Alert.alert('Board name required', 'Please enter a name for the board you are requesting.');
      return;
    }
    if (!(await ensurePublicTextAllowed(`${name} ${requestBoardDesc.trim()}`, 'Board request not allowed'))) return;
    Keyboard.dismiss();
    setSubmittingBoardRequest(true);
    const { error } = await supabase.from('board_requests').insert({
      requester_id: userId,
      school,
      name,
      description: requestBoardDesc.trim() || null,
    });
    setSubmittingBoardRequest(false);
    if (error) {
      Alert.alert('Could not send request', isServerModerationError(error) ? COMMUNITY_GUIDELINES_MESSAGE : error.message);
      return;
    }
    Alert.alert('Request sent', 'Thanks! We will review your board request soon.');
    setShowRequestBoard(false);
    setRequestBoardName('');
    setRequestBoardDesc('');
  }

  const boardPosts = useMemo(() => {
    if (!selectedBoard) return [];
    if (isHotBoard(selectedBoard)) return hotPosts;
    return posts.filter((post) => post.category === boardCategory(selectedBoard));
  }, [hotPosts, posts, selectedBoard]);

  const globalSearchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return [];
    return posts.filter((post) =>
      post.title.toLowerCase().includes(query) ||
      post.body.toLowerCase().includes(query) ||
      post.author_name.toLowerCase().includes(query) ||
      post.category.toLowerCase().includes(query)
    );
  }, [globalSearch, posts]);

  const filteredDepartmentBoards = useMemo(() => {
    const query = departmentSearch.trim().toLowerCase();
    if (!query) return departmentBoards;
    return departmentBoards.filter((board) => {
      const department = departmentFromCategory(board.category ?? '') ?? board.name;
      return department.toLowerCase().includes(query) || board.name.toLowerCase().includes(query);
    });
  }, [departmentBoards, departmentSearch]);

  const filteredPosts = useMemo(() => {
    let result = boardPosts.filter((post) => {
      if (blockedUserIds.has(post.user_id)) return false;
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
  }, [boardPosts, blockedUserIds, search, sort]);

  const selectedPostCommentCount = useMemo(() => countComments(comments), [comments]);

  function handleMessageCommentAuthor(comment: CommentNode) {
    if (!selectedPost || !onOpenChat) return;
    onOpenChat({
      id: comment.user_id,
      kind: 'board_anonymous',
      name: comment.author_name,
      sourcePostId: selectedPost.id,
      sourceLabel: selectedPost.title,
    });
  }

  function openCommentActions(comment: CommentNode) {
    const isOwnComment = comment.user_id === userId;
    const actions = isOwnComment
      ? [
          { label: 'Edit Comment', action: () => startEditComment(comment) },
          { label: 'Delete Comment', destructive: true, action: () => void handleDeleteComment(comment) },
        ]
      : [
          ...(selectedPost && onOpenChat ? [{ label: 'Message Anonymously', action: () => handleMessageCommentAuthor(comment) }] : []),
          {
            label: 'Report Comment',
            action: () => openReport({
              id: comment.id,
              type: 'comment',
              label: `Comment by ${comment.author_name}`,
            }),
          },
          {
            label: 'Block User',
            destructive: true,
            action: () => handleBlockUser(comment.user_id, comment.author_name),
          },
        ];

    if (Platform.OS === 'ios') {
      const destructiveButtonIndex = actions.findIndex((action) => action.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((action) => action.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex < actions.length) actions[buttonIndex].action();
        }
      );
      return;
    }

    Alert.alert(
      'Comment options',
      undefined,
      [
        ...actions.map((action) => ({
          text: action.label,
          style: action.destructive ? 'destructive' as const : 'default' as const,
          onPress: action.action,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  const renderComment = (comment: CommentNode, depth = 0): React.ReactNode => {
    if (blockedUserIds.has(comment.user_id)) return null;
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
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{comment.author_name ?? campusAliasForId(comment.user_id, school)}</Text>
                {comment.author_meta ? (
                  <>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>·</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>{comment.author_meta}</Text>
                  </>
                ) : null}
                {selectedPost?.user_id === comment.user_id ? (
                  <View
                    style={{
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: 999,
                      backgroundColor: colors.brandBg,
                      borderWidth: 1,
                      borderColor: `${colors.brand}20`,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.brand }}>Author</Text>
                  </View>
                ) : null}
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>{timeAgo(comment.created_at)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => openCommentActions(comment)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  flexShrink: 0,
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
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
                onPress={() => {
                  setEditingComment(null);
                  setCommentInput('');
                  setReplyingToComment({ id: comment.id, authorName: comment.author_name });
                  setCommentComposerOpen(true);
                  requestAnimationFrame(() => commentInputRef.current?.focus());
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Ionicons name="return-up-forward-outline" size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Reply</Text>
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
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <ScrollView
        ref={boardListScrollRef}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: topInset + 14, paddingBottom: bottomInset + 74 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.brand} />}
      >
        <View
          style={{
            paddingBottom: 14,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: 0 }}>Board</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexShrink: 0 }}>
            {onOpenMessages ? (
              <TouchableOpacity
                onPress={onOpenMessages}
                style={{
                  position: 'relative',
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
                {unreadMessageCount > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      paddingHorizontal: 4,
                      backgroundColor: colors.destructive,
                      borderWidth: 2,
                      borderColor: colors.bgSecondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => openNewPost()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.brand,
                borderRadius: 22,
                paddingHorizontal: 12,
                paddingVertical: 9,
                shadowColor: colors.brand,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.2,
                shadowRadius: 18,
                elevation: 5,
              }}
            >
              <Ionicons name="add" size={16} color="white" />
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>New Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 9,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.16 : 0.05,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <Ionicons name="search-outline" size={18} color={colors.placeholder} />
              <TextInput
                placeholder="Search all board posts..."
                placeholderTextColor={colors.placeholder}
                value={globalSearch}
                onChangeText={setGlobalSearch}
                style={{ flex: 1, fontSize: 14, color: colors.text }}
                returnKeyType="search"
              />
              {globalSearch.trim() ? (
                <TouchableOpacity onPress={() => setGlobalSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.placeholder} />
                </TouchableOpacity>
              ) : null}
            </View>

            {globalSearch.trim() ? (
              <View style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Search Results</Text>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>
                    {globalSearchResults.length} result{globalSearchResults.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {globalSearchResults.length === 0 ? (
                  <View
                    style={{
                      borderRadius: 16,
                      padding: 16,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>No matching posts</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                      Try a different title, keyword, author, or board category.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {globalSearchResults.map((post) => (
                      <TouchableOpacity
                        key={`search-${post.id}`}
                        onPress={() => void openPostFromBoardList(post)}
                        activeOpacity={0.82}
                        style={{
                          borderRadius: 18,
                          padding: 15,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                          shadowColor: '#0f172a',
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: isDark ? 0.16 : 0.05,
                          shadowRadius: 14,
                          elevation: 3,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: 150, fontSize: 12, fontWeight: '700', color: colors.brand }}>{post.category}</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.author_name}</Text>
                          {post.author_meta ? (
                            <>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.author_meta}</Text>
                            </>
                          ) : null}
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                        </View>
                        <Text numberOfLines={2} ellipsizeMode="tail" style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 5 }}>{post.title}</Text>
                        <Text numberOfLines={2} style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                          {post.body}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => openBoard(HOT_BOARD)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.18 : 0.06,
                shadowRadius: 20,
                elevation: 4,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: themedIconBackground(HOT_BOARD.color, isDark, HOT_BOARD.iconBg),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                  borderWidth: 1,
                  borderColor: themedIconBorder(HOT_BOARD.color, isDark),
                }}
              >
                <Ionicons name={HOT_BOARD.icon} size={22} color={themedIconColor(HOT_BOARD.color, isDark)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                  Trending Now
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{HOT_BOARD.name}</Text>
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: themedIconBackground(HOT_BOARD.color, isDark, HOT_BOARD.iconBg),
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: themedIconBorder(HOT_BOARD.color, isDark),
                }}
              >
                <Ionicons name="chevron-forward" size={16} color={themedIconColor(HOT_BOARD.color, isDark)} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setDepartmentSearch('');
                setShowDepartmentBoards(true);
              }}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.18 : 0.06,
                shadowRadius: 20,
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
                  borderColor: `${colors.brand}20`,
                }}
              >
                <Ionicons name="school-outline" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                  Browse your department
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Department Boards</Text>
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

            {boards.map((board) => (
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
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: '#0f172a',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: isDark ? 0.18 : 0.06,
                  shadowRadius: 20,
                  elevation: 4,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: themedIconBackground(board.color, isDark, board.iconBg),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 14,
                    borderWidth: 1,
                    borderColor: themedIconBorder(board.color, isDark),
                  }}
                >
                  <Ionicons name={board.icon} size={22} color={themedIconColor(board.color, isDark)} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>
                    {boardListDescription(board)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }}>{board.name}</Text>
                    {newBoardCategories.has(boardCategory(board)) && (
                      <View style={{ borderRadius: 999, backgroundColor: colors.brand, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.3 }}>NEW</Text>
                      </View>
                    )}
                  </View>
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
              onPress={() => setShowRequestBoard(true)}
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
      </ScrollView>

      <Modal
        visible={showDepartmentBoards}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDepartmentBoards(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ paddingTop: 20, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => setShowDepartmentBoards(false)}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.inputBg }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Department Boards</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{school}</Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.card,
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                gap: 9,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#0f172a',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.16 : 0.05,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <Ionicons name="search-outline" size={18} color={colors.placeholder} />
              <TextInput
                placeholder="Search department or course code..."
                placeholderTextColor={colors.placeholder}
                value={departmentSearch}
                onChangeText={setDepartmentSearch}
                autoCapitalize="characters"
                style={{ flex: 1, fontSize: 14, color: colors.text }}
                returnKeyType="search"
              />
              {departmentSearch.length > 0 ? (
                <TouchableOpacity onPress={() => setDepartmentSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.placeholder} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: bottomInset + 34 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filteredDepartmentBoards.length === 0 ? (
              <View
                style={{
                  borderRadius: 18,
                  padding: 18,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>No matching departments</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 5 }}>Try another department code.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {filteredDepartmentBoards.map((board) => {
                  const department = departmentFromCategory(board.category ?? '') ?? board.name;
                  return (
                    <TouchableOpacity
                      key={board.id}
                      onPress={() => {
                        setShowDepartmentBoards(false);
                        openBoard(board);
                      }}
                      activeOpacity={0.76}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: 16,
                        paddingHorizontal: 14,
                        paddingVertical: 13,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          minWidth: 82,
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          backgroundColor: themedIconBackground(board.color, isDark, board.iconBg),
                          alignItems: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: themedIconColor(board.color, isDark) }}>{department}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{board.name}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={17} color={colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

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
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View
                style={{
                  paddingTop: topInset + 14,
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
                    setCommentComposerOpen(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: '600', color: colors.text }}>
                  {boardContextLabel(selectedPost.category)}
                </Text>
              </View>

              {(() => {
                const post = posts.find((entry) => entry.id === selectedPost.id) ?? selectedPost;
                return (
                  <>
                  <ScrollView
                    ref={selectedPostScrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: selectedPostScrollBottomPadding }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    onLayout={() => {
                      if (boardKeyboardVisible) settleSelectedPostComposer(false);
                    }}
                    onContentSizeChange={() => {
                      if (boardKeyboardVisible) settleSelectedPostComposer(true);
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.brand} />}
                  >
                    <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{post.author_name}</Text>
                        {post.author_meta ? (
                          <>
                            <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                            <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.author_meta}</Text>
                          </>
                        ) : null}
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                        <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                        {post.is_locked ? (
                          <>
                            <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: colors.brandBg,
                                borderWidth: 1,
                                borderColor: `${colors.brand}20`,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.brand }}>Locked</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{post.title}</Text>
                      <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 16 }}>{post.body}</Text>
                      {post.attachments.some(isImageAttachment) ? (
                        <View style={{ marginBottom: 16, gap: 12 }}>
                          {post.attachments.filter((attachment) => isImageAttachment(attachment) && attachmentUri(attachment)).map((attachment) => (
                            <BoardPostImage
                              key={attachment.id}
                              attachment={attachment}
                              colors={colors}
                              onPress={() => setImageViewerAttachment(attachment)}
                            />
                          ))}
                        </View>
                      ) : null}
                      {post.attachments.some((attachment) => !isImageAttachment(attachment)) ? (
                        <View style={{ marginBottom: 16, gap: 10 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Attachments</Text>
                          {post.attachments.filter((attachment) => !isImageAttachment(attachment)).map((attachment) => (
                            <TouchableOpacity
                              key={attachment.id}
                              onPress={() => void openAttachment(attachment)}
                              activeOpacity={0.82}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                borderRadius: 14,
                                padding: 12,
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.borderSubtle,
                              }}
                            >
                              <View
                                style={{
                                  width: 52,
                                  height: 52,
                                  borderRadius: 12,
                                  backgroundColor: colors.brandBg,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="document-outline" size={24} color={colors.brand} />
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                  {attachment.name}
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                                  File{formatFileSize(attachment.size) ? ` · ${formatFileSize(attachment.size)}` : ''}
                                </Text>
                              </View>
                              <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity onPress={() => void togglePostLike(post.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name={post.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={post.liked ? colors.brand : colors.textTertiary} />
                          <Text style={{ fontSize: 14, color: post.liked ? colors.brand : colors.textTertiary, fontWeight: '500' }}>{post.likes}</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
                          <Text style={{ fontSize: 14, color: colors.textTertiary, fontWeight: '500' }}>{selectedPostCommentCount}</Text>
                        </View>
                        {post.user_id !== userId && onOpenChat ? (
                          <TouchableOpacity
                            onPress={() => onOpenChat({
                              id: post.user_id,
                              kind: 'board_anonymous',
                              name: post.author_name,
                              sourcePostId: post.id,
                              sourceLabel: post.title,
                            })}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          >
                            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>Message</Text>
                          </TouchableOpacity>
                        ) : null}
                        {post.user_id !== userId ? (
                          <TouchableOpacity
                            onPress={() => openReport({ id: post.id, type: 'post', label: post.title })}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          >
                            <Ionicons name="flag-outline" size={16} color={colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>Report</Text>
                          </TouchableOpacity>
                        ) : null}
                        {post.user_id !== userId ? (
                          <TouchableOpacity
                            onPress={() => handleBlockUser(post.user_id, post.author_name)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                          >
                            <Ionicons name="ban-outline" size={16} color={colors.textTertiary} />
                            <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>Block</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      {post.user_id === userId ? (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                          <TouchableOpacity
                            disabled={post.is_locked}
                            onPress={() => openEditPost(post)}
                            style={{
                              flex: 1,
                              borderRadius: 12,
                              paddingVertical: 11,
                              alignItems: 'center',
                              backgroundColor: colors.bgTertiary,
                              opacity: post.is_locked ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Edit Post</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={post.is_locked}
                            onPress={() => void handleDeletePost(post)}
                            style={{
                              flex: 1,
                              borderRadius: 12,
                              paddingVertical: 11,
                              alignItems: 'center',
                              backgroundColor: '#fee2e2',
                              opacity: post.is_locked ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Delete Post</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                        Comments ({selectedPostCommentCount})
                      </Text>
                      {comments.length > 0 ? (
                        comments.map((comment) => renderComment(comment))
                      ) : (
                        <Text style={{ fontSize: 14, color: colors.textTertiary, marginBottom: 18 }}>No comments yet.</Text>
                      )}
                      {!shouldShowCommentComposer ? (
                        <TouchableOpacity
                          onPress={openSelectedPostCommentComposer}
                          activeOpacity={0.75}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            borderRadius: 18,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            marginBottom: 18,
                          }}
                        >
                          <Ionicons name="chatbubble-outline" size={17} color={colors.textTertiary} />
                          <Text style={{ flex: 1, fontSize: 14, color: colors.placeholder }}>Add a comment...</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </ScrollView>
                  {shouldShowCommentComposer ? (
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingTop: 8,
                      paddingBottom: commentComposerBottomPadding,
                      borderTopWidth: 1,
                      borderTopColor: colors.borderSubtle,
                      backgroundColor: colors.card,
                      marginBottom: commentComposerBottomMargin,
                    }}
                  >
                    {editingComment ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: colors.bgTertiary,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600', flex: 1 }}>
                          Editing your comment
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingComment(null);
                            setCommentInput('');
                            setCommentComposerOpen(false);
                            Keyboard.dismiss();
                          }}
                        >
                          <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {replyingToComment ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: colors.brandBg,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: colors.brand, fontWeight: '600', flex: 1 }}>
                          Replying to {replyingToComment.authorName}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setReplyingToComment(null);
                            if (!commentInput.trim()) {
                              setCommentComposerOpen(false);
                              Keyboard.dismiss();
                            }
                          }}
                        >
                          <Ionicons name="close" size={18} color={colors.brand} />
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 8,
                      }}
                    >
                      <TextInput
                        ref={commentInputRef}
                        value={commentInput}
                        onChangeText={setCommentInput}
                        onFocus={() => settleSelectedPostComposer(true)}
                        onBlur={() => {
                          if (!commentInput.trim() && !replyingToComment && !editingComment) {
                            setCommentComposerOpen(false);
                          }
                        }}
                        placeholder={editingComment ? 'Edit your comment...' : replyingToComment ? 'Write a reply...' : 'Add a comment...'}
                        placeholderTextColor={colors.placeholder}
                        multiline
                        blurOnSubmit={false}
                        maxLength={1000}
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
                        onSubmitEditing={() => void handleAddComment()}
                        returnKeyType="send"
                      />
                      <TouchableOpacity
                        onPressIn={() => commentInputRef.current?.focus()}
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
                  ) : null}
                  </>
                );
              })()}
            </KeyboardAvoidingView>
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.bg }}>
              <View style={{ paddingTop: topInset + 14, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <TouchableOpacity onPress={closeBoard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                  </TouchableOpacity>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themedIconBackground(selectedBoard.color, isDark, selectedBoard.iconBg), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={selectedBoard.icon} size={18} color={themedIconColor(selectedBoard.color, isDark)} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: colors.text }}>{selectedBoard.name}</Text>
                  {!isHotBoard(selectedBoard) ? (
                    <TouchableOpacity
                      onPress={() => openNewPost(selectedBoard.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brand, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
                    >
                      <Ionicons name="add" size={15} color="white" />
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>New Post</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderRadius: 18,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 9,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: '#0f172a',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: isDark ? 0.16 : 0.05,
                    shadowRadius: 16,
                    elevation: 3,
                  }}
                >
                  <Ionicons name="search-outline" size={18} color={colors.placeholder} />
                  <TextInput
                    placeholder="Search posts..."
                    placeholderTextColor={colors.placeholder}
                    value={search}
                    onChangeText={setSearch}
                    style={{ flex: 1, fontSize: 14, color: colors.text }}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={colors.placeholder} />
                    </TouchableOpacity>
                  )}
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

              {filteredPosts.length === 0 ? (
                <EmptyState
                  icon={isHotBoard(selectedBoard) ? 'flame-outline' : 'clipboard-outline'}
                  title={isHotBoard(selectedBoard) ? 'No hot posts yet' : 'No posts yet'}
                  body={isHotBoard(selectedBoard) ? 'Posts with more than 10 likes will appear here.' : 'Be the first to post when you have something useful to share.'}
                />
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  showsVerticalScrollIndicator={false}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.brand} />}
                >
                  {filteredPosts.map((post, index) => {
                    const previewImage = post.attachments.find((attachment) => isImageAttachment(attachment) && attachmentUri(attachment));
                    const showSponsoredCard = index > 0 && index % 5 === 0;

                    return (
                    <View key={post.id}>
                    {showSponsoredCard && (
                      <TouchableOpacity
                        activeOpacity={0.76}
                        onPress={() => {}}
                        style={{ paddingHorizontal: 16, paddingVertical: 14 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <View style={{
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: colors.border,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.2 }}>Sponsored</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <View style={{
                            width: 44, height: 44, borderRadius: 12,
                            backgroundColor: '#f0f4ff',
                            alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Text style={{ fontSize: 22 }}>📚</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 }}>
                              Finals coming up? Chegg Study can help.
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }} numberOfLines={2}>
                              Step-by-step solutions, expert Q&A, and textbook access — free trial for students.
                            </Text>
                          </View>
                        </View>
                        <View style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 8, backgroundColor: `${colors.brand}12`, paddingHorizontal: 12, paddingVertical: 6 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand }}>Try free →</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    {showSponsoredCard && <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginHorizontal: 16 }} />}
                    <TouchableOpacity onPress={() => void openPost(post)} activeOpacity={0.8}>
                      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{post.category}</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>·</Text>
                              <Text style={{ fontSize: 12, color: colors.textTertiary }}>{timeAgo(post.created_at)}</Text>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 5 }}>{post.title}</Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 10 }} numberOfLines={2}>
                              {post.body}
                            </Text>
                          </View>
                          {previewImage ? (
                            <BoardAttachmentImage
                              uri={attachmentUri(previewImage)}
                              colors={colors}
                              style={{
                                width: 76,
                                height: 76,
                                borderRadius: 14,
                                backgroundColor: colors.bgTertiary,
                                borderWidth: 1,
                                borderColor: colors.borderSubtle,
                              }}
                            />
                          ) : null}
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
                    </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </Animated.View>
      )}

      <ImageViewerModal
        attachment={imageViewerAttachment}
        onClose={() => setImageViewerAttachment(null)}
        onSave={(attachment) => void saveImageAttachment(attachment)}
        saving={savingImage}
        colors={colors}
      />

      <NewPostModal
        visible={showNewPost}
        onClose={closeComposer}
        boards={composerBoards}
        selectedBoardId={newPostBoardId}
        onSelectBoard={setNewPostBoardId}
        showBoardPicker={showBoardPicker}
        onToggleBoardPicker={() => setShowBoardPicker((value) => !value)}
        title={newPostTitle}
        onTitleChange={setNewPostTitle}
        body={newPostBody}
        onBodyChange={setNewPostBody}
        attachments={newPostAttachments}
        onAddImages={() => void handlePickImages()}
        onAddFiles={() => void handlePickFiles()}
        onRemoveAttachment={removeDraftAttachment}
        isLocked={newPostLocked}
        onToggleLocked={() => setNewPostLocked((value) => !value)}
        editing={!!editingPostId}
        onSubmit={handleCreatePost}
        submitting={submittingPost}
        uploadingAttachments={uploadingAttachments}
        colors={colors}
        isDark={isDark}
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

      <RequestBoardModal
        visible={showRequestBoard}
        onClose={() => { setShowRequestBoard(false); setRequestBoardName(''); setRequestBoardDesc(''); }}
        boardName={requestBoardName}
        onBoardNameChange={setRequestBoardName}
        description={requestBoardDesc}
        onDescriptionChange={setRequestBoardDesc}
        onSubmit={() => void submitBoardRequest()}
        submitting={submittingBoardRequest}
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

function ImageViewerModal({
  attachment,
  onClose,
  onSave,
  saving,
  colors,
}: {
  attachment: BoardAttachment | null;
  onClose: () => void;
  onSave: (attachment: BoardAttachment) => void;
  saving: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const uri = attachment ? attachmentUri(attachment) : '';
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  return (
    <Modal visible={!!attachment} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(2,6,23,0.96)' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            paddingTop: Platform.OS === 'ios' ? 58 : 24,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => attachment && onSave(attachment)}
            disabled={!attachment || saving}
            style={{
              minWidth: 104,
              height: 42,
              borderRadius: 21,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              backgroundColor: 'rgba(255,255,255,0.14)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={17} color="white" />
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            minHeight: screenHeight,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: Platform.OS === 'ios' ? 112 : 82,
            paddingBottom: Platform.OS === 'ios' ? 96 : 72,
          }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <BoardAttachmentImage
            uri={uri}
            colors={colors}
            contentFit="contain"
            style={{
              width: screenWidth,
              height: Math.max(260, screenHeight - (Platform.OS === 'ios' ? 208 : 154)),
              backgroundColor: 'transparent',
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

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
            borderTopLeftRadius: SHEET_CORNER_RADIUS,
            borderTopRightRadius: SHEET_CORNER_RADIUS,
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

function RequestBoardModal({
  visible,
  onClose,
  boardName,
  onBoardNameChange,
  description,
  onDescriptionChange,
  onSubmit,
  submitting,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  boardName: string;
  onBoardNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const boardNameInputRef = useRef<TextInput>(null);
  const boardDescriptionInputRef = useRef<TextInput>(null);
  const keyboardInset = useKeyboardInset({ enabled: visible });
  const sheetAnim = useRef(new Animated.Value(SHEET_INITIAL_TRANSLATE_Y)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetMaxHeight = Math.min(
    Math.round(windowHeight * 0.72),
    Math.max(320, windowHeight - 96)
  );
  const keyboardAwareSheetMaxHeight = keyboardInset.bottomSheetMaxHeight(sheetMaxHeight, windowHeight, 24, 280);
  const requestBoardScrollMaxHeight = Math.max(220, keyboardAwareSheetMaxHeight - 20);
  const closeRef = useRef<(() => void) | null>(null);
  const dragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => { if (gs.dy > 0) sheetAnim.setValue(gs.dy); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > SHEET_DRAG_DISMISS_DISTANCE || gs.vy > SHEET_DRAG_DISMISS_VELOCITY) closeRef.current?.();
      else Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_RESET_SPRING }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_RESET_SPRING }).start();
    },
  })).current;

  function openSheet() {
    sheetAnim.setValue(SHEET_INITIAL_TRANSLATE_Y);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, ...SHEET_SPRING }),
      Animated.timing(backdropAnim, { toValue: 1, duration: BACKDROP_DURATION, useNativeDriver: true }),
    ]).start();
  }

  function closeSheet() {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: SHEET_INITIAL_TRANSLATE_Y, duration: SHEET_OUT_DURATION, easing: MOTION.easing.exit, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: BACKDROP_EXIT_DURATION, useNativeDriver: true }),
    ]).start(() => onClose());
  }
  closeRef.current = closeSheet;

  useEffect(() => {
    if (visible) openSheet();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeSheet}>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'] }) }}
        >
          <TouchableOpacity style={{ flex: 1, zIndex: 0 }} activeOpacity={1} onPress={closeSheet} />
          <Animated.View
            style={{
              maxHeight: keyboardAwareSheetMaxHeight,
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_CORNER_RADIUS,
              borderTopRightRadius: SHEET_CORNER_RADIUS,
              overflow: 'hidden',
              zIndex: 1,
              elevation: 1,
              marginBottom: keyboardInset.androidBottomSheetMarginBottom(8),
              transform: [{ translateY: sheetAnim }],
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }} {...dragPan.panHandlers}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>
          <View>
            <ScrollView
              ref={scrollRef}
              style={{ flexGrow: 0, maxHeight: requestBoardScrollMaxHeight }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: (Platform.OS === 'ios' ? 24 : 18) + (keyboardInset.visible ? 28 : 0),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Request New Board</Text>
                <TouchableOpacity onPress={closeSheet}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 20 }}>
                Suggest a new community board for ClassMate. Admins will review your request.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                Board Name <Text style={{ color: '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                ref={boardNameInputRef}
                value={boardName}
                onChangeText={onBoardNameChange}
                onPressIn={() => boardNameInputRef.current?.focus()}
                placeholder="e.g. Pre-Med Students, Housing Tips…"
                placeholderTextColor={colors.placeholder}
                showSoftInputOnFocus
                style={{
                  backgroundColor: colors.inputBg,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: colors.text,
                  marginBottom: 18,
                }}
              />

              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                Brief Description
              </Text>
              <TextInput
                ref={boardDescriptionInputRef}
                value={description}
                onChangeText={onDescriptionChange}
                onPressIn={() => boardDescriptionInputRef.current?.focus()}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
                placeholder="What would this board be used for?"
                placeholderTextColor={colors.placeholder}
                multiline
                showSoftInputOnFocus
                style={{
                  backgroundColor: colors.inputBg,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  fontSize: 14,
                  color: colors.text,
                  marginBottom: 22,
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
                    backgroundColor: colors.brand,
                    borderRadius: 14,
                    paddingVertical: 15,
                    alignItems: 'center',
                    opacity: submitting ? 0.72 : 1,
                  }}
                >
                  {submitting
                    ? <ActivityIndicator color="white" />
                    : <Text style={{ fontSize: 15, fontWeight: '800', color: 'white' }}>Request</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
          </Animated.View>
        </Animated.View>
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
  attachments: BoardAttachment[];
  onAddImages: () => void;
  onAddFiles: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  isLocked: boolean;
  onToggleLocked: () => void;
  editing: boolean;
  onSubmit: () => void;
  submitting: boolean;
  uploadingAttachments: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
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
  attachments,
  onAddImages,
  onAddFiles,
  onRemoveAttachment,
  isLocked,
  onToggleLocked,
  editing,
  onSubmit,
  submitting,
  uploadingAttachments,
  colors,
  isDark,
}: NewPostModalProps) {
  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? boards[0];
  const composerScrollRef = useRef<ScrollView>(null);
  const composerKeyboard = useKeyboardInset({ enabled: visible && Platform.OS === 'android' });
  const fieldChrome = {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    requestAnimationFrame(() => composerScrollRef.current?.scrollTo({ y: 0, animated: false }));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text }}>
            {editing ? 'Edit Post' : 'New Post'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={composerScrollRef}
            contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'ios' ? 140 : composerKeyboard.scrollPaddingBottom(90, 20) }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
            Board <Text style={{ color: '#ef4444' }}>*</Text>
          </Text>
          <TouchableOpacity
            onPress={onToggleBoardPicker}
            style={{ ...fieldChrome, flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 20 }}
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
                  <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: themedIconBackground(board.color, isDark, board.iconBg), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <Ionicons name={board.icon} size={14} color={themedIconColor(board.color, isDark)} />
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
            style={{ ...fieldChrome, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.text, marginBottom: 20 }}
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
            scrollEnabled
            style={{
              ...fieldChrome,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 13,
              fontSize: 15,
              color: colors.text,
              marginBottom: 20,
              height: 240,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            <TouchableOpacity
              onPress={onAddImages}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.inputBg,
                borderRadius: 14,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <Ionicons name="image-outline" size={16} color={colors.brand} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Add Images</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAddFiles}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.inputBg,
                borderRadius: 14,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <Ionicons name="document-attach-outline" size={16} color={colors.brand} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Add Files</Text>
            </TouchableOpacity>
          </View>

          {attachments.length > 0 ? (
            <View style={{ marginBottom: 20, gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Attachments</Text>
              {attachments.map((attachment) => (
                <View
                  key={attachment.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  {attachment.type === 'image' && (attachment.localUri || attachment.url) ? (
                    <BoardAttachmentImage
                      uri={attachment.localUri ?? attachment.url ?? ''}
                      colors={colors}
                      style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: colors.bgTertiary }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        backgroundColor: colors.brandBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-outline" size={22} color={colors.brand} />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                      {attachment.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                      {attachment.type === 'image' ? 'Image' : 'File'}
                      {formatFileSize(attachment.size) ? ` · ${formatFileSize(attachment.size)}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => onRemoveAttachment(attachment.id)} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={onToggleLocked}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 14,
              padding: 14,
              backgroundColor: isLocked ? colors.brandBg : colors.inputBg,
              borderWidth: 1,
              borderColor: isLocked ? `${colors.brand}28` : colors.borderSubtle,
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: isLocked ? colors.brand : colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={16} color={isLocked ? 'white' : colors.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Prevent Edit/Delete</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Lock this post after publishing so it can no longer be edited or deleted.
              </Text>
            </View>
            <View
              style={{
                width: 46,
                height: 28,
                borderRadius: 14,
                backgroundColor: isLocked ? colors.brand : colors.border,
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: 'white',
                  alignSelf: isLocked ? 'flex-end' : 'flex-start',
                }}
              />
            </View>
          </TouchableOpacity>

          {uploadingAttachments ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <MiniLoader label="Uploading attachments..." labelColor={colors.textSecondary} />
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              disabled={!title.trim() || submitting || uploadingAttachments}
              style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: title.trim() ? colors.brand : colors.border }}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>{editing ? 'Save' : 'Post'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
