import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface University {
  id: string;
  name: string;
  domain: string;
  location: string;
  logo: string;
}

const UNIVERSITIES: University[] = [
  { id: '1', name: 'UC Irvine', domain: '@uci.edu', location: 'Irvine, CA', logo: 'UCI' },
];

type Props = {
  onBack: () => void;
  onContinue: (university: University) => void;
};

export default function UniversitySelectionScreen({ onBack, onContinue }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<University | null>(null);

  const filtered = UNIVERSITIES.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.location.toLowerCase().includes(searchQuery.toLowerCase())
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
          Choose your school to get started with ClassMate. More universities are on the way.
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
            return (
              <TouchableOpacity
                key={uni.id}
                onPress={() => setSelected(uni)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 16, borderRadius: 16, marginBottom: 10,
                  borderWidth: 2,
                  borderColor: isSelected ? '#4169E1' : '#e5e7eb',
                  backgroundColor: isSelected ? 'rgba(65,105,225,0.06)' : 'white',
                }}
              >
                {/* Logo */}
                <View style={{
                  width: 56, height: 56, borderRadius: 14,
                  backgroundColor: 'white', alignItems: 'center', justifyContent: 'center',
                  marginRight: 14,
                }}>
                  {uni.id === '1' ? (
                    <Image
                      source={require('../../assets/ucirvine-monogram.png')}
                      style={{ width: 40, height: 26 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>{uni.logo}</Text>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 }}>{uni.name}</Text>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{uni.location}</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{uni.domain}</Text>
                </View>

                {/* Checkmark */}
                {isSelected && (
                  <View style={{
                    width: 26, height: 26, borderRadius: 13,
                    backgroundColor: '#4169E1', alignItems: 'center', justifyContent: 'center',
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
            onPress={() => onContinue(selected)}
            style={{
              backgroundColor: '#4169E1', borderRadius: 16,
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
