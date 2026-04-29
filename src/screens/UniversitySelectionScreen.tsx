import { useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ScrollView, Image, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type UniversityStatus = 'available' | 'coming-soon';

interface University {
  id: string;
  name: string;
  domain: string;
  location: string;
  logo: string;
  status?: UniversityStatus;
}

const UNIVERSITIES: University[] = [
  { id: 'uci', name: 'UC Irvine', domain: '@uci.edu', location: 'Irvine, CA', logo: 'UCI', status: 'available' },
  { id: 'ucb', name: 'UC Berkeley', domain: '@berkeley.edu', location: 'Berkeley, CA', logo: 'UCB', status: 'coming-soon' },
  { id: 'ucd', name: 'UC Davis', domain: '@ucdavis.edu', location: 'Davis, CA', logo: 'UCD', status: 'coming-soon' },
  { id: 'ucla', name: 'UCLA', domain: '@ucla.edu', location: 'Los Angeles, CA', logo: 'UCLA', status: 'coming-soon' },
  { id: 'ucm', name: 'UC Merced', domain: '@ucmerced.edu', location: 'Merced, CA', logo: 'UCM', status: 'coming-soon' },
  { id: 'ucr', name: 'UC Riverside', domain: '@ucr.edu', location: 'Riverside, CA', logo: 'UCR', status: 'coming-soon' },
  { id: 'ucsd', name: 'UC San Diego', domain: '@ucsd.edu', location: 'San Diego, CA', logo: 'UCSD', status: 'coming-soon' },
  { id: 'ucsf', name: 'UC San Francisco', domain: '@ucsf.edu', location: 'San Francisco, CA', logo: 'UCSF', status: 'coming-soon' },
  { id: 'ucsb', name: 'UC Santa Barbara', domain: '@ucsb.edu', location: 'Santa Barbara, CA', logo: 'UCSB', status: 'coming-soon' },
  { id: 'ucsc', name: 'UC Santa Cruz', domain: '@ucsc.edu', location: 'Santa Cruz, CA', logo: 'UCSC', status: 'coming-soon' },
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
            const isAvailable = uni.status !== 'coming-soon';
            return (
              <TouchableOpacity
                key={uni.id}
                onPress={() => {
                  Keyboard.dismiss();
                  if (!isAvailable) {
                    Alert.alert(
                      'Coming soon',
                      `${uni.name} is on the roadmap. ClassMate is starting at UC Irvine first while we prepare course data support for more UC campuses.`
                    );
                    return;
                  }
                  setSelected(uni);
                }}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 16, borderRadius: 16, marginBottom: 10,
                  borderWidth: 2,
                  borderColor: isSelected ? '#4169E1' : '#e5e7eb',
                  backgroundColor: isSelected ? 'rgba(65,105,225,0.06)' : isAvailable ? 'white' : '#f9fafb',
                  opacity: isAvailable ? 1 : 0.72,
                }}
              >
                {/* Logo */}
                <View style={{
                  width: 56, height: 56, borderRadius: 14,
                  backgroundColor: isAvailable ? 'rgba(65,105,225,0.10)' : '#eef0f4',
                  alignItems: 'center', justifyContent: 'center',
                  marginRight: 14,
                }}>
                  {uni.id === 'uci' ? (
                    <Image
                      source={require('../../assets/ucirvine-monogram.png')}
                      style={{ width: 44, height: 19 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ color: isAvailable ? '#4169E1' : '#9ca3af', fontWeight: 'bold', fontSize: 13 }}>{uni.logo}</Text>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: isAvailable ? '#111827' : '#6b7280' }}>{uni.name}</Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: isAvailable ? 'rgba(65,105,225,0.10)' : '#e5e7eb',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: isAvailable ? '#4169E1' : '#6b7280' }}>
                        {isAvailable ? 'AVAILABLE' : 'COMING SOON'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{uni.location}</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{uni.domain}</Text>
                  {!isAvailable ? (
                    <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 5, lineHeight: 16 }}>
                      Course data support is being prepared.
                    </Text>
                  ) : null}
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
            onPress={() => {
              Keyboard.dismiss();
              onContinue(selected);
            }}
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
