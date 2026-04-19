import { useState } from "react";
import { Search, UserPlus, Check, X, Calendar, Send, ArrowLeft, MapPin, User, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router";
import React from "react";

interface Friend {
  id: string;
  name: string;
  major: string;
  year: string;
  avatar: string;
  status: "pending" | "accepted";
}

interface Course {
  id: string;
  code: string;
  name: string;
  color: string;
  day: number;
  startTime: number;
  duration: number;
  location: string;
  instructor: string;
}

const mockFriends: Friend[] = [
  {
    id: "1",
    name: "Sarah Chen",
    major: "Engineering",
    year: "Sophomore",
    avatar: "SC",
    status: "accepted",
  },
  {
    id: "2",
    name: "Alex Kim",
    major: "Computer Science",
    year: "Junior",
    avatar: "AK",
    status: "accepted",
  },
  {
    id: "3",
    name: "Emma Wilson",
    major: "Business",
    year: "Freshman",
    avatar: "EW",
    status: "accepted",
  },
];

const mockPendingRequests: Friend[] = [
  {
    id: "4",
    name: "Mike Johnson",
    major: "Data Science",
    year: "Senior",
    avatar: "MJ",
    status: "pending",
  },
];

// Mock timetable data for friends
const friendTimetables: Record<string, Course[]> = {
  "1": [
    {
      id: "f1",
      code: "ME 101",
      name: "Intro to Mechanical Engineering",
      color: "bg-purple-100 border-purple-300 text-purple-900",
      day: 1,
      startTime: 9,
      duration: 90,
      location: "Engineering Hall 201",
      instructor: "Dr. Smith",
    },
    {
      id: "f2",
      code: "MATH 201",
      name: "Calculus II",
      color: "bg-blue-100 border-blue-300 text-blue-900",
      day: 2,
      startTime: 10,
      duration: 75,
      location: "Math Building 305",
      instructor: "Prof. Johnson",
    },
    {
      id: "f3",
      code: "PHYS 102",
      name: "Physics II",
      color: "bg-green-100 border-green-300 text-green-900",
      day: 3,
      startTime: 13,
      duration: 90,
      location: "Science Center 410",
      instructor: "Dr. Lee",
    },
  ],
  "2": [
    {
      id: "f4",
      code: "CS 201",
      name: "Data Structures",
      color: "bg-indigo-100 border-indigo-300 text-indigo-900",
      day: 1,
      startTime: 11,
      duration: 75,
      location: "CS Building 301",
      instructor: "Prof. Chen",
    },
    {
      id: "f5",
      code: "CS 301",
      name: "Algorithms",
      color: "bg-violet-100 border-violet-300 text-violet-900",
      day: 3,
      startTime: 14,
      duration: 90,
      location: "CS Building 405",
      instructor: "Dr. Park",
    },
  ],
  "3": [
    {
      id: "f6",
      code: "BUS 101",
      name: "Introduction to Business",
      color: "bg-amber-100 border-amber-300 text-amber-900",
      day: 2,
      startTime: 9,
      duration: 75,
      location: "Business Hall 101",
      instructor: "Prof. Williams",
    },
    {
      id: "f7",
      code: "ECON 101",
      name: "Microeconomics",
      color: "bg-rose-100 border-rose-300 text-rose-900",
      day: 4,
      startTime: 11,
      duration: 75,
      location: "Economics Building 202",
      instructor: "Dr. Anderson",
    },
  ],
};

export default function Friends() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>(mockFriends);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>(mockPendingRequests);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const handleAcceptRequest = (id: string) => {
    const request = pendingRequests.find(r => r.id === id);
    if (request) {
      setFriends([...friends, { ...request, status: "accepted" }]);
      setPendingRequests(pendingRequests.filter(r => r.id !== id));
    }
  };

  const handleDeclineRequest = (id: string) => {
    setPendingRequests(pendingRequests.filter(r => r.id !== id));
  };

  const handleViewTimetable = (friendId: string) => {
    setSelectedFriendId(friendId);
  };

  const handleMessage = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    if (friend) {
      navigate("/app/messages", { state: { openChatWith: friend.name } });
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.major.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedFriend = friends.find(f => f.id === selectedFriendId);
  const selectedFriendCourses = selectedFriendId ? friendTimetables[selectedFriendId] || [] : [];

  // If viewing a friend's timetable
  if (selectedFriend && selectedFriendId) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const startHour = 8;
    const endHour = 19;
    const hours = Array.from(
      { length: endHour - startHour },
      (_, i) => startHour + i
    );

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setSelectedFriendId(null)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-medium text-sm">
              {selectedFriend.avatar}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedFriend.name}'s Timetable
              </h2>
              <p className="text-xs text-gray-500">
                {selectedFriend.major} • {selectedFriend.year}
              </p>
            </div>
          </div>
        </div>

        {/* Timetable Grid */}
        <div className="flex-1 overflow-auto px-4 py-3">
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
              <React.Fragment key={`hour-${hour}`}>
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
                    {selectedFriendCourses
                      .filter(
                        (c) =>
                          c.day === dayIndex &&
                          Math.floor(c.startTime) === hour
                      )
                      .map((course) => {
                        const duration = course.duration;
                        const height = (duration / 60) * 60; // 60px per hour

                        return (
                          <div
                            key={course.id}
                            className={`absolute rounded-md border p-1.5 ${course.color} shadow-sm`}
                            style={{ 
                              height: `${height - 4}px`,
                              left: "3px",
                              right: "3px",
                              top: "2px",
                            }}
                          >
                            <div className="text-xs font-semibold mb-0.5 line-clamp-1">
                              {course.code}
                            </div>
                            <div className="text-[10px] opacity-90 line-clamp-1 mb-1">
                              {course.name}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] opacity-75">
                              <MapPin className="w-2.5 h-2.5" />
                              <span className="line-clamp-1">{course.location}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl">Friends</h1>
          <button
            onClick={() => navigate("/app/messages")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("friends")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "friends"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors relative ${
              activeTab === "requests"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Requests
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Friends Tab */}
        {activeTab === "friends" && (
          <div className="divide-y divide-gray-100">
            {filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <UserPlus className="w-12 h-12 mb-2" />
                <p className="text-sm">No friends found</p>
              </div>
            ) : (
              filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-medium text-sm">
                      {friend.avatar}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {friend.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {friend.major} • {friend.year}
                      </p>
                    </div>
                    <button
                      onClick={() => handleViewTimetable(friend.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Timetable
                    </button>
                    <button
                      onClick={() => handleMessage(friend.id)}
                      className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div className="divide-y divide-gray-100">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <UserPlus className="w-12 h-12 mb-2" />
                <p className="text-sm">No pending requests</p>
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-300 text-white flex items-center justify-center font-medium text-sm">
                      {request.avatar}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {request.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {request.major} • {request.year}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}