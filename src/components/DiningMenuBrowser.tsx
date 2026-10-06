import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { currentOrNextMeal, isStapleStation, type DiningLocationMenu, type DiningMenuStation } from '../data/diningMenus';

/**
 * One hall, one meal at a time.
 *
 * The old sheet rendered every hall × every meal × every station as one
 * continuous list — around 200 rows on a weekday, with stations named
 * "Station 1..5" — so finding tonight's dinner meant scrolling past breakfast.
 * Here the hall and meal are chosen up top (defaulting to whatever is being
 * served now), the day's real dishes lead, and the stations that serve the same
 * thing every day sit collapsed at the bottom.
 */
type Props = {
  menus: DiningLocationMenu[];
  accent: string;
  onOpenOfficialMenu: (url: string) => void;
};

export default function DiningMenuBrowser({ menus, accent, onOpenOfficialMenu }: Props) {
  const { colors } = useTheme();
  const [hallId, setHallId] = useState<string>(() => (menus.find((m) => m.isOpen) ?? menus[0])?.id ?? '');
  const hall = menus.find((m) => m.id === hallId) ?? menus[0];
  const defaultMeal = useMemo(() => (hall ? currentOrNextMeal(hall) : null), [hall]);
  const [mealId, setMealId] = useState<string | null>(defaultMeal?.id ?? null);
  const [openStaples, setOpenStaples] = useState<Set<string>>(new Set());

  // Switching halls re-picks the meal being served there; meal ids differ.
  useEffect(() => {
    setMealId(defaultMeal?.id ?? null);
    setOpenStaples(new Set());
  }, [hallId, defaultMeal?.id]);

  if (!hall) return null;
  const meals = hall.meals.filter((m) => m.stations.some((s) => s.items.length > 0));
  const meal = meals.find((m) => m.id === mealId) ?? defaultMeal ?? meals[0];
  const featured = meal?.stations.filter((s) => !isStapleStation(s.name) && s.items.length > 0) ?? [];
  const staples = meal?.stations.filter((s) => isStapleStation(s.name) && s.items.length > 0) ?? [];

  const toggleStaple = (id: string) => setOpenStaples((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <View>
      {/* Hall */}
      {menus.length > 1 ? (
        <View style={{ flexDirection: 'row', backgroundColor: colors.bgSecondary, borderRadius: 14, padding: 3, gap: 3 }}>
          {menus.map((m) => {
            const selected = m.id === hall.id;
            const dot = m.isOpen === true ? '#10B981' : m.isOpen === false ? '#EF4444' : colors.textTertiary;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setHallId(m.id)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${m.name}${m.statusLabel ? `, ${m.statusLabel}` : ''}`}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 9, borderRadius: 11,
                  backgroundColor: selected ? colors.card : 'transparent',
                  shadowColor: '#000', shadowOpacity: selected ? 0.06 : 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: selected ? '800' : '600', color: selected ? colors.text : colors.textSecondary, flexShrink: 1 }}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {hall.statusDetail ? (
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 10 }}>{hall.statusDetail}</Text>
      ) : null}

      {/* Meal */}
      {meals.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
          {meals.map((m) => {
            const selected = m.id === meal?.id;
            const isNow = m.id === defaultMeal?.id && hall.isOpen === true;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => { setMealId(m.id); setOpenStaples(new Set()); }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${m.name}${m.timeLabel ? `, ${m.timeLabel}` : ''}${isNow ? ', now serving' : ''}`}
                style={{
                  borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
                  backgroundColor: selected ? accent : colors.card,
                  borderWidth: 1, borderColor: selected ? accent : colors.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? '#fff' : colors.text }}>
                  {m.name}{isNow ? ' · Now' : ''}
                </Text>
                {m.timeLabel ? (
                  <Text style={{ fontSize: 11, fontWeight: '600', color: selected ? 'rgba(255,255,255,0.85)' : colors.textTertiary, marginTop: 1 }}>
                    {m.timeLabel}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {/* The day's dishes */}
      <View style={{ marginTop: 16, gap: 16 }}>
        {featured.map((station) => (
          <StationBlock key={station.id} station={station} accent={accent} />
        ))}
        {featured.length === 0 && staples.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>No menu posted for this meal yet.</Text>
        ) : null}
      </View>

      {/* Same every day — collapsed */}
      {staples.length > 0 ? (
        <View style={{ marginTop: 22 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textTertiary, marginBottom: 6 }}>EVERY DAY</Text>
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden' }}>
            {staples.map((station, i) => {
              const open = openStaples.has(station.id);
              return (
                <View key={station.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.card }}>
                  <TouchableOpacity
                    onPress={() => toggleStaple(station.id)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${station.name}, ${station.items.length} items`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}
                  >
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.text }}>{station.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textTertiary, marginRight: 6 }}>{station.items.length} items</Text>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textTertiary} />
                  </TouchableOpacity>
                  {open ? (
                    <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, paddingHorizontal: 14, paddingBottom: 12 }}>
                      {station.items.map((item) => item.name).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => onOpenOfficialMenu(hall.officialUrl)}
        activeOpacity={0.72}
        accessibilityRole="link"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 22, paddingVertical: 10 }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>Nutrition & allergens on the official menu</Text>
        <Ionicons name="open-outline" size={14} color={accent} />
      </TouchableOpacity>
    </View>
  );
}

function StationBlock({ station, accent }: { station: DiningMenuStation; accent: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: accent, marginBottom: 6 }}>
        {station.name.toUpperCase()}
      </Text>
      <View style={{ gap: 5 }}>
        {station.items.map((item) => (
          <Text key={item.id} style={{ fontSize: 15, lineHeight: 21, color: colors.text }}>
            {item.name}
          </Text>
        ))}
      </View>
    </View>
  );
}
