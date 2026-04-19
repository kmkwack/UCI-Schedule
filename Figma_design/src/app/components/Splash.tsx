import { useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { BookOpen, Calendar } from "lucide-react";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    // 3초 후 자동으로 auth 화면으로 이동
    const timer = setTimeout(() => {
      navigate("/auth");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="h-full flex items-center justify-center bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        {/* 임시 로고 - 아이콘 조합 */}
        <motion.div
          initial={{ rotate: -10 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 bg-blue-500 rounded-3xl flex items-center justify-center shadow-lg">
            <Calendar className="w-12 h-12 text-white" strokeWidth={2} />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="absolute -bottom-2 -right-2 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center shadow-md"
          >
            <BookOpen className="w-5 h-5 text-white" strokeWidth={2.5} />
          </motion.div>
        </motion.div>

        {/* 임시 앱 이름 */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-3xl font-bold text-gray-900 mb-2"
        >
          UniTrack
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-sm text-gray-500"
        >
          Your Campus Life, Organized
        </motion.p>

        {/* 로딩 인디케이터 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1 }}
          className="mt-12 flex gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-2 h-2 bg-blue-500 rounded-full"
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
