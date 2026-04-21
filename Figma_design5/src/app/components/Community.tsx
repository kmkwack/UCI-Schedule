import { useState } from "react";
import { Plus, Search, ThumbsUp, MessageCircle, Clock, TrendingUp, Send, X, Lock, ChevronRight, Users, Dumbbell, BookOpen, ShoppingBag, Megaphone, MessagesSquare, Image, Paperclip } from "lucide-react";
import { useNavigate } from "react-router";
import PostDetail from "./PostDetail";

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  major: string;
  timestamp: string;
  likes: number;
  comments: Comment[];
  category: string;
  isLiked?: boolean;
}

interface Friend {
  id: string;
  name: string;
  major: string;
  avatar: string;
  status: "pending" | "accepted" | "none";
}

const mockPosts: Post[] = [
  {
    id: "1",
    title: "Looking for study group members for CS 101",
    content: "We meet every Tuesday and Thursday at the library. Looking for 2-3 more people!",
    author: "Sarah Chen",
    major: "Computer Science",
    timestamp: "2h ago",
    likes: 24,
    comments: [
      { id: "1", author: "Mike Johnson", content: "I'm in!", timestamp: "1h ago" },
      { id: "2", author: "Emma Wilson", content: "Count me in too.", timestamp: "30m ago" },
    ],
    category: "Study Groups",
  },
  {
    id: "2",
    title: "Basketball pickup game this Saturday",
    content: "Looking for players for a casual pickup game at the main gym. All skill levels welcome! 3pm-5pm.",
    author: "Mike Johnson",
    major: "Engineering",
    timestamp: "4h ago",
    likes: 18,
    comments: [
      { id: "3", author: "David Lee", content: "I'm down!", timestamp: "2h ago" },
      { id: "4", author: "Alex Kim", content: "Count me in.", timestamp: "1h ago" },
    ],
    category: "Sports",
  },
  {
    id: "3",
    title: "Chess Club - Weekly Meetings",
    content: "Join us every Friday evening for friendly chess matches! Beginners and experts welcome. Free pizza!",
    author: "Chess Club",
    major: "Student Organization",
    timestamp: "1d ago",
    likes: 156,
    comments: [
      { id: "5", author: "Sarah Chen", content: "I'm going!", timestamp: "30m ago" },
      { id: "6", author: "Emma Wilson", content: "Me too.", timestamp: "15m ago" },
    ],
    category: "Club Promotions",
  },
  {
    id: "4",
    title: "Free tutoring sessions for Math 201",
    content: "Struggling with calculus? Join our free tutoring sessions every Monday and Wednesday.",
    author: "Alex Kim",
    major: "Mathematics",
    timestamp: "2d ago",
    likes: 45,
    comments: [
      { id: "7", author: "Mike Johnson", content: "Thanks!", timestamp: "1h ago" },
      { id: "8", author: "David Lee", content: "I'll check it out.", timestamp: "30m ago" },
    ],
    category: "Study Groups",
  },
  {
    id: "5",
    title: "Tennis partner needed - beginner friendly",
    content: "Looking for someone to play tennis with on weekends. I'm a beginner, so no pressure! Campus courts.",
    author: "Emma Wilson",
    major: "Business",
    timestamp: "3h ago",
    likes: 12,
    comments: [
      { id: "9", author: "Sarah Chen", content: "I'm in!", timestamp: "1h ago" },
      { id: "10", author: "Mike Johnson", content: "Count me in.", timestamp: "30m ago" },
    ],
    category: "Sports",
  },
  {
    id: "6",
    title: "Running club meets every morning",
    content: "Join us for morning runs around campus! We meet at 6:30am at the student center. All paces welcome.",
    author: "David Lee",
    major: "Health Sciences",
    timestamp: "1d ago",
    likes: 32,
    comments: [
      { id: "11", author: "Alex Kim", content: "I'm down!", timestamp: "2h ago" },
      { id: "12", author: "Emma Wilson", content: "Count me in.", timestamp: "1h ago" },
    ],
    category: "Sports",
  },
  {
    id: "7",
    title: "Drama Club Spring Production Auditions",
    content: "Auditions for our spring musical next week! No experience needed. Sign up at the student center.",
    author: "Drama Club",
    major: "Student Organization",
    timestamp: "5h ago",
    likes: 89,
    comments: [
      { id: "13", author: "Sarah Chen", content: "I'm going!", timestamp: "30m ago" },
      { id: "14", author: "Mike Johnson", content: "Me too.", timestamp: "15m ago" },
    ],
    category: "Club Promotions",
  },
  {
    id: "8",
    title: "Soccer team looking for goalkeeper",
    content: "Our intramural soccer team needs a goalkeeper for the spring season. Games are on Sunday afternoons.",
    author: "Tom Anderson",
    major: "Engineering",
    timestamp: "6h ago",
    likes: 15,
    comments: [
      { id: "15", author: "David Lee", content: "I'm down!", timestamp: "2h ago" },
      { id: "16", author: "Alex Kim", content: "Count me in.", timestamp: "1h ago" },
    ],
    category: "Sports",
  },
  {
    id: "9",
    title: "Selling used textbooks - Great condition!",
    content: "CS 101, Math 201, and Physics textbooks. All like new. Reasonable prices. DM for details!",
    author: "Jessica Park",
    major: "Computer Science",
    timestamp: "4h ago",
    likes: 28,
    comments: [
      { id: "17", author: "Alex Kim", content: "How much for CS 101?", timestamp: "2h ago" },
      { id: "18", author: "Sarah Chen", content: "Interested in Math 201!", timestamp: "1h ago" },
    ],
    category: "Marketplace",
  },
  {
    id: "10",
    title: "Mini fridge for sale - $40",
    content: "Moving out, selling a mini fridge in excellent condition. Perfect for dorm rooms. Cash only.",
    author: "Ryan Cooper",
    major: "Business",
    timestamp: "1d ago",
    likes: 42,
    comments: [
      { id: "19", author: "Mike Johnson", content: "Is it still available?", timestamp: "12h ago" },
      { id: "20", author: "Emma Wilson", content: "I'm interested!", timestamp: "8h ago" },
    ],
    category: "Marketplace",
  },
  {
    id: "11",
    title: "Photography Club - New Member Welcome!",
    content: "Love photography? Join us for weekly photo walks and workshops. All skill levels welcome!",
    author: "Photography Club",
    major: "Student Organization",
    timestamp: "2d ago",
    likes: 67,
    comments: [
      { id: "21", author: "David Lee", content: "Count me in!", timestamp: "1d ago" },
      { id: "22", author: "Sarah Chen", content: "Sounds fun!", timestamp: "18h ago" },
    ],
    category: "Club Promotions",
  },
];

