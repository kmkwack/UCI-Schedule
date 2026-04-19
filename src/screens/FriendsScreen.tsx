import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Course,
  Quarter,
  QUARTERS,
  quarterKey,
  quarterLabel,
  pastelForCourse,
} from '../data/courses';
import CoursePickerScreen from './CoursePickerScreen';

type Friend = {
  id: string;
  name: string;
  major: string;
  year: string;
  timetables: Record<string, Course[]>;
};

// ─── timetable grid helpers ───────────────────────────────────────────────────

const DEFAULT_DAYS = ['M', 'T', 'W', 'Th', 'F'];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 17;
const TIME_LABEL_WIDTH = 52;
const SIDE_PADDING = 12;
const CARD_PADDING = 12;

function parseHour(time: string) {
  const [h, m] = time.split(':');
  return Number(h) + Number(m) / 60;
}
function startHour(t: string) { return parseHour(t.split(' - ')[0]); }
function endHour(t: string) { return parseHour(t.split(' - ')[1]); }
function fmtHour(h: number) { return `${h.toString().padStart(2, '0')}:00`; }
function parseDays(s: string) {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (two === 'Th' || two === 'Sa' || two === 'Su') { out.push(two); i += 2; continue; }
    const one = s[i];
    if ('MTWF'.includes(one)) out.push(one);
    i++;
  }
  return out;
}

