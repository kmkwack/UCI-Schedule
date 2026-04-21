import { X, User, Bell, Lock, HelpCircle, Info, LogOut, ChevronRight, Shield, Palette, Globe, ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router";
import { useState } from "react";

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const navigate = useNavigate();
  const [activeScreen, setActiveScreen] = useState<string | null>(null);

  // Profile data
  const [profile, setProfile] = useState({
    firstName: "John",
    middleName: "",
    lastName: "Doe",
    nickname: "Johnny",
    email: "john.doe@uci.edu",
    year: "Junior",
    department: "Computer Science",
    gender: "",
    phone: "",
    dateOfBirth: "",
  });

  const handleLogout = () => {
    // TODO: Implement logout logic
    navigate("/");
  };

  const renderScreen = () => {
    if (!activeScreen) return null;

    switch (activeScreen) {
      case "profile":
        return <EditProfileScreen profile={profile} setProfile={setProfile} onBack={() => setActiveScreen(null)} />;
      case "privacy":
        return <PrivacySecurityScreen onBack={() => setActiveScreen(null)} />;
      case "notifications":
        return <NotificationsScreen onBack={() => setActiveScreen(null)} />;
      case "appearance":
        return <AppearanceScreen onBack={() => setActiveScreen(null)} />;
      case "language":
        return <LanguageRegionScreen onBack={() => setActiveScreen(null)} />;
      case "help":
        return <HelpCenterScreen onBack={() => setActiveScreen(null)} />;
      case "about":
        return <AboutScreen onBack={() => setActiveScreen(null)} />;
      default:
        return null;
    }
  };

  if (activeScreen) {
    return renderScreen();
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
            <button
              onClick={() => setActiveScreen("profile")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Edit Profile</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setActiveScreen("privacy")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
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
            <button
              onClick={() => setActiveScreen("notifications")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Notifications</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setActiveScreen("appearance")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Appearance</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setActiveScreen("language")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
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
            <button
              onClick={() => setActiveScreen("help")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-gray-600" />
                <span className="text-gray-900">Help Center</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => setActiveScreen("about")}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors"
            >
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

// Edit Profile Screen
function EditProfileScreen({ profile, setProfile, onBack }: any) {
  const [formData, setFormData] = useState(profile);

  const handleSave = () => {
    setProfile(formData);
    onBack();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Edit Profile</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-5">
          {/* Required Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Middle Name
            </label>
            <input
              type="text"
              value={formData.middleName}
              onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              placeholder="Optional"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nickname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              University Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            >
              <option>Freshman</option>
              <option>Sophomore</option>
              <option>Junior</option>
              <option>Senior</option>
              <option>Graduate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            >
              <option>Computer Science</option>
              <option>Mathematics</option>
              <option>Physics</option>
              <option>Chemistry</option>
              <option>Biology</option>
              <option>Business</option>
              <option>Engineering</option>
              <option>Psychology</option>
            </select>
          </div>

          {/* Optional Fields */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-4">Optional Information</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
                >
                  <option value="">Prefer not to say</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Non-binary</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          className="w-full bg-[#4169E1] text-white py-3 rounded-xl font-medium hover:bg-[#3557c7] transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

// Privacy & Security Screen
function PrivacySecurityScreen({ onBack }: any) {
  const [settings, setSettings] = useState({
    timetableVisibility: "friends",
  });

  const [showPublicWarning, setShowPublicWarning] = useState(false);

  const handleVisibilityChange = (option: string) => {
    if (option === "public") {
      setShowPublicWarning(true);
    } else {
      setSettings({ ...settings, timetableVisibility: option });
    }
  };

  const confirmPublicVisibility = () => {
    setSettings({ ...settings, timetableVisibility: "public" });
    setShowPublicWarning(false);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Privacy & Security</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Timetable Visibility */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Timetable Visibility</h3>
            <div className="space-y-2">
              {["friends", "private", "public"].map((option) => (
                <label
                  key={option}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{option}</p>
                    <p className="text-xs text-gray-500">
                      {option === "friends" && "Only your classmates can see"}
                      {option === "private" && "Only you can see your timetable"}
                      {option === "public" && "Anyone can see your timetable"}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="visibility"
                    checked={settings.timetableVisibility === option}
                    onChange={() => handleVisibilityChange(option)}
                    className="w-4 h-4 text-[#4169E1] focus:ring-[#4169E1]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Public Warning Modal */}
      {showPublicWarning && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Make Timetable Public?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Your timetable will be visible to everyone. Anyone will be able to see your class schedule.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublicWarning(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublicVisibility}
                className="flex-1 px-4 py-3 bg-[#4169E1] text-white rounded-xl font-medium hover:bg-[#3557c7] transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Notifications Screen
function NotificationsScreen({ onBack }: any) {
  const [settings, setSettings] = useState({
    pushNotifications: true,
    emailNotifications: true,
    classReminders: true,
    sportsGameReminders: true,
    friendRequests: true,
    comments: true,
    messages: true,
  });

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Notifications</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* General */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">General</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">Push Notifications</p>
                  <p className="text-xs text-gray-500">Receive notifications on your device</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) => setSettings({ ...settings, pushNotifications: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                  <p className="text-xs text-gray-500">Receive updates via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
            </div>
          </div>

          {/* Academic */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Academic</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-900">Class Reminders</span>
                <input
                  type="checkbox"
                  checked={settings.classReminders}
                  onChange={(e) => setSettings({ ...settings, classReminders: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-900">Sports Game Reminders</span>
                <input
                  type="checkbox"
                  checked={settings.sportsGameReminders}
                  onChange={(e) => setSettings({ ...settings, sportsGameReminders: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
            </div>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Social</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-900">Friend Requests</span>
                <input
                  type="checkbox"
                  checked={settings.friendRequests}
                  onChange={(e) => setSettings({ ...settings, friendRequests: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-900">Comments</span>
                <input
                  type="checkbox"
                  checked={settings.comments}
                  onChange={(e) => setSettings({ ...settings, comments: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-900">Messages</span>
                <input
                  type="checkbox"
                  checked={settings.messages}
                  onChange={(e) => setSettings({ ...settings, messages: e.target.checked })}
                  className="w-5 h-5 rounded text-[#4169E1] focus:ring-[#4169E1]"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Appearance Screen
function AppearanceScreen({ onBack }: any) {
  const [settings, setSettings] = useState({
    theme: "light",
    temperature: "fahrenheit",
  });

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Appearance</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Theme */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Theme</h3>
            <div className="space-y-2">
              {["light", "dark", "auto"].map((option) => (
                <label
                  key={option}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{option}</p>
                    <p className="text-xs text-gray-500">
                      {option === "light" && "Always use light theme"}
                      {option === "dark" && "Always use dark theme"}
                      {option === "auto" && "Match system settings"}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === option}
                    onChange={() => setSettings({ ...settings, theme: option })}
                    className="w-4 h-4 text-[#4169E1] focus:ring-[#4169E1]"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Temperature Unit */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Temperature Unit</h3>
            <div className="space-y-2">
              {[
                { value: "fahrenheit", label: "Fahrenheit (°F)", example: "72°F" },
                { value: "celsius", label: "Celsius (°C)", example: "22°C" }
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-500">Example: {option.example}</p>
                  </div>
                  <input
                    type="radio"
                    name="temperature"
                    checked={settings.temperature === option.value}
                    onChange={() => setSettings({ ...settings, temperature: option.value })}
                    className="w-4 h-4 text-[#4169E1] focus:ring-[#4169E1]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Language & Region Screen
function LanguageRegionScreen({ onBack }: any) {
  const [settings, setSettings] = useState({
    language: "English",
    timezone: "America/Los_Angeles",
    dateFormat: "MM/DD/YYYY",
  });

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Language & Region</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Language */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Language</label>
            <select
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            >
              <option>English</option>
              <option>한국어 (Korean)</option>
              <option>Español (Spanish)</option>
              <option>中文 (Chinese)</option>
              <option>日本語 (Japanese)</option>
            </select>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Time Zone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent"
            >
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="Asia/Seoul">Korea Standard Time (KST)</option>
            </select>
          </div>

          {/* Date Format */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">Date Format</label>
            <div className="space-y-2">
              {["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((format) => (
                <label
                  key={format}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{format}</p>
                    <p className="text-xs text-gray-500">
                      Example: {format === "MM/DD/YYYY" && "04/21/2026"}
                      {format === "DD/MM/YYYY" && "21/04/2026"}
                      {format === "YYYY-MM-DD" && "2026-04-21"}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="dateFormat"
                    checked={settings.dateFormat === format}
                    onChange={() => setSettings({ ...settings, dateFormat: format })}
                    className="w-4 h-4 text-[#4169E1] focus:ring-[#4169E1]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Help Center Screen
function HelpCenterScreen({ onBack }: any) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const faqCategories = [
    {
      title: "Getting Started",
      icon: "📚",
      faqs: [
        {
          question: "How do I create an account?",
          answer: "Select your university from the list, then sign in with your university Google account. Make sure to use your official university email (e.g., @uci.edu)."
        },
        {
          question: "How do I set up my profile?",
          answer: "Go to Settings > Edit Profile to add your personal information, including your name, nickname, year, and department. You can also add optional information like gender and date of birth."
        },
        {
          question: "What features does ClassMate offer?",
          answer: "ClassMate helps you manage your timetable, track grades, connect with classmates, participate in community discussions, and stay organized throughout your campus life."
        }
      ]
    },
    {
      title: "Managing Your Timetable",
      icon: "📅",
      faqs: [
        {
          question: "How do I add a course to my timetable?",
          answer: "Tap the 'Add' button on the Timetable screen. Use filters to search for courses by department, day, time, or instructor. Select a course to preview it on your timetable, then tap 'Add Course(s)' to confirm."
        },
        {
          question: "Can I have multiple timetable plans?",
          answer: "Yes! You can create up to 3 different timetable plans (Plan A, B, and C) to compare different course schedules before finalizing your registration."
        },
        {
          question: "How do I remove a course from my timetable?",
          answer: "Tap on the course in your timetable, then select the remove or delete option from the course details."
        }
      ]
    },
    {
      title: "Tracking Grades",
      icon: "📊",
      faqs: [
        {
          question: "⚠️ Important: Are these my official grades?",
          answer: "NO. The grades in ClassMate are for simulation and tracking purposes only. This is NOT your official transcript. Always check your university's official student portal for your real grades. ClassMate is a grade calculator and organizer, not an official grade system."
        },
        {
          question: "How do I add grades for my courses?",
          answer: "Go to the Grades tab and select a course. Enter your assignment grades, exam scores, and their weights. ClassMate will automatically calculate your overall grade."
        },
        {
          question: "Can I track my GPA?",
          answer: "Yes! ClassMate automatically calculates your semester GPA and cumulative GPA based on the grades you enter for each course."
        },
        {
          question: "How do I set grade goals?",
          answer: "In the Grades section, you can set target grades for each course. ClassMate will show you what scores you need on remaining assignments to reach your goal."
        }
      ]
    },
    {
      title: "Community Guidelines",
      icon: "👥",
      faqs: [
        {
          question: "What can I post in the Community?",
          answer: "Share study tips, campus events, course recommendations, and academic discussions. Keep posts respectful, relevant, and helpful to other students."
        },
        {
          question: "How do I report inappropriate content?",
          answer: "Tap the three dots on any post or comment and select 'Report'. Our team will review reported content within 24 hours."
        },
        {
          question: "Can I edit or delete my posts?",
          answer: "Yes! Tap the three dots on your post to edit or delete it. Note that edits will show an 'edited' label for transparency."
        }
      ]
    },
    {
      title: "Account & Privacy",
      icon: "🔒",
      faqs: [
        {
          question: "Who can see my timetable?",
          answer: "By default, only your classmates (friends) can see your timetable. You can change this in Settings > Privacy & Security > Timetable Visibility."
        },
        {
          question: "How do I change my password?",
          answer: "Since ClassMate uses Google authentication, you'll need to update your password through your Google account settings."
        },
        {
          question: "Can I delete my account?",
          answer: "Yes. Go to Settings and contact support to request account deletion. All your data will be permanently removed within 30 days."
        }
      ]
    },
    {
      title: "Troubleshooting",
      icon: "🔧",
      faqs: [
        {
          question: "The app won't load my courses",
          answer: "Make sure you have a stable internet connection. Try refreshing the page or logging out and back in. If the problem persists, contact support."
        },
        {
          question: "I can't find my university",
          answer: "ClassMate is currently only available for UC Irvine. We're working on adding more universities soon! Check the About section for updates."
        },
        {
          question: "Notifications aren't working",
          answer: "Check Settings > Notifications to ensure the types of notifications you want are enabled. Also verify that your device allows push notifications from ClassMate."
        }
      ]
    }
  ];

  if (selectedCategory) {
    const category = faqCategories.find(c => c.title === selectedCategory);
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedCategory(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold">{category?.title}</h1>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-md mx-auto space-y-4">
            {category?.faqs.map((faq, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Help Center</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* FAQs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Frequently Asked Questions</h3>
            <div className="space-y-2">
              {faqCategories.map((category, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedCategory(category.title)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{category.title}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Contact Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Need More Help?</h3>
            <button className="w-full bg-[#4169E1] text-white py-4 rounded-xl font-medium hover:bg-[#3557c7] transition-colors">
              Contact Support
            </button>
          </div>

          {/* Tutorials */}
          <div>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <span className="text-sm font-medium text-gray-900">Video Tutorials</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// About Screen
function AboutScreen({ onBack }: any) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">About ClassMate</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Logo & Version */}
          <div className="text-center py-6">
            <div className="inline-flex w-24 h-24 bg-[#4169E1] rounded-3xl items-center justify-center shadow-lg mb-4">
              <span className="text-4xl font-bold text-white">CM</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ClassMate</h2>
            <p className="text-sm text-gray-500 mb-1">Version 1.0.0</p>
            <p className="text-xs text-gray-400">Your Campus Life, Organized</p>
          </div>

          {/* Developer Info */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 text-center">
              Built with ❤️ for students, by students
            </p>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <span className="text-sm text-gray-900">Terms of Service</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <span className="text-sm text-gray-900">Privacy Policy</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <span className="text-sm text-gray-900">Open Source Licenses</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Copyright */}
          <div className="text-center pt-4">
            <p className="text-xs text-gray-400">© 2026 ClassMate. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
