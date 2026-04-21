import { useState } from "react";
import { ArrowLeft, ThumbsUp, MessageCircle, Send } from "lucide-react";
import { useNavigate } from "react-router";

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

interface PostDetailProps {
  post: Post;
  onBack: () => void;
  onMessage: (author: string) => void;
}

export default function PostDetail({ post, onBack, onMessage }: PostDetailProps) {
  const [commentInput, setCommentInput] = useState<string>("");
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likes, setLikes] = useState(post.likes);

  const handleAddComment = () => {
    if (!commentInput.trim()) return;

    const newComment: Comment = {
      id: `c${Date.now()}`,
      author: "You",
      content: commentInput,
      timestamp: "Just now",
    };

    setComments([...comments, newComment]);
    setCommentInput("");
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikes(isLiked ? likes - 1 : likes + 1);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Post</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Post */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {post.author}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{post.major}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-400">{post.timestamp}</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {post.title}
              </h2>
            </div>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded-full whitespace-nowrap ml-3">
              {post.category}
            </span>
          </div>

          <p className="text-sm text-gray-700 mb-4">{post.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-colors ${
                isLiked ? "text-[#4169E1]" : "text-gray-400 hover:text-[#4169E1]"
              }`}
            >
              <ThumbsUp
                className="w-4 h-4"
                fill={isLiked ? "currentColor" : "none"}
              />
              <span className="text-sm font-medium">{likes}</span>
            </button>
            <button className="flex items-center gap-1.5 text-gray-400">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{comments.length}</span>
            </button>
            <button
              onClick={() => onMessage(post.author)}
              className="ml-auto p-2 bg-[#4169E1] text-white rounded-lg hover:bg-[#3557c7] transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Comments ({comments.length})
          </h3>

          <div className="space-y-4 mb-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                  {comment.author.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {comment.author}
                    </span>
                    <span className="text-xs text-gray-400">
                      {comment.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Add Comment */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddComment()}
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            />
            <button
              onClick={handleAddComment}
              disabled={!commentInput.trim()}
              className="p-2.5 bg-[#4169E1] text-white rounded-full hover:bg-[#3557c7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}