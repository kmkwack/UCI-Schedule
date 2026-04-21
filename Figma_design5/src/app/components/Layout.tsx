import { Outlet, useLocation, Link } from "react-router";
import { Home, Calendar, GraduationCap, Clipboard, UserPlus } from "lucide-react";

export default function Layout() {
  const location = useLocation();

  const tabs = [
    { path: "/app", label: "Home", icon: Home },
    { path: "/app/timetable", label: "Timetable", icon: Calendar },
    { path: "/app/grades", label: "Grades", icon: GraduationCap },
    { path: "/app/community", label: "Board", icon: Clipboard },
    { path: "/app/friends", label: "ClassMates", icon: UserPlus },
  ];

  return (
    <div className="h-screen flex flex-col bg-white max-w-md mx-auto">
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>

      {/* Bottom tab bar */}
      <div className="border-t border-gray-200 bg-white">
        <div className="flex items-center justify-around px-4 py-2 safe-bottom">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex flex-col items-center gap-1 py-2 px-6 min-w-[72px]"
              >
                <Icon
                  className={`w-6 h-6 ${
                    isActive ? "text-[#4169E1]" : "text-gray-400"
                  }`}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                <span
                  className={`text-xs ${
                    isActive ? "text-[#4169E1] font-medium" : "text-gray-400"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}