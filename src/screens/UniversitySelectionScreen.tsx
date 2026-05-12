import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSchoolConfig, SUPPORTED_UNIVERSITIES, type University } from '../data/schools';
import UniversityLogo from '../components/UniversityLogo';

type Props = {
  onBack: () => void;
  onContinue: (university: University) => void;
};

export default function UniversitySelectionScreen({ onBack, onContinue }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<University | null>(null);

  const filtered = SUPPORTED_UNIVERSITIES.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 28 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#111827', marginBottom: 6 }}>
          Select Your University
        </Text>
        <Text style={{ fontSize: 15, color: '#6b7280', marginBottom: 24, lineHeight: 22 }}>
          Choose your school to get started with ClassMate.
        </Text>

        {/* Search bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#f9fafb', borderRadius: 14,
          borderWidth: 1.5, borderColor: '#e5e7eb',
          paddingHorizontal: 14, paddingVertical: 13, marginBottom: 20, gap: 10,
        }}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search universities..."
            placeholderTextColor="#9ca3af"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 15, color: '#111827' }}
          />
        </View>

        {/* University list */}
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {filtered.map((uni) => {
            const isSelected = selected?.id === uni.id;
            const schoolConfig = getSchoolConfig(uni.name);
            const accent = schoolConfig.accent;
            return (
              <TouchableOpacity
                key={uni.id}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelected(uni);
                }}
                activeOpacity={0.85}
                style={{
                  minHeight: 88,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 16,
                  marginBottom: 10,
                  borderWidth: 2,
                  borderColor: isSelected ? accent : '#e5e7eb',
                  backgroundColor: isSelected ? `${accent}10` : 'white',
                }}
              >
                <UniversityLogo
                  university={uni}
                  width={118}
                  height={50}
                  marginRight={14}
                />

                {/* Info */}
                <View style={{ flex: 1, paddingRight: isSelected ? 10 : 0 }}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 }}
                  >
                    {uni.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{uni.location}</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{uni.domain}</Text>
                </View>

                {/* Checkmark */}
                {isSelected && (
                  <View style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: accent, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={15} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {filtered.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text style={{ fontSize: 14, color: '#9ca3af' }}>No universities found</Text>
              <Text style={{ fontSize: 12, color: '#d1d5db', marginTop: 4 }}>Try a different search term</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Continue button — appears when a university is selected */}
      {selected && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12 }}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              onContinue(selected);
            }}
            style={{
              backgroundColor: getSchoolConfig(selected.name).accent, borderRadius: 16,
              paddingVertical: 18, alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

export type { University };
