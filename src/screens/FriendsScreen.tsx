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
  colorForDepartment,
} from '../data/courses';
import CoursePickerScreen from './CoursePickerScreen';

type Friend = {
  id: string;
  name: string;
  timetables: Record<string, Course[]>;
};

// ─── timetable grid helpers (same logic as TimetableScreen) ───────────────────

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

// ─── component ────────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [friendQuarter, setFriendQuarter] = useState<Quarter>({ year: '2026', quarter: 'Spring' });
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  const screenHeight = Dimensions.get('window').height;

  // Always derive friend data from the array so it stays in sync after edits
  const friend = selectedFriendId ? friends.find(f => f.id === selectedFriendId) ?? null : null;
  const activeCourses: Course[] = friend ? (friend.timetables[quarterKey(friendQuarter)] ?? []) : [];

  // ── mutations ────────────────────────────────────────────────────────────────

  const addFriend = () => {
    const name = newFriendName.trim();
    if (!name) return;
    setFriends(prev => [...prev, { id: Date.now().toString(), name, timetables: {} }]);
    setNewFriendName('');
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
  const timetableHeight = Math.max(420, screenHeight - 370);
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
        onClose={() => setShowCoursePicker(false)}
        selectedQuarter={friendQuarter}
      />
    );
  }

  // ── friend timetable view ─────────────────────────────────────────────────────

  if (friend) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
        {/* Quarter dropdown */}
        <Modal
          transparent
          animationType="fade"
          visible={showQuarterDropdown}
          onRequestClose={() => setShowQuarterDropdown(false)}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowQuarterDropdown(false)}
          >
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
                      backgroundColor: active ? '#eff6ff' : 'white',
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f3f4f6',
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: active ? '#2563eb' : '#374151', fontWeight: active ? '700' : '400', fontSize: 14 }}>
                      {quarterLabel(q)}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color="#2563eb" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Header */}
        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity onPress={() => setSelectedFriendId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={24} color="#2563eb" />
              </TouchableOpacity>
              <View style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#2563eb' }}>
                  {friend.name.charAt(0).toUpperCase()}
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
                <Text style={{ color: '#374151', fontWeight: '600', fontSize: 13 }}>
                  {quarterLabel(friendQuarter)}
                </Text>
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

        {/* Timetable grid */}
        <View style={{
          marginHorizontal: SIDE_PADDING, backgroundColor: 'white',
          borderRadius: 16, overflow: 'hidden', paddingBottom: 12,
        }}
          onLayout={e => setGridWidth(e.nativeEvent.layout.width - CARD_PADDING * 2)}
        >
          {/* Day header row */}
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

          {/* Grid body */}
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
              {/* Hour lines */}
              {hourLabels.map((h, i) => (
                <View key={h} style={{
                  position: 'absolute', top: i * hourPx, left: 0, right: 0,
                  height: 1, backgroundColor: '#e5e5e5',
                }} />
              ))}
              {/* Day column dividers */}
              <View style={{ flexDirection: 'row', height: timetableHeight }}>
                {visibleDays.map(day => (
                  <View key={day} style={{ width: dayColW, borderRightWidth: 1, borderRightColor: '#e5e5e5' }} />
                ))}
              </View>
              {/* Course blocks */}
              {activeCourses.flatMap(course => {
                const sh = startHour(course.time);
                const eh = endHour(course.time);
                const top = (sh - displayStart) * hourPx;
                const height = (eh - sh) * hourPx;
                return parseDays(course.days).map(day => {
                  const col = visibleDays.indexOf(day);
                  if (col === -1) return null;
                  return (
                    <View key={`${course.id}-${day}`} style={{
                      position: 'absolute', top,
                      left: col * dayColW + 2, width: dayColW - 4, height,
                      backgroundColor: colorForDepartment(course.department),
                      borderRadius: 8, padding: 5,
                    }}>
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 10 }} numberOfLines={2}>
                        {course.code}
                      </Text>
                      <Text style={{ color: 'white', fontSize: 8 }} numberOfLines={1}>{course.time}</Text>
                      <Text style={{ color: 'white', fontSize: 8 }} numberOfLines={1}>{course.professor}</Text>
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
    <View style={{ flex: 1, backgroundColor: '#f7f8fa' }}>
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
                  placeholder="Friend's name"
                  placeholderTextColor="#9ca3af"
                  value={newFriendName}
                  onChangeText={setNewFriendName}
                  onSubmitEditing={addFriend}
                  returnKeyType="done"
                  autoFocus
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
                      backgroundColor: '#2563eb', alignItems: 'center',
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
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold' }}>Friends</Text>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{
              backgroundColor: '#2563eb', borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 7,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <Ionicons name="person-add-outline" size={14} color="white" />
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      </View>

      {friends.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ionicons name="people-outline" size={60} color="#d1d5db" />
          <Text style={{ fontSize: 16, color: '#9ca3af', fontWeight: '500' }}>No friends added yet</Text>
          <Text style={{ fontSize: 13, color: '#d1d5db' }}>Tap "Add Friend" to get started</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        >
          {friends.map(f => {
            const total = Object.values(f.timetables).reduce((s, c) => s + c.length, 0);
            return (
              <View
                key={f.id}
                style={{
                  backgroundColor: 'white', borderRadius: 14,
                  flexDirection: 'row', alignItems: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
                  overflow: 'hidden',
                }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedFriendId(f.id)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
                    marginRight: 14,
                  }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#2563eb' }}>
                      {f.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{f.name}</Text>
                    <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                      {total === 0 ? 'No courses added' : `${total} course${total === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
                </TouchableOpacity>
                {/* Remove button */}
                <TouchableOpacity
                  onPress={() => removeFriend(f.id)}
                  style={{ paddingHorizontal: 14, paddingVertical: 16, borderLeftWidth: 1, borderLeftColor: '#f3f4f6' }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
