import { useState, useRef, Fragment } from "react";
import { Plus, ChevronDown, Search, MoreVertical, X, Calendar, Star, Filter, User } from "lucide-react";

interface ClassEvent {
  id: string;
  name: string;
  day: number; // 0 = Monday, 1 = Tuesday, etc.
  startTime: number; // in minutes from midnight (e.g., 540 = 9:00 AM)
  endTime: number;
  color: string;
  room: string;
  instructor: string;
  plan: string; // A, B, or C
}

interface CourseOption {
  id: string;
  code: string;
  name: string;
  instructor: string;
  day: number;
  startTime: number;
  endTime: number;
  room: string;
  credits: number;
  department: string;
  rating: number;
  reviewCount: number;
  color: string;
}

interface CourseReview {
  id: string;
  courseId: string;
  author: string;
  rating: number;
  date: string;
  content: string;
  semester: string;
  difficulty: number;
  workload: number;
}

const mockClasses: ClassEvent[] = [
  // Plan A - Weekdays only
  {
    id: "1",
    name: "Computer Science 101",
    day: 0,
    startTime: 540,
    endTime: 630,
    color: "bg-purple-100 border-purple-300 text-purple-900",
    room: "A-204",
    instructor: "Prof. Smith",
    plan: "A",
  },
  {
    id: "2",
    name: "Mathematics",
    day: 0,
    startTime: 660,
    endTime: 750,
    color: "bg-[#4169E1]/10 border-[#4169E1]/30 text-[#4169E1]",
    room: "B-101",
    instructor: "Prof. Johnson",
    plan: "A",
  },
  {
    id: "3",
    name: "Physics Lab",
    day: 1,
    startTime: 600,
    endTime: 720,
    color: "bg-green-100 border-green-300 text-green-900",
    room: "Lab 3",
    instructor: "Prof. Davis",
    plan: "A",
  },
  {
    id: "4",
    name: "English Literature",
    day: 2,
    startTime: 540,
    endTime: 630,
    color: "bg-pink-100 border-pink-300 text-pink-900",
    room: "C-305",
    instructor: "Prof. Williams",
    plan: "A",
  },
  {
    id: "5",
    name: "History",
    day: 2,
    startTime: 780,
    endTime: 870,
    color: "bg-amber-100 border-amber-300 text-amber-900",
    room: "D-201",
    instructor: "Prof. Brown",
    plan: "A",
  },
  {
    id: "6",
    name: "Chemistry",
    day: 3,
    startTime: 600,
    endTime: 690,
    color: "bg-teal-100 border-teal-300 text-teal-900",
    room: "Lab 1",
    instructor: "Prof. Lee",
    plan: "A",
  },
  {
    id: "7",
    name: "Programming",
    day: 4,
    startTime: 660,
    endTime: 780,
    color: "bg-indigo-100 border-indigo-300 text-indigo-900",
    room: "A-103",
    instructor: "Prof. Garcia",
    plan: "A",
  },
  
  // Plan B - With weekend classes
  {
    id: "b1",
    name: "Data Structures",
    day: 0,
    startTime: 540,
    endTime: 660,
    color: "bg-purple-100 border-purple-300 text-purple-900",
    room: "B-301",
    instructor: "Prof. Martinez",
    plan: "B",
  },
  {
    id: "b2",
    name: "Calculus II",
    day: 1,
    startTime: 600,
    endTime: 690,
    color: "bg-[#4169E1]/10 border-[#4169E1]/30 text-[#4169E1]",
    room: "A-102",
    instructor: "Prof. Anderson",
    plan: "B",
  },
  {
    id: "b3",
    name: "Psychology",
    day: 2,
    startTime: 720,
    endTime: 810,
    color: "bg-pink-100 border-pink-300 text-pink-900",
    room: "C-201",
    instructor: "Prof. Taylor",
    plan: "B",
  },
  {
    id: "b4",
    name: "Economics",
    day: 3,
    startTime: 660,
    endTime: 750,
    color: "bg-green-100 border-green-300 text-green-900",
    room: "D-105",
    instructor: "Prof. Thomas",
    plan: "B",
  },
  {
    id: "b5",
    name: "Statistics",
    day: 4,
    startTime: 540,
    endTime: 630,
    color: "bg-teal-100 border-teal-300 text-teal-900",
    room: "B-204",
    instructor: "Prof. Moore",
    plan: "B",
  },
  {
    id: "b6",
    name: "Art History",
    day: 5,
    startTime: 600,
    endTime: 720,
    color: "bg-amber-100 border-amber-300 text-amber-900",
    room: "Art-101",
    instructor: "Prof. White",
    plan: "B",
  },
  {
    id: "b7",
    name: "Music Theory",
    day: 6,
    startTime: 660,
    endTime: 750,
    color: "bg-rose-100 border-rose-300 text-rose-900",
    room: "Music-201",
    instructor: "Prof. Harris",
    plan: "B",
  },

  // Plan C - Different schedule with weekend
  {
    id: "c1",
    name: "Machine Learning",
    day: 0,
    startTime: 660,
    endTime: 780,
    color: "bg-indigo-100 border-indigo-300 text-indigo-900",
    room: "CS-401",
    instructor: "Prof. Chen",
    plan: "C",
  },
  {
    id: "c2",
    name: "Database Systems",
    day: 1,
    startTime: 540,
    endTime: 630,
    color: "bg-purple-100 border-purple-300 text-purple-900",
    room: "CS-301",
    instructor: "Prof. Kim",
    plan: "C",
  },
  {
    id: "c3",
    name: "Operating Systems",
    day: 2,
    startTime: 600,
    endTime: 720,
    color: "bg-[#4169E1]/10 border-[#4169E1]/30 text-[#4169E1]",
    room: "CS-201",
    instructor: "Prof. Patel",
    plan: "C",
  },
  {
    id: "c4",
    name: "Web Development",
    day: 3,
    startTime: 720,
    endTime: 840,
    color: "bg-green-100 border-green-300 text-green-900",
    room: "CS-101",
    instructor: "Prof. Rodriguez",
    plan: "C",
  },
  {
    id: "c5",
    name: "Software Engineering",
    day: 4,
    startTime: 540,
    endTime: 660,
    color: "bg-teal-100 border-teal-300 text-teal-900",
    room: "CS-501",
    instructor: "Prof. Wilson",
    plan: "C",
  },
  {
    id: "c6",
    name: "Cloud Computing",
    day: 5,
    startTime: 540,
    endTime: 630,
    color: "bg-cyan-100 border-cyan-300 text-cyan-900",
    room: "CS-601",
    instructor: "Prof. Lopez",
    plan: "C",
  },
  {
    id: "c7",
    name: "Mobile Development",
    day: 6,
    startTime: 600,
    endTime: 720,
    color: "bg-pink-100 border-pink-300 text-pink-900",
    room: "CS-302",
    instructor: "Prof. Clark",
    plan: "C",
  },
];

