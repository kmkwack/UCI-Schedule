import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, Check } from "lucide-react";

interface University {
  id: string;
  name: string;
  domain: string;
  location: string;
  logo: string;
}

const universities: University[] = [
  {
    id: "1",
    name: "UC Irvine",
    domain: "@uci.edu",
    location: "Irvine, CA",
    logo: "UCI",
  },
];

export default function UniversitySelection() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);

  const filteredUniversities = universities.filter(
    (uni) =>
      uni.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContinue = () => {
    if (selectedUniversity) {
      // Store selected university in session/state
      sessionStorage.setItem("selectedUniversity", JSON.stringify(selectedUniversity));
      navigate("/login");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 py-8 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Your University
          </h1>
          <p className="text-gray-500 mb-6">
            Choose your school to get started with ClassMate
          </p>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search universities..."
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent transition-all"
            />
          </div>

          {/* University List */}
          <div className="flex-1 overflow-auto -mx-6 px-6">
            <div className="space-y-2">
              {filteredUniversities.map((university) => (
                <button
                  key={university.id}
                  onClick={() => setSelectedUniversity(university)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    selectedUniversity?.id === university.id
                      ? "bg-[#4169E1]/10 border-2 border-[#4169E1]"
                      : "bg-white border-2 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Logo */}
                  <div className="w-14 h-14 bg-[#4169E1] rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{university.logo}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900 mb-0.5">
                      {university.name}
                    </h3>
                    <p className="text-sm text-gray-500">{university.location}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{university.domain}</p>
                  </div>

                  {/* Check Icon */}
                  {selectedUniversity?.id === university.id && (
                    <div className="w-6 h-6 bg-[#4169E1] rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}

              {filteredUniversities.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">No universities found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </div>

          {/* Continue Button */}
          {selectedUniversity && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <button
                onClick={handleContinue}
                className="w-full bg-[#4169E1] text-white py-4 rounded-xl font-medium shadow-md hover:bg-[#3557c7] transition-colors"
              >
                Continue
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
