import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [selectedUniversity, setSelectedUniversity] = useState<any>(null);

  useEffect(() => {
    // Get selected university from session
    const uni = sessionStorage.getItem("selectedUniversity");
    if (uni) {
      setSelectedUniversity(JSON.parse(uni));
    } else {
      // Redirect back to university selection if not selected
      navigate("/select-university");
    }
  }, [navigate]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* 학교 정보 카드 */}
          {selectedUniversity && (
            <div className="mb-8 p-6 bg-gradient-to-br from-[#4169E1]/5 to-[#4169E1]/10 rounded-2xl border border-[#4169E1]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-[#4169E1] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold text-lg">{selectedUniversity.logo}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">{selectedUniversity.name}</p>
                  <p className="text-sm text-gray-600">{selectedUniversity.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-white/60 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{selectedUniversity.domain}</span>
              </div>
            </div>
          )}

          {/* 제목 및 설명 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Sign In to ClassMate
            </h1>
            <p className="text-gray-600 mb-2">
              Welcome back! Continue your campus journey
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg mt-4">
              <svg className="w-4 h-4 text-[#4169E1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-[#4169E1] font-medium">
                Use your university Google account
              </span>
            </div>
          </div>

          {/* Google 로그인 버튼 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/app")}
            className="w-full bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-xl font-medium hover:border-[#4169E1] hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-3 mb-6"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-base">Continue with Google</span>
          </motion.button>

          {/* 구분선 */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* 회원가입 링크 */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              Don't have an account yet?
            </p>
            <button
              onClick={() => {
                if (selectedUniversity) {
                  sessionStorage.setItem("selectedUniversity", JSON.stringify(selectedUniversity));
                }
                navigate("/signup");
              }}
              className="text-[#4169E1] hover:text-[#3557c7] font-semibold text-base transition-colors"
            >
              Create a new account →
            </button>
          </div>

          {/* 하단 안내 */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-400 leading-relaxed">
              By continuing, you agree to ClassMate's Terms of Service and Privacy Policy
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
