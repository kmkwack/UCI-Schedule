import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";
import studyImage from "../../imports/okta_aderama_putra-exam-5893785_1920.png";

export default function Auth() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 상단 이미지 섹션 */}
      <motion.div
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative h-56 overflow-hidden"
      >
        <img
          src={studyImage}
          alt="Study"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-white"></div>
      </motion.div>

      {/* 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center px-6 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-sm"
        >
          {/* CM 모노그램 로고 */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#4169E1] rounded-3xl flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">CM</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Welcome to ClassMate
          </h1>
          <p className="text-center text-gray-500 mb-8">
            Your campus life, beautifully organized
          </p>

          {/* 버튼 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/select-university")}
            className="w-full bg-[#4169E1] text-white py-4 rounded-xl font-medium shadow-md hover:bg-[#3557c7] transition-colors flex items-center justify-center gap-2"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          {/* 하단 텍스트 */}
          <p className="text-center text-xs text-gray-400 mt-8">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
}