function formatCourseLabel(code: string) {
  const parts = code.trim().split(/\s+/);
  if (parts.length < 2) return code;
  return `${parts[0]}\n${parts.slice(1).join(' ')}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ─── component ────────────────────────────────────────────────────────────────

type Props = {
  onOpenMessages?: (name: string) => void;
};

const MOCK_FRIENDS: Friend[] = [
  { id: '1', name: 'Sarah Chen',   major: 'Engineering',     year: 'Sophomore', timetables: {} },
  { id: '2', name: 'Alex Kim',     major: 'Computer Science', year: 'Junior',    timetables: {} },
  { id: '3', name: 'Emma Wilson',  major: 'Business',         year: 'Freshman',  timetables: {} },
];

type PendingFriend = { id: string; name: string; major: string; year: string };

const MOCK_PENDING: PendingFriend[] = [
  { id: '4', name: 'Mike Johnson', major: 'Data Science', year: 'Senior' },
];

export default function FriendsScreen({ onOpenMessages }: Props) {
  const [friends, setFriends] = useState<Friend[]>(MOCK_FRIENDS);
  const [pendingRequests, setPendingRequests] = useState<PendingFriend[]>(MOCK_PENDING);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendMajor, setNewFriendMajor] = useState('');
  const [newFriendYear, setNewFriendYear] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [friendQuarter, setFriendQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const screenHeight = Dimensions.get('window').height;

  const friend = selectedFriendId ? friends.find(f => f.id === selectedFriendId) ?? null : null;
  const activeCourses: Course[] = friend ? (friend.timetables[quarterKey(friendQuarter)] ?? []) : [];

  const filteredFriends = useMemo(() =>
    friends.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [friends, searchQuery]
  );

  // ── mutations ────────────────────────────────────────────────────────────────

  const addFriend = () => {
    const name = newFriendName.trim();
    if (!name) return;
    setFriends(prev => [...prev, {
      id: Date.now().toString(),
      name,
      major: newFriendMajor.trim() || 'Undeclared',
      year: newFriendYear.trim() || 'Student',
      timetables: {},
    }]);
    setNewFriendName('');
    setNewFriendMajor('');
    setNewFriendYear('');
    setShowAddModal(false);
  };

  const removeFriend = (id: string) => {
    setFriends(prev => prev.filter(f => f.id !== id));
    if (selectedFriendId === id) setSelectedFriendId(null);
  };

  const handleToggleCourse = (course: Course) => {
    if (!selectedFriendId) return;
    const key = quarterKey(friendQuarter);
    setFriends(prev =>
      prev.map(f => {
        if (f.id !== selectedFriendId) return f;
        const existing = f.timetables[key] ?? [];
        const isAdded = existing.some(c => c.id === course.id);
        return {
          ...f,
          timetables: {
            ...f.timetables,
            [key]: isAdded
              ? existing.filter(c => c.id !== course.id)
              : [...existing, course],
          },
        };
      })
    );
  };

  // ── timetable grid calculations ───────────────────────────────────────────────

  const visibleDays = useMemo(() => {
    const used = new Set<string>();
    activeCourses.forEach(c => parseDays(c.days).forEach(d => used.add(d)));
    const days = [...DEFAULT_DAYS];
    if (used.has('Sa')) days.push('Sa');
    if (used.has('Su')) days.push('Su');
    return days;
  }, [activeCourses]);

  const { displayStart, displayEnd } = useMemo(() => {
    if (!activeCourses.length) return { displayStart: DEFAULT_START_HOUR, displayEnd: DEFAULT_END_HOUR };
    const earliest = Math.min(...activeCourses.map(c => startHour(c.time)));
    const latest = Math.max(...activeCourses.map(c => endHour(c.time)));
    return {
      displayStart: Math.min(DEFAULT_START_HOUR, Math.floor(earliest)),
      displayEnd: Math.max(DEFAULT_END_HOUR, Math.ceil(latest)),
    };
  }, [activeCourses]);

  const totalHours = displayEnd - displayStart;
  const timetableHeight = Math.max(448, screenHeight - 342);
  const hourPx = timetableHeight / totalHours;
  const hourLabels = Array.from({ length: totalHours + 1 }, (_, i) => displayStart + i);
  const usableW =
    gridWidth > 0
      ? gridWidth - TIME_LABEL_WIDTH
      : Dimensions.get('window').width - SIDE_PADDING * 2 - CARD_PADDING * 2 - TIME_LABEL_WIDTH;
  const dayColW = usableW / visibleDays.length;

  // ── course picker overlay ─────────────────────────────────────────────────────

  if (showCoursePicker && friend) {
    return (
      <CoursePickerScreen
        activeCourses={activeCourses}
        onToggleCourse={handleToggleCourse}
        onFocusCourse={() => {}}
        onClose={() => setShowCoursePicker(false)}
        selectedQuarter={friendQuarter}
      />
    );
  }

  // ── friend timetable view ─────────────────────────────────────────────────────

  if (friend) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
        <Modal transparent animationType="fade" visible={showQuarterDropdown} onRequestClose={() => setShowQuarterDropdown(false)}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowQuarterDropdown(false)}>
            <View style={{
              position: 'absolute', top: 90, right: 16,
              backgroundColor: 'white', borderRadius: 12,
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
              minWidth: 160, overflow: 'hidden',
            }}>
              {QUARTERS.map((q, i) => {
                const active = quarterKey(q) === quarterKey(friendQuarter);
                return (
                  <TouchableOpacity
                    key={quarterKey(q)}
                    onPress={() => { setFriendQuarter(q); setShowQuarterDropdown(false); }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 12,
                      backgroundColor: active ? '#eef1fb' : 'white',
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f3f4f6',
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: active ? '#4169E1' : '#374151', fontWeight: active ? '700' : '400', fontSize: 14 }}>
                      {quarterLabel(q)}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color="#4169E1" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>

        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity onPress={() => setSelectedFriendId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={24} color="#4169E1" />
              </TouchableOpacity>
              <View style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
                marginRight: 4,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                  {getInitials(friend.name)}
                </Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: 'bold' }}>{friend.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowQuarterDropdown(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: 'white', borderRadius: 20,
                  paddingHorizontal: 12, paddingVertical: 7,
                  borderWidth: 1, borderColor: '#e5e7eb', gap: 4,
                }}
              >
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 13 }}>{quarterLabel(friendQuarter)}</Text>
                <Ionicons name="chevron-down" size={14} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowCoursePicker(true)}
                style={{ backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}
              >
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{
          marginHorizontal: SIDE_PADDING, backgroundColor: 'white',
          borderRadius: 16, overflow: 'hidden', paddingBottom: 12,
        }}
          onLayout={e => setGridWidth(e.nativeEvent.layout.width - CARD_PADDING * 2)}
        >
          <View style={{
            flexDirection: 'row', paddingTop: 12, paddingBottom: 8,
            paddingHorizontal: CARD_PADDING,
            borderBottomWidth: 1, borderBottomColor: '#eee',
          }}>
            <View style={{ width: TIME_LABEL_WIDTH }} />
            {visibleDays.map(day => (
              <View key={day} style={{ width: dayColW, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', fontSize: 12 }}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={{
            flexDirection: 'row', paddingHorizontal: CARD_PADDING,
            paddingTop: 4, height: timetableHeight + 12,
          }}>
            <View style={{ width: TIME_LABEL_WIDTH, height: timetableHeight }}>
              {hourLabels.map((h, i) => (
                <View key={h} style={{ position: 'absolute', top: i * hourPx - 8, left: 0 }}>
                  <Text style={{ fontSize: 11, color: 'gray' }}>{fmtHour(h)}</Text>
                </View>
              ))}
            </View>

            <View style={{
              width: dayColW * visibleDays.length, height: timetableHeight,
              position: 'relative', backgroundColor: 'white',
            }}>
              {hourLabels.map((h, i) => (
                <View key={h} style={{
                  position: 'absolute', top: i * hourPx, left: 0, right: 0,
                  height: 1, backgroundColor: '#e5e5e5',
                }} />
              ))}
              <View style={{ flexDirection: 'row', height: timetableHeight }}>
                {visibleDays.map((day, index) => (
                  <View key={day} style={{
                    width: dayColW,
                    borderRightWidth: index === visibleDays.length - 1 ? 0 : 1,
                    borderRightColor: '#e5e5e5',
                  }} />
                ))}
              </View>
              {activeCourses.flatMap(course => {
                const sh = startHour(course.time);
                const eh = endHour(course.time);
                const top = (sh - displayStart) * hourPx;
                const height = (eh - sh) * hourPx;
                return parseDays(course.days).map(day => {
                  const col = visibleDays.indexOf(day);
                  if (col === -1) return null;
                  return (
                    <View key={`${course.id}-${day}`} style={(() => {
                      const sType = course.sectionLabel?.split(' ')[0];
                      const cKey = sType ? `${course.code}-${sType}` : course.code;
                      const c = pastelForCourse(cKey);
                      return {
                        position: 'absolute', top,
                        left: col * dayColW + 2, width: dayColW - 4, height,
                        backgroundColor: c.bg, borderRadius: 8,
                        borderWidth: 1, borderColor: c.border,
                        padding: 5, overflow: 'hidden' as const,
                      };
                    })()}>
                      {(() => {
                        const sType = course.sectionLabel?.split(' ')[0];
                        const cKey = sType ? `${course.code}-${sType}` : course.code;
                        const c = pastelForCourse(cKey);
                        return (<>
                          <Text style={{ color: c.text, fontWeight: '700', fontSize: 10 }} numberOfLines={2}>
                            {formatCourseLabel(course.code)}
                          </Text>
                          <Text style={{ color: c.text, fontSize: 8, opacity: 0.7 }} numberOfLines={1}>{course.professor}</Text>
                        </>);
                      })()}
                    </View>
                  );
                });
              })}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ── friends list ──────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Add friend modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showAddModal}
        onRequestClose={() => { setShowAddModal(false); setNewFriendName(''); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
            activeOpacity={1}
            onPress={() => { setShowAddModal(false); setNewFriendName(''); }}
          >
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={{
                backgroundColor: 'white', borderRadius: 18, padding: 24, width: 300,
                shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
              }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#111827' }}>
                  Add Friend
                </Text>
                <TextInput
                  placeholder="Name"
                  placeholderTextColor="#9ca3af"
                  value={newFriendName}
                  onChangeText={setNewFriendName}
                  returnKeyType="next"
                  autoFocus
                  style={{
                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10,
                    fontSize: 15, marginBottom: 10, color: '#111827',
                  }}
                />
                <TextInput
                  placeholder="Major (e.g. Computer Science)"
                  placeholderTextColor="#9ca3af"
                  value={newFriendMajor}
                  onChangeText={setNewFriendMajor}
                  returnKeyType="next"
                  style={{
                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10,
                    fontSize: 15, marginBottom: 10, color: '#111827',
                  }}
                />
                <TextInput
                  placeholder="Year (e.g. Sophomore)"
                  placeholderTextColor="#9ca3af"
                  value={newFriendYear}
                  onChangeText={setNewFriendYear}
                  onSubmitEditing={addFriend}
                  returnKeyType="done"
                  style={{
                    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10,
                    fontSize: 15, marginBottom: 18, color: '#111827',
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setShowAddModal(false); setNewFriendName(''); }}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 10,
                      borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#374151', fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={addFriend}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 10,
                      backgroundColor: '#4169E1', alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: '600' }}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827' }}>ClassMates</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {onOpenMessages && (
            <TouchableOpacity onPress={() => onOpenMessages('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chatbubble-outline" size={24} color="#111827" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setShowAddModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="person-add-outline" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#f3f4f6', borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        }}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            placeholder="Search classmates..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, fontSize: 15, color: '#111827' }}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4,
      }}>
        <TouchableOpacity
          onPress={() => setActiveTab('friends')}
          style={{
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: activeTab === 'friends' ? '#4169E1' : '#f3f4f6',
          }}
        >
          <Text style={{
            fontSize: 14, fontWeight: '600',
            color: activeTab === 'friends' ? 'white' : '#374151',
          }}>
            ClassMates ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('requests')}
          style={{
            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
            backgroundColor: activeTab === 'requests' ? '#4169E1' : '#f3f4f6',
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}
        >
          <Text style={{
            fontSize: 14, fontWeight: '600',
            color: activeTab === 'requests' ? 'white' : '#374151',
          }}>
            Requests
          </Text>
          {pendingRequests.length > 0 && (
            <View style={{
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: activeTab === 'requests' ? 'rgba(255,255,255,0.3)' : '#ef4444',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: 'white' }}>{pendingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#f3f4f6', marginTop: 12 }} />

      {/* List */}
      {activeTab === 'friends' ? (
        filteredFriends.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Ionicons name="people-outline" size={60} color="#d1d5db" />
            <Text style={{ fontSize: 16, color: '#9ca3af', fontWeight: '500' }}>No friends yet</Text>
            <Text style={{ fontSize: 13, color: '#d1d5db' }}>Tap the icon above to add a friend</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {filteredFriends.map((f, index) => (
              <View key={f.id}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 14,
                }}>
                  {/* Avatar */}
                  <View style={{
                    width: 50, height: 50, borderRadius: 25,
                    backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
                      {getInitials(f.name)}
                    </Text>
                  </View>

                  {/* Name + subtitle */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{f.name}</Text>
                    <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                      {f.major} • {f.year}
                    </Text>
                  </View>

                  {/* Timetable button */}
                  <TouchableOpacity
                    onPress={() => setSelectedFriendId(f.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: '#4169E1', borderRadius: 20,
                      paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
                    }}
                  >
                    <Ionicons name="calendar-outline" size={14} color="white" />
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>Timetable</Text>
                  </TouchableOpacity>

                  {/* Send button */}
                  <TouchableOpacity
                    onPress={() => onOpenMessages?.(f.name)}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="paper-plane-outline" size={16} color="white" />
                  </TouchableOpacity>
                </View>

                {/* Separator */}
                {index < filteredFriends.length - 1 && (
                  <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />
                )}
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        pendingRequests.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Ionicons name="person-add-outline" size={60} color="#d1d5db" />
            <Text style={{ fontSize: 16, color: '#9ca3af', fontWeight: '500' }}>No pending requests</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {pendingRequests.map((req, index) => (
              <View key={req.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                  <View style={{
                    width: 50, height: 50, borderRadius: 25,
                    backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>
                      {getInitials(req.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{req.name}</Text>
                    <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{req.major} • {req.year}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setFriends(prev => [...prev, { id: req.id, name: req.name, major: req.major, year: req.year, timetables: {} }]);
                      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
                    }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                  >
                    <Ionicons name="checkmark" size={18} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPendingRequests(prev => prev.filter(r => r.id !== req.id))}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                {index < pendingRequests.length - 1 && (
                  <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />
                )}
              </View>
            ))}
          </ScrollView>
        )
      )}
    </View>
  );
}
