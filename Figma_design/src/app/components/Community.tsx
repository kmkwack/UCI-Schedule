import { useState } from "react";
import { Plus, Search, ThumbsUp, MessageCircle, Clock, TrendingUp, Send } from "lucide-react";
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

const categories = ["All", "Sports", "Study Groups", "Marketplace", "Club Promotions"];

export default function Community() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

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

  if (selectedPost) {
    return (
      <PostDetail
        post={selectedPost}
        onBack={() => setSelectedPost(null)}
        onMessage={handleMessage}
      />
    );
  }

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === "popular") {
      return b.likes - a.likes;
    }
    return 0; // Keep original order for recent
  });

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl">Community</h1>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors">
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
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="px-6 py-3 border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
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
        <div className="divide-y divide-gray-100">
          {sortedPosts.map((post) => (
            <div
              key={post.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setSelectedPost(post)}
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
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full whitespace-nowrap ml-3">
                  {post.category}
                </span>
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
                    handleLike(post.id);
                  }}
                  className={`flex items-center gap-1.5 transition-colors ${
                    post.isLiked
                      ? "text-blue-500"
                      : "text-gray-400 hover:text-blue-500"
                  }`}
                >
                  <ThumbsUp
                    className="w-4 h-4"
                    fill={post.isLiked ? "currentColor" : "none"}
                  />
                  <span className="text-sm font-medium">{post.likes}</span>
                </button>
                <button className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{post.comments.length}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}