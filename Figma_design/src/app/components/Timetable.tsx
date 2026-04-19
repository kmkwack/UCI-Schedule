import { useState, useRef, Fragment } from "react";
import { Plus, ChevronDown, Search } from "lucide-react";

interface ClassEvent {
  id: string;
  name: string;
  day: number; // 0 = Monday, 1 = Tuesday, etc.
  startTime: number; // in minutes from midnight (e.g., 540 = 9:00 AM)
  endTime: number;
  color: string;
  room: string;
  plan: string; // A, B, or C
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
    plan: "A",
  },
  {
    id: "2",
    name: "Mathematics",
    day: 0,
    startTime: 660,
    endTime: 750,
    color: "bg-blue-100 border-blue-300 text-blue-900",
    room: "B-101",
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
    plan: "B",
  },
  {
    id: "b2",
    name: "Calculus II",
    day: 1,
    startTime: 600,
    endTime: 690,
    color: "bg-blue-100 border-blue-300 text-blue-900",
    room: "A-102",
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
    plan: "C",
  },
  {
    id: "c3",
    name: "Operating Systems",
    day: 2,
    startTime: 600,
    endTime: 720,
    color: "bg-blue-100 border-blue-300 text-blue-900",
    room: "CS-201",
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
    plan: "C",
  },
];

export default function Timetable() {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>("A");
  const [friendSearch, setFriendSearch] = useState<string>("");
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
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Timetable</h1>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Spring 2026
              <ChevronDown className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Plan Selector */}
      <div className="px-6 py-2 border-b border-gray-200">
        <div className="flex gap-2">
          {["A", "B", "C"].map((plan) => (
            <button
              key={plan}
              onClick={() => setSelectedPlan(plan)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedPlan === plan
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Plan {plan}
            </button>
          ))}
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
                              ? "ring-2 ring-blue-500 shadow-md"
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
                        </div>
                      );
                    })}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}