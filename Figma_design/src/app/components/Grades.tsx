import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { ChevronDown } from "lucide-react";

interface Course {
  id: string;
  name: string;
  credits: number;
  grade: string | null;
}

interface Semester {
  id: string;
  name: string;
  courses: Course[];
  isCurrent: boolean;
}

const gradeOptions = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"];

const gpaData = [
  { id: "fall23", semester: "Fall 23", gpa: 3.4 },
  { id: "spring24", semester: "Spring 24", gpa: 3.6 },
  { id: "fall24", semester: "Fall 24", gpa: 3.7 },
  { id: "spring25", semester: "Spring 25", gpa: 3.8 },
  { id: "fall25", semester: "Fall 25", gpa: 3.85 },
];

const mockSemesters: Semester[] = [
  {
    id: "fall25",
    name: "Fall 2025",
    isCurrent: true,
    courses: [
      { id: "c1", name: "Computer Science 101", credits: 4, grade: "A" },
      { id: "c2", name: "Mathematics", credits: 3, grade: "A-" },
      { id: "c3", name: "Physics Lab", credits: 4, grade: null },
      { id: "c4", name: "English Literature", credits: 3, grade: "B+" },
      { id: "c5", name: "History", credits: 3, grade: null },
    ],
  },
  {
    id: "spring25",
    name: "Spring 2025",
    isCurrent: false,
    courses: [
      { id: "s1", name: "Data Structures", credits: 4, grade: "A" },
      { id: "s2", name: "Calculus II", credits: 3, grade: "A-" },
      { id: "s3", name: "Chemistry", credits: 4, grade: "B+" },
      { id: "s4", name: "Economics", credits: 3, grade: "A" },
    ],
  },
  {
    id: "fall24",
    name: "Fall 2024",
    isCurrent: false,
    courses: [
      { id: "f1", name: "Intro to Programming", credits: 4, grade: "A-" },
      { id: "f2", name: "Calculus I", credits: 3, grade: "B+" },
      { id: "f3", name: "Biology", credits: 4, grade: "A" },
    ],
  },
];

export default function Grades() {
  const [semesters, setSemesters] = useState<Semester[]>(mockSemesters);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedSemesters, setExpandedSemesters] = useState<Set<string>>(new Set());

  const handleGradeSelect = (semesterId: string, courseId: string, grade: string) => {
    setSemesters((prev) =>
      prev.map((sem) =>
        sem.id === semesterId
          ? {
              ...sem,
              courses: sem.courses.map((c) =>
                c.id === courseId ? { ...c, grade } : c
              ),
            }
          : sem
      )
    );
    setExpandedCourse(null);
  };

  const toggleSemester = (semesterId: string) => {
    setExpandedSemesters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(semesterId)) {
        newSet.delete(semesterId);
      } else {
        newSet.add(semesterId);
      }
      return newSet;
    });
  };

  const currentSemester = semesters.find((s) => s.isCurrent);
  const pastSemesters = semesters.filter((s) => !s.isCurrent);

  return (
    <div className="min-h-full px-6 py-8 bg-white">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl">Grades</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">GPA</p>
          <p className="text-2xl">3.85</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Credits</p>
          <p className="text-2xl">68</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Courses</p>
          <p className="text-2xl">22</p>
        </div>
      </div>

      {/* GPA Trend Chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">GPA Trend</h2>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={gpaData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="semester"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              key="x-axis"
            />
            <YAxis
              domain={[3.0, 4.0]}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              key="y-axis"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              cursor={false}
              key="tooltip"
            />
            <Line
              type="monotone"
              dataKey="gpa"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
              key="gpa-line"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Current Quarter/Semester */}
      {currentSemester && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Current Quarter/Semester
          </h2>
          <div className="space-y-2.5">
            {currentSemester.courses.map((course) => (
              <div
                key={course.id}
                className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {course.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {course.credits} credits
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setExpandedCourse(
                        expandedCourse === course.id ? null : course.id
                      )
                    }
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      course.grade
                        ? "bg-gray-100 text-gray-900"
                        : "bg-gray-50 text-gray-400 border border-gray-200"
                    }`}
                  >
                    {course.grade || "Select Grade"}
                  </button>
                </div>

                {/* Grade Options */}
                {expandedCourse === course.id && (
                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                    <div className="grid grid-cols-5 gap-2">
                      {gradeOptions.map((grade) => (
                        <button
                          key={grade}
                          onClick={() => handleGradeSelect(currentSemester.id, course.id, grade)}
                          className={`py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${
                            course.grade === grade
                              ? "bg-blue-500 text-white shadow-md"
                              : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200"
                          }`}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Semesters */}
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">
          Past Semesters
        </h2>
        <div className="space-y-2.5">
          {pastSemesters.map((semester) => (
            <div
              key={semester.id}
              className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
            >
              {/* Semester Header */}
              <button
                onClick={() => toggleSemester(semester.id)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{semester.name}</p>
                  <p className="text-xs text-gray-500">
                    {semester.courses.length} courses
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedSemesters.has(semester.id) ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Semester Courses (Collapsible) */}
              {expandedSemesters.has(semester.id) && (
                <div className="border-t border-gray-200 p-3.5 bg-gray-50 space-y-2">
                  {semester.courses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {course.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {course.credits} credits
                        </p>
                      </div>
                      <div className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium text-gray-900">
                        {course.grade}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}