const mockReviews: CourseReview[] = [
  {
    id: "review-1",
    courseId: "course-1",
    author: "Anonymous",
    rating: 5,
    date: "2025-12-15",
    content: "Excellent course! Prof. Anderson explains complex algorithms in a very intuitive way. The assignments are challenging but fair. Highly recommend taking this class if you're serious about CS.",
    semester: "Fall 2025",
    difficulty: 4,
    workload: 4,
  },
  {
    id: "review-2",
    courseId: "course-1",
    author: "Student123",
    rating: 4,
    date: "2025-12-10",
    content: "Great course overall. The material is very useful and applicable. Exams were tough but the curve helps. Make sure to attend all lectures.",
    semester: "Fall 2025",
    difficulty: 5,
    workload: 5,
  },
  {
    id: "review-3",
    courseId: "course-3",
    author: "PhysicsLover",
    rating: 5,
    date: "2025-11-20",
    content: "Best physics course I've taken! Prof. Chen is amazing and really cares about student learning. The lab work is fascinating.",
    semester: "Fall 2025",
    difficulty: 4,
    workload: 3,
  },
];

const mockCourses: CourseOption[] = [
  {
    id: "course-1",
    code: "CS 301",
    name: "Advanced Algorithms",
    instructor: "Prof. Anderson",
    day: 0,
    startTime: 540,
    endTime: 630,
    room: "CS-201",
    credits: 3,
    department: "Computer Science",
    rating: 4.5,
    reviewCount: 127,
    color: "bg-purple-100 border-purple-300 text-purple-900",
  },
  {
    id: "course-2",
    code: "MATH 205",
    name: "Linear Algebra",
    instructor: "Prof. Martinez",
    day: 1,
    startTime: 660,
    endTime: 750,
    room: "MATH-104",
    credits: 4,
    department: "Mathematics",
    rating: 4.2,
    reviewCount: 89,
    color: "bg-[#4169E1]/10 border-[#4169E1]/30 text-[#4169E1]",
  },
  {
    id: "course-3",
    code: "PHYS 201",
    name: "Quantum Mechanics",
    instructor: "Prof. Chen",
    day: 2,
    startTime: 600,
    endTime: 720,
    room: "PHYS-301",
    credits: 4,
    department: "Physics",
    rating: 4.8,
    reviewCount: 156,
    color: "bg-green-100 border-green-300 text-green-900",
  },
  {
    id: "course-4",
    code: "ENG 305",
    name: "Modern Literature",
    instructor: "Prof. Williams",
    day: 3,
    startTime: 780,
    endTime: 870,
    room: "ENG-102",
    credits: 3,
    department: "English",
    rating: 4.6,
    reviewCount: 94,
    color: "bg-pink-100 border-pink-300 text-pink-900",
  },
  {
    id: "course-5",
    code: "BUS 220",
    name: "Financial Accounting",
    instructor: "Prof. Taylor",
    day: 4,
    startTime: 540,
    endTime: 630,
    room: "BUS-405",
    credits: 3,
    department: "Business",
    rating: 3.9,
    reviewCount: 201,
    color: "bg-amber-100 border-amber-300 text-amber-900",
  },
  {
    id: "course-6",
    code: "CHEM 301",
    name: "Organic Chemistry II",
    instructor: "Prof. Lee",
    day: 0,
    startTime: 660,
    endTime: 780,
    room: "CHEM-Lab2",
    credits: 4,
    department: "Chemistry",
    rating: 4.1,
    reviewCount: 112,
    color: "bg-teal-100 border-teal-300 text-teal-900",
  },
  {
    id: "course-7",
    code: "PSY 101",
    name: "Introduction to Psychology",
    instructor: "Prof. Robinson",
    day: 2,
    startTime: 540,
    endTime: 630,
    room: "PSY-201",
    credits: 3,
    department: "Psychology",
    rating: 4.7,
    reviewCount: 243,
    color: "bg-indigo-100 border-indigo-300 text-indigo-900",
  },
  {
    id: "course-8",
    code: "ART 250",
    name: "Digital Design",
    instructor: "Prof. Kim",
    day: 3,
    startTime: 600,
    endTime: 720,
    room: "ART-Studio",
    credits: 3,
    department: "Art",
    rating: 4.9,
    reviewCount: 87,
    color: "bg-rose-100 border-rose-300 text-rose-900",
  },
];

