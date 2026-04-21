import { Cloud, Calendar, Trophy, Dribbble, Sparkles, User } from "lucide-react";
import { useState } from "react";
import Settings from "./Settings";

export default function Home() {
  const [showSettings, setShowSettings] = useState(false);
  const today = new Date();
  const dateString = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // 오늘의 명언 목록
  const quotes = [
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  ];

  // 랜덤 선택
  const dailyQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return (
    <>
      <div className="min-h-full px-6 py-8 bg-white">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl">Home</h1>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <User className="w-6 h-6 text-gray-700" />
            </button>
          </div>
          <p className="text-gray-500">{dateString} · Week 3</p>
        </div>

      {/* AI Daily Briefing */}
      <div className="space-y-4">
        {/* Summary Card with Coming Up */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm text-gray-500 mb-4">Your Day</h2>
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl">4</span>
              <span className="text-gray-600">classes today</span>
            </div>

            {/* Daily Quote */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-700 italic mb-1.5">"{dailyQuote.text}"</p>
              <p className="text-xs text-gray-500">— {dailyQuote.author}</p>
            </div>

            {/* Coming Up */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">Coming Up</p>
              <div className="flex items-start gap-3">
                <div className="w-1 h-12 bg-purple-400 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Computer Science 101</p>
                  <p className="text-sm text-gray-500">9:00 - 10:30 AM</p>
                  <p className="text-sm text-gray-400">Room A-204</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weather Card */}
        <div className="bg-gradient-to-br from-[#4169E1]/10 to-[#4169E1]/20 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm text-[#4169E1]/60 mb-2">Weather</h2>
              <p className="text-3xl mb-1">22°</p>
              <p className="text-[#4169E1]/70">Partly Cloudy</p>
            </div>
            <Cloud className="w-12 h-12 text-[#4169E1]/40" strokeWidth={1.5} />
          </div>
        </div>

        {/* Campus Events */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm text-gray-500">Campus Events</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-orange-600" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Basketball vs State University</p>
                <p className="text-sm text-gray-500">Tomorrow, 7:00 PM</p>
                <p className="text-sm text-gray-400">Main Arena</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Dribbble className="w-5 h-5 text-green-600" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Soccer Match - Home Game</p>
                <p className="text-sm text-gray-500">Saturday, 3:00 PM</p>
                <p className="text-sm text-gray-400">University Stadium</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Settings Modal */}
    {showSettings && <Settings onClose={() => setShowSettings(false)} />}
  </>
  );
}