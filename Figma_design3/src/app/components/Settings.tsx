import { X, User, Bell, Lock, HelpCircle, Info, LogOut, ChevronRight, Mail, Shield, Palette, Globe } from "lucide-react";
import { useNavigate } from "react-router";

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // TODO: Implement logout logic
    navigate("/");
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Profile Section */}
        <div className="px-6 py-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-[#4169E1] rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-white">JD</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">John Doe</h2>
              <p className="text-sm text-gray-500">john.doe@university.edu</p>
              <p className="text-sm text-gray-400 mt-1">Computer Science · Junior</p>
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Account
          </h3>
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Edit Profile</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Email Preferences</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Change Password</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Privacy & Security</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Preferences
          </h3>
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Notifications</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Appearance</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Language & Region</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Support
          </h3>
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Help Center</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">About ClassMate</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Logout */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Log Out</span>
          </button>
        </div>

        {/* App Info */}
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-gray-400">ClassMate v1.0.0</p>
          <p className="text-xs text-gray-400 mt-1">© 2026 ClassMate. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