export default function Timetable() {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("A");
  const [friendSearch, setFriendSearch] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showSemesterMenu, setShowSemesterMenu] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState("Spring 2026");
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({
    department: "",
    instructor: "",
    day: "",
    credits: "",
    time: "",
  });
  const [showFilterDropdown, setShowFilterDropdown] = useState<string | null>(null);
  const [previewCourse, setPreviewCourse] = useState<CourseOption | null>(null);
  const [tempAddedCourses, setTempAddedCourses] = useState<CourseOption[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const [selectedCourseForReview, setSelectedCourseForReview] = useState<CourseOption | null>(null);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    difficulty: 3,
    workload: 3,
    content: "",
  });
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic time range
  const startHour = 8;
  const endHour = 19;
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const handleClassClick = (classEvent: ClassEvent) => {
    setSelectedClass(classEvent.id);
    // Scroll to the time slot
    if (gridRef.current) {
      const hourIndex = Math.floor(classEvent.startTime / 60) - startHour;
      const scrollTarget = hourIndex * 60; // 60px per hour
      gridRef.current.scrollTop = scrollTarget;
    }
  };

  // Filter classes by selected plan
  const filteredClasses = mockClasses.filter(c => c.plan === selectedPlan);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Timetable</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowSemesterMenu(!showSemesterMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {selectedSemester}
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Semester Dropdown Menu */}
              {showSemesterMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSemesterMenu(false)}
                  ></div>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {["Spring 2026", "Fall 2025", "Spring 2025", "Fall 2024"].map((semester) => (
                      <button
                        key={semester}
                        onClick={() => {
                          setSelectedSemester(semester);
                          setShowSemesterMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                          selectedSemester === semester
                            ? "text-[#4169E1] font-medium bg-[#4169E1]/5"
                            : "text-gray-700"
                        }`}
                      >
                        {semester}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Timetable Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
              {/* Theme Selection */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Timetable Theme</h3>
                <div className="space-y-2">
                  {["Default", "Minimal", "Colorful", "Dark"].map((theme) => (
                    <label
                      key={theme}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="theme"
                        defaultChecked={theme === "Default"}
                        className="w-4 h-4 text-[#4169E1] focus:ring-[#4169E1]"
                      />
                      <span className="text-sm text-gray-700">{theme}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Display Options */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Display Information</h3>
                <div className="space-y-2">
                  {[
                    { label: "Class Name", checked: true },
                    { label: "Room Number", checked: true },
                    { label: "Instructor", checked: true },
                    { label: "Time", checked: true },
                  ].map((option) => (
                    <label
                      key={option.label}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={option.checked}
                        className="w-4 h-4 rounded text-[#4169E1] focus:ring-[#4169E1]"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* View Options */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">View Options</h3>
                <div className="space-y-2">
                  {["Week View", "Month View", "Agenda View"].map((view) => (
                    <label
                      key={view}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="view"
                        defaultChecked={view === "Week View"}
                        className="w-4 h-4 text-[#4169E1] focus:ring-[#4169E1]"
                      />
                      <span className="text-sm text-gray-700">{view}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-[#4169E1] text-white py-3 rounded-xl font-medium hover:bg-[#3557c7] transition-colors"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Selector */}
      <div className="px-6 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {["A", "B", "C"].map((plan) => (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedPlan === plan
                    ? "bg-[#4169E1] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Plan {plan}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>

            {/* Add Dropdown Menu */}
            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAddMenu(false)}
                ></div>
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      setShowCourseSearch(true);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Course
                  </button>
                  <div className="border-t border-gray-100"></div>
                  <button
                    onClick={() => {
                      setShowAddMenu(false);
                      // TODO: Add timetable logic
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Add Timetable
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto px-4 py-3">
        <div className="grid grid-cols-6 gap-0 border border-gray-200 rounded-lg overflow-hidden">
          {/* Empty top-left cell */}
          <div className="sticky top-0 left-0 bg-gray-50 z-20 border-b border-r border-gray-200 text-center py-2"></div>
          
          {/* Header Row - Days */}
          {days.map((day, idx) => (
            <div
              key={day}
              className={`sticky top-0 bg-gray-50 z-10 text-center py-2 text-sm font-medium text-gray-700 border-b ${
                idx < days.length - 1 ? 'border-r' : ''
              } border-gray-200`}
            >
              {day}
            </div>
          ))}

          {/* Time slots with grid */}
          {hours.map((hour, hourIdx) => (
            <Fragment key={`hour-${hour}`}>
              {/* Time cell */}
              <div className={`sticky left-0 bg-gray-50 z-10 border-r ${
                hourIdx < hours.length - 1 ? 'border-b' : ''
              } border-gray-200 flex items-center justify-center text-xs text-gray-500 font-medium h-[60px]`}>
                {hour}:00
              </div>

              {/* Day cells */}
              {days.map((_, dayIndex) => (
                <div
                  key={`${hour}-${dayIndex}`}
                  className={`${
                    hourIdx < hours.length - 1 ? 'border-b' : ''
                  } ${
                    dayIndex < days.length - 1 ? 'border-r' : ''
                  } border-gray-200 h-[60px] relative bg-white`}
                >
                  {/* Render preview course */}
                  {previewCourse &&
                    previewCourse.day === dayIndex &&
                    Math.floor(previewCourse.startTime / 60) === hour && (
                      <div
                        className={`absolute rounded-md border-2 border-dashed p-1.5 opacity-50 ${previewCourse.color}`}
                        style={{
                          height: `${((previewCourse.endTime - previewCourse.startTime) / 60) * 60 - 4}px`,
                          left: "3px",
                          right: "3px",
                          top: "2px",
                          zIndex: 3,
                        }}
                      >
                        <p className="text-xs font-medium leading-tight overflow-hidden">
                          {previewCourse.name}
                        </p>
                        <p className="text-[10px] opacity-70 mt-0.5 overflow-hidden">
                          {previewCourse.room}
                        </p>
                      </div>
                    )}

                  {/* Render temp added courses */}
                  {tempAddedCourses
                    .filter(
                      (c) =>
                        c.day === dayIndex &&
                        Math.floor(c.startTime / 60) === hour
                    )
                    .map((course) => {
                      const duration = course.endTime - course.startTime;
                      const height = (duration / 60) * 60;

                      return (
                        <div
                          key={course.id}
                          className={`absolute rounded-md border-2 p-1.5 opacity-60 ${course.color}`}
                          style={{
                            height: `${height - 4}px`,
                            left: "3px",
                            right: "3px",
                            top: "2px",
                            zIndex: 4,
                          }}
                        >
                          <p className="text-xs font-medium leading-tight overflow-hidden">
                            {course.name}
                          </p>
                          <p className="text-[10px] opacity-70 mt-0.5 overflow-hidden">
                            {course.room}
                          </p>
                        </div>
                      );
                    })}

                  {/* Render classes */}
                  {filteredClasses
                    .filter(
                      (c) =>
                        c.day === dayIndex &&
                        Math.floor(c.startTime / 60) === hour
                    )
                    .map((classEvent) => {
                      const duration =
                        classEvent.endTime - classEvent.startTime;
                      const height = (duration / 60) * 60; // 60px per hour
                      const isSelected = selectedClass === classEvent.id;

                      return (
                        <div
                          key={classEvent.id}
                          className={`absolute rounded-md border p-1.5 cursor-pointer transition-all ${
                            classEvent.color
                          } ${
                            isSelected
                              ? "ring-2 ring-[#4169E1] shadow-md"
                              : "shadow-sm"
                          }`}
                          style={{
                            height: `${height - 4}px`,
                            left: "3px",
                            right: "3px",
                            top: "2px",
                            zIndex: 5
                          }}
                          onClick={() => handleClassClick(classEvent)}
                        >
                          <p className="text-xs font-medium leading-tight overflow-hidden">
                            {classEvent.name}
                          </p>
                          <p className="text-[10px] opacity-70 mt-0.5 overflow-hidden">
                            {classEvent.room}
                          </p>
                          <p className="text-[10px] opacity-60 mt-0.5 overflow-hidden">
                            {classEvent.instructor}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Course Search Full Screen */}
      {showCourseSearch && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={() => {
                setShowCourseSearch(false);
                setPreviewCourse(null);
                setTempAddedCourses([]);
                setCourseSearchQuery("");
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg">
                Wizard
              </button>
              <button className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg">
                Add manually
              </button>
            </div>
          </div>

          {/* Mini Timetable */}
          <div className="border-b border-gray-200 bg-gray-50 overflow-auto" style={{ height: "35%" }}>
            <div ref={gridRef} className="p-2 overflow-auto h-full">
              <div className="grid grid-cols-8 gap-0.5 min-w-max">
                {/* Time column header */}
                <div className="w-8"></div>
                {/* Day headers */}
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-600 py-1 min-w-[70px]">
                    {day}
                  </div>
                ))}

                {/* Time slots */}
                {hours.map((hour) => (
                  <Fragment key={`mini-${hour}`}>
                    <div className="text-[10px] text-gray-500 text-right pr-1 h-12 flex items-start pt-1 w-8">
                      {hour}
                    </div>
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                      <div
                        key={`mini-${hour}-${dayIndex}`}
                        className="bg-white border border-gray-200 h-12 relative min-w-[70px]"
                      >
                        {/* Preview course */}
                        {previewCourse &&
                          previewCourse.day === dayIndex &&
                          Math.floor(previewCourse.startTime / 60) === hour && (
                            <div
                              className={`absolute inset-0.5 rounded border-2 border-dashed opacity-70 ${previewCourse.color} text-[9px] p-0.5 overflow-hidden`}
                              style={{
                                height: `${((previewCourse.endTime - previewCourse.startTime) / 60) * 48 - 4}px`,
                              }}
                            >
                              <div className="font-medium leading-tight">{previewCourse.code}</div>
                            </div>
                          )}

                        {/* Temp added courses */}
                        {tempAddedCourses
                          .filter((c) => c.day === dayIndex && Math.floor(c.startTime / 60) === hour)
                          .map((course) => (
                            <div
                              key={course.id}
                              className={`absolute inset-0.5 rounded ${course.color} text-[9px] p-0.5 overflow-hidden opacity-80`}
                              style={{
                                height: `${((course.endTime - course.startTime) / 60) * 48 - 4}px`,
                              }}
                            >
                              <div className="font-medium leading-tight">{course.code}</div>
                            </div>
                          ))}

                        {/* Existing classes */}
                        {filteredClasses
                          .filter((c) => c.day === dayIndex && Math.floor(c.startTime / 60) === hour)
                          .map((classEvent) => (
                            <div
                              key={classEvent.id}
                              className={`absolute inset-0.5 rounded ${classEvent.color} text-[9px] p-0.5 overflow-hidden`}
                              style={{
                                height: `${((classEvent.endTime - classEvent.startTime) / 60) * 48 - 4}px`,
                              }}
                            >
                              <div className="font-medium leading-tight">{classEvent.name}</div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {/* Department Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(showFilterDropdown === "department" ? null : "department")}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    selectedFilters.department
                      ? "bg-[#4169E1] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  {selectedFilters.department || "Department"}
                  {selectedFilters.department && (
                    <X
                      className="w-3 h-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilters({ ...selectedFilters, department: "" });
                      }}
                    />
                  )}
                </button>

                {showFilterDropdown === "department" && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(null)}></div>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[160px]">
                      {["Computer Science", "Mathematics", "Physics", "Chemistry", "Biology", "Business"].map((dept) => (
                        <button
                          key={dept}
                          onClick={() => {
                            setSelectedFilters({ ...selectedFilters, department: dept });
                            setShowFilterDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Day Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(showFilterDropdown === "day" ? null : "day")}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    selectedFilters.day
                      ? "bg-[#4169E1] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {selectedFilters.day || "Day"}
                  {selectedFilters.day && (
                    <X
                      className="w-3 h-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilters({ ...selectedFilters, day: "" });
                      }}
                    />
                  )}
                </button>

                {showFilterDropdown === "day" && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(null)}></div>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[120px]">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                        <button
                          key={day}
                          onClick={() => {
                            setSelectedFilters({ ...selectedFilters, day });
                            setShowFilterDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Time Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(showFilterDropdown === "time" ? null : "time")}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    selectedFilters.time
                      ? "bg-[#4169E1] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {selectedFilters.time || "Time"}
                  {selectedFilters.time && (
                    <X
                      className="w-3 h-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilters({ ...selectedFilters, time: "" });
                      }}
                    />
                  )}
                </button>

                {showFilterDropdown === "time" && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(null)}></div>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[140px]">
                      {["Morning (8-12)", "Afternoon (12-17)", "Evening (17-21)"].map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            setSelectedFilters({ ...selectedFilters, time });
                            setShowFilterDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Credits Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(showFilterDropdown === "credits" ? null : "credits")}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    selectedFilters.credits
                      ? "bg-[#4169E1] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  {selectedFilters.credits || "Credits"}
                  {selectedFilters.credits && (
                    <X
                      className="w-3 h-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilters({ ...selectedFilters, credits: "" });
                      }}
                    />
                  )}
                </button>

                {showFilterDropdown === "credits" && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(null)}></div>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[100px]">
                      {["1", "2", "3", "4", "5+"].map((credit) => (
                        <button
                          key={credit}
                          onClick={() => {
                            setSelectedFilters({ ...selectedFilters, credits: credit });
                            setShowFilterDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {credit} {credit === "5+" ? "credits" : "credit"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Instructor Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterDropdown(showFilterDropdown === "instructor" ? null : "instructor")}
                  className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    selectedFilters.instructor
                      ? "bg-[#4169E1] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <User className="w-3 h-3" />
                  {selectedFilters.instructor || "Instructor"}
                  {selectedFilters.instructor && (
                    <X
                      className="w-3 h-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFilters({ ...selectedFilters, instructor: "" });
                      }}
                    />
                  )}
                </button>

                {showFilterDropdown === "instructor" && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(null)}></div>
                    <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[140px]">
                      {["Prof. Anderson", "Prof. Martinez", "Prof. Chen", "Prof. Williams", "Prof. Taylor"].map((prof) => (
                        <button
                          key={prof}
                          onClick={() => {
                            setSelectedFilters({ ...selectedFilters, instructor: prof });
                            setShowFilterDropdown(null);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                        >
                          {prof}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Clear Filters */}
            {(selectedFilters.department || selectedFilters.day || selectedFilters.time || selectedFilters.credits || selectedFilters.instructor) && (
              <button
                onClick={() => setSelectedFilters({ department: "", instructor: "", day: "", credits: "", time: "" })}
                className="text-xs text-[#4169E1] hover:text-[#3557c7] font-medium mt-2"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Course List */}
          <div className="flex-1 overflow-auto">
            {(() => {
              const filteredCourses = mockCourses
              .filter((course) => {
                // Search filter
                const matchesSearch =
                  !courseSearchQuery ||
                  course.name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                  course.code.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
                  course.instructor.toLowerCase().includes(courseSearchQuery.toLowerCase());

                // Department filter
                const matchesDepartment =
                  !selectedFilters.department || course.department === selectedFilters.department;

                // Day filter
                const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                const matchesDay = !selectedFilters.day || days[course.day] === selectedFilters.day;

                // Time filter
                const courseStartHour = Math.floor(course.startTime / 60);
                const matchesTime =
                  !selectedFilters.time ||
                  (selectedFilters.time === "Morning (8-12)" && courseStartHour >= 8 && courseStartHour < 12) ||
                  (selectedFilters.time === "Afternoon (12-17)" && courseStartHour >= 12 && courseStartHour < 17) ||
                  (selectedFilters.time === "Evening (17-21)" && courseStartHour >= 17 && courseStartHour < 21);

                // Credits filter
                const matchesCredits =
                  !selectedFilters.credits ||
                  (selectedFilters.credits === "5+" && course.credits >= 5) ||
                  course.credits.toString() === selectedFilters.credits;

                // Instructor filter
                const matchesInstructor =
                  !selectedFilters.instructor || course.instructor === selectedFilters.instructor;

                return matchesSearch && matchesDepartment && matchesDay && matchesTime && matchesCredits && matchesInstructor;
              });

              if (filteredCourses.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <Search className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium mb-1">No courses found</p>
                    <p className="text-sm text-gray-400">Try adjusting your filters or search query</p>
                  </div>
                );
              }

              return filteredCourses.map((course) => {
                const isAdded = tempAddedCourses.find((c) => c.id === course.id);
                const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                const startHourDisplay = Math.floor(course.startTime / 60);
                const startMinDisplay = course.startTime % 60;
                const endHourDisplay = Math.floor(course.endTime / 60);
                const endMinDisplay = course.endTime % 60;

                return (
                  <div
                    key={course.id}
                    className="px-4 py-4 border-b border-gray-100"
                    onClick={() => {
                      setPreviewCourse(course);
                      // Scroll timetable to course position
                      if (gridRef.current) {
                        const hourIndex = Math.floor(course.startTime / 60) - startHour;
                        const scrollTarget = hourIndex * 48;
                        gridRef.current.scrollTop = scrollTarget;
                      }
                    }}
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-medium text-gray-900">{course.name}</h3>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < Math.floor(course.rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "fill-gray-200 text-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">{course.instructor}</div>
                      <div className="text-sm text-gray-500 mb-1">
                        {course.code} · {course.credits}학점
                      </div>
                      <div className="text-sm text-gray-500 mb-1">{course.room}</div>
                      <div className="text-sm text-gray-500">
                        {days[course.day]} {startHourDisplay}:{startMinDisplay.toString().padStart(2, "0")} -{" "}
                        {endHourDisplay}:{endMinDisplay.toString().padStart(2, "0")}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Added {course.reviewCount}</div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdded) {
                            setTempAddedCourses(tempAddedCourses.filter((c) => c.id !== course.id));
                          } else {
                            setTempAddedCourses([...tempAddedCourses, course]);
                          }
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isAdded
                            ? "bg-gray-200 text-gray-700"
                            : "bg-[#4169E1] text-white hover:bg-[#3557c7]"
                        }`}
                      >
                        {isAdded ? "Added" : "Add to table"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourseForReview(course);
                          setShowReviews(true);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Reviews
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Course Reviews Modal */}
      {showReviews && selectedCourseForReview && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{selectedCourseForReview.name}</h2>
                  <div className="text-sm text-gray-600">
                    {selectedCourseForReview.code} · {selectedCourseForReview.instructor}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowReviews(false);
                    setSelectedCourseForReview(null);
                    setShowWriteReview(false);
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rating Summary */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(selectedCourseForReview.rating)
                            ? "fill-amber-400 text-amber-400"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold text-lg">{selectedCourseForReview.rating}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {mockReviews.filter((r) => r.courseId === selectedCourseForReview.id).length} reviews
                </span>
              </div>
            </div>

            {/* Reviews List */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {mockReviews.filter((r) => r.courseId === selectedCourseForReview.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Star className="w-16 h-16 mb-3 opacity-20" />
                  <p className="text-lg font-medium mb-1">No reviews yet</p>
                  <p className="text-sm">Be the first to review this course!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {mockReviews
                    .filter((r) => r.courseId === selectedCourseForReview.id)
                    .map((review) => (
                      <div key={review.id} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{review.author}</span>
                              <span className="text-xs text-gray-500">{review.semester}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${
                                    i < review.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-gray-200 text-gray-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{review.date}</span>
                        </div>

                        <p className="text-sm text-gray-700 mb-3 leading-relaxed">{review.content}</p>

                        <div className="flex gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Difficulty:</span>
                            <span className="font-medium text-gray-700">{review.difficulty}/5</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Workload:</span>
                            <span className="font-medium text-gray-700">{review.workload}/5</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowWriteReview(true)}
                className="w-full bg-[#4169E1] text-white py-3 rounded-xl font-medium hover:bg-[#3557c7] transition-colors"
              >
                Write a Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {showWriteReview && selectedCourseForReview && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Write a Review</h2>
                <button
                  onClick={() => {
                    setShowWriteReview(false);
                    setNewReview({ rating: 5, difficulty: 3, workload: 3, content: "" });
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {selectedCourseForReview.code} · {selectedCourseForReview.name}
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-auto px-6 py-4 space-y-5">
              {/* Overall Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setNewReview({ ...newReview, rating })}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          rating <= newReview.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-gray-200 text-gray-200"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-lg font-semibold text-gray-700">{newReview.rating}/5</span>
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulty (1 = Easy, 5 = Hard)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => setNewReview({ ...newReview, difficulty: level })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newReview.difficulty === level
                          ? "bg-[#4169E1] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Workload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workload (1 = Light, 5 = Heavy)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      onClick={() => setNewReview({ ...newReview, workload: level })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newReview.workload === level
                          ? "bg-[#4169E1] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
                <textarea
                  value={newReview.content}
                  onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                  placeholder="Share your experience with this course..."
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // TODO: Submit review
                  setShowWriteReview(false);
                  setShowReviews(false);
                  setNewReview({ rating: 5, difficulty: 3, workload: 3, content: "" });
                }}
                disabled={!newReview.content.trim()}
                className="w-full bg-[#4169E1] text-white py-3 rounded-xl font-medium hover:bg-[#3557c7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}