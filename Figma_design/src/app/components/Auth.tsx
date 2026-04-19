import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { BookOpen, Calendar, ArrowRight } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col items-center justify-center bg-white px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm"
      >
        {/* 로고 */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center shadow-lg">
              <Calendar className="w-10 h-10 text-white" strokeWidth={2} />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
              <BookOpen className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Welcome to UniTrack
        </h1>
        <p className="text-center text-gray-500 mb-12">
          Your campus life, beautifully organized
        </p>

        {/* 버튼들 */}
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/login")}
            className="w-full bg-blue-500 text-white py-4 rounded-xl font-medium shadow-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            Sign In
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/signup")}
            className="w-full bg-white border-2 border-gray-200 text-gray-900 py-4 rounded-xl font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Create Account
          </motion.button>
        </div>

        {/* 하단 텍스트 */}
        <p className="text-center text-xs text-gray-400 mt-12">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}