interface Board {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  postCount: number;
}

export default function Community() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showNewPost, setShowNewPost] = useState<boolean>(false);

  const boards: Board[] = [
    {
      id: "general",
      name: "General Board",
      category: "All",
      icon: MessagesSquare,
      color: "#4169E1",
      postCount: mockPosts.length,
    },
    {
      id: "sports",
      name: "Sports Board",
      category: "Sports",
      icon: Dumbbell,
      color: "#10B981",
      postCount: mockPosts.filter(p => p.category === "Sports").length,
    },
    {
      id: "study",
      name: "Study Groups Board",
      category: "Study Groups",
      icon: BookOpen,
      color: "#F59E0B",
      postCount: mockPosts.filter(p => p.category === "Study Groups").length,
    },
    {
      id: "marketplace",
      name: "Marketplace Board",
      category: "Marketplace",
      icon: ShoppingBag,
      color: "#8B5CF6",
      postCount: mockPosts.filter(p => p.category === "Marketplace").length,
    },
    {
      id: "clubs",
      name: "Club Promotions Board",
      category: "Club Promotions",
      icon: Megaphone,
      color: "#EC4899",
      postCount: mockPosts.filter(p => p.category === "Club Promotions").length,
    },
  ];

  const handleLike = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          isLiked: !post.isLiked,
        };
      }
      return post;
    }));
  };

  const handleMessage = (author: string) => {
    navigate("/app/messages", { state: { openChatWith: author } });
  };

  if (showNewPost) {
    return (
      <NewPostScreen
        onBack={() => setShowNewPost(false)}
        onSubmit={(newPost) => {
          setPosts([newPost, ...posts]);
          setShowNewPost(false);
        }}
        boards={boards}
      />
    );
  }

  if (selectedPost) {
    return (
      <PostDetail
        post={selectedPost}
        onBack={() => setSelectedPost(null)}
        onMessage={handleMessage}
      />
    );
  }

  if (selectedBoard) {
    const board = boards.find(b => b.id === selectedBoard);
    const boardPosts = board?.category === "All"
      ? posts
      : posts.filter(post => post.category === board?.category);

    const filteredPosts = boardPosts.filter(post => {
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           post.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

    const sortedPosts = [...filteredPosts].sort((a, b) => {
      if (sortBy === "popular") {
        return b.likes - a.likes;
      }
      return 0;
    });

    return (
      <BoardView
        board={board!}
        posts={sortedPosts}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onBack={() => setSelectedBoard(null)}
        onPostClick={setSelectedPost}
        onNewPost={() => setShowNewPost(true)}
        onLike={handleLike}
      />
    );
  }

  // Board Selection Screen
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Board</h1>
            <p className="text-sm text-gray-500 mt-1">Choose a board to explore</p>
          </div>
          <button
            onClick={() => setShowNewPost(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4169E1] text-white text-sm font-medium rounded-lg hover:bg-[#3557c7] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      {/* Boards List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-3">
          {boards.map((board) => {
            const Icon = board.icon;
            return (
              <button
                key={board.id}
                onClick={() => setSelectedBoard(board.id)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${board.color}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: board.color }} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{board.name}</h3>
                    <p className="text-sm text-gray-500">{board.postCount} posts</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            );
          })}

          {/* Request New Board */}
          <button className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#4169E1]/5 to-[#4169E1]/10 border-2 border-dashed border-[#4169E1]/30 rounded-xl hover:border-[#4169E1]/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#4169E1]/10 flex items-center justify-center">
                <Plus className="w-6 h-6 text-[#4169E1]" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-[#4169E1]">Request New Board</h3>
                <p className="text-sm text-gray-500">Suggest a new community board</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#4169E1]" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Board View Screen
interface BoardViewProps {
  board: Board;
  posts: Post[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: "recent" | "popular";
  setSortBy: (sort: "recent" | "popular") => void;
  onBack: () => void;
  onPostClick: (post: Post) => void;
  onNewPost: () => void;
  onLike: (postId: string) => void;
}

function BoardView({
  board,
  posts,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  onBack,
  onPostClick,
  onNewPost,
  onLike,
}: BoardViewProps) {
  const Icon = board.icon;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${board.color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: board.color }} />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{board.name}</h1>
          </div>
          <button
            onClick={onNewPost}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#4169E1] text-white text-sm font-medium rounded-lg hover:bg-[#3557c7] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
          />
        </div>
      </div>

      {/* Sort Options */}
      <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-3">
        <button
          onClick={() => setSortBy("recent")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            sortBy === "recent"
              ? "bg-gray-200 text-gray-900 font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Recent
        </button>
        <button
          onClick={() => setSortBy("popular")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            sortBy === "popular"
              ? "bg-gray-200 text-gray-900 font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Popular
        </button>
      </div>

      {/* Posts List */}
      <div className="flex-1 overflow-auto">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Icon className="w-16 h-16 mb-4" style={{ color: `${board.color}40` }} />
            <h3 className="font-semibold text-gray-900 mb-2">No posts yet</h3>
            <p className="text-sm text-gray-500 mb-6">Be the first to start a conversation!</p>
            <button
              onClick={onNewPost}
              className="px-6 py-3 bg-[#4169E1] text-white text-sm font-medium rounded-lg hover:bg-[#3557c7] transition-colors"
            >
              Create First Post
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <div
                key={post.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onPostClick(post)}
              >
                {/* Post Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {post.author}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{post.major}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400">{post.timestamp}</span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 mb-1.5">
                      {post.title}
                    </h3>
                  </div>
                </div>

                {/* Post Content */}
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {post.content}
                </p>

                {/* Post Actions */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLike(post.id);
                    }}
                    className={`flex items-center gap-1.5 transition-colors ${
                      post.isLiked
                        ? "text-[#4169E1]"
                        : "text-gray-400 hover:text-[#4169E1]"
                    }`}
                  >
                    <ThumbsUp
                      className="w-4 h-4"
                      fill={post.isLiked ? "currentColor" : "none"}
                    />
                    <span className="text-sm font-medium">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-gray-400 hover:text-[#4169E1] transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{post.comments.length}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// New Post Screen
interface NewPostScreenProps {
  onBack: () => void;
  onSubmit: (post: Post) => void;
  boards: Board[];
}

function NewPostScreen({ onBack, onSubmit, boards }: NewPostScreenProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState(boards.find(b => b.id !== "general")?.id || "study");
  const [preventEdit, setPreventEdit] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, size: string}[]>([]);

  const selectableBoards = boards.filter(b => b.id !== "general");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages = Array.from(files).map(file => URL.createObjectURL(file));
      setAttachedImages([...attachedImages, ...newImages]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB"
      }));
      setAttachedFiles([...attachedFiles, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(attachedImages.filter((_, i) => i !== index));
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      alert("Please fill in both title and content");
      return;
    }

    const selectedBoard = boards.find(b => b.id === selectedBoardId);

    const newPost: Post = {
      id: Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      author: "John Doe", // Replace with actual user
      major: "Computer Science", // Replace with actual user major
      timestamp: "Just now",
      likes: 0,
      comments: [],
      category: selectedBoard?.category || "Study Groups",
      isLiked: false,
    };

    onSubmit(newPost);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold">New Post</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Board Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            >
              {selectableBoards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write a clear and descriptive title..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, ask questions, or provide details..."
              rows={10}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent resize-none"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <div className="space-y-3">
              {/* Upload Buttons */}
              <div className="flex gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <Image className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700">Add Images</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                  <Paperclip className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-700">Add Files</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Attached Images Preview */}
              {attachedImages.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Images ({attachedImages.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {attachedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`Attachment ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attached Files List */}
              {attachedFiles.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Files ({attachedFiles.length})</p>
                  <div className="space-y-2">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.size}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Post Options</h3>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Prevent Edit/Delete</p>
                  <p className="text-xs text-gray-500">Lock this post after publishing</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preventEdit}
                onChange={(e) => setPreventEdit(e.target.checked)}
                className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-[#4169E1] text-white rounded-xl font-medium hover:bg-[#3557c7] transition-colors"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}