import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/theme';

export interface CalendarWorkout {
  id: string;
  name: string;
  at: string;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export default function TrainingCalendar({
  month,
  workouts,
  onMonthChange,
  onOpen,
}: {
  month: Date;
  workouts: CalendarWorkout[];
  onMonthChange: (month: Date) => void;
  onOpen: (workoutId: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const nextBlocked =
    nextMonth.getFullYear() > today.getFullYear() ||
    (nextMonth.getFullYear() === today.getFullYear() && nextMonth.getMonth() > today.getMonth());

  const byDay = new Map<string, CalendarWorkout[]>();
  workouts.forEach((workout) => {
    const at = new Date(workout.at);
    if (at.getFullYear() !== year || at.getMonth() !== monthIndex) return;
    const key = dayKey(at);
    const list = byDay.get(key) ?? [];
    list.push(workout);
    byDay.set(key, list);
  });

  const selected = selectedKey ? byDay.get(selectedKey) ?? [] : [];
  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <View>
      <View style={styles.nav}>
        <Pressable
          style={styles.navBtn}
          onPress={() => onMonthChange(new Date(year, monthIndex - 1, 1))}
          accessibilityLabel="Previous month"
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Pressable style={styles.today} onPress={() => onMonthChange(monthStart(new Date()))}>
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
        <Pressable
          style={[styles.navBtn, nextBlocked && styles.navBtnDisabled]}
          disabled={nextBlocked}
          onPress={() => {
            if (nextBlocked) return;
            onMonthChange(nextMonth);
          }}
          accessibilityLabel="Next month"
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>
      <Text style={styles.monthName}>
        {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
      </Text>
      <View style={styles.grid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.dow}>
            {label}
          </Text>
        ))}
        {cells.map((day, index) => {
          if (day == null) return <View key={`pad-${index}`} style={styles.day} />;
          const date = new Date(year, monthIndex, day);
          const key = dayKey(date);
          const future = date.getTime() > todayStart.getTime();
          const hits = future ? [] : byDay.get(key) ?? [];
          const trained = hits.length > 0;
          return (
            <Pressable
              key={key}
              style={[styles.day, trained && styles.hit, selectedKey === key && styles.open, future && styles.futureDay]}
              disabled={future || !trained}
              onPress={() => {
                setSelectedKey(key);
                if (hits.length === 1) onOpen(hits[0].id);
              }}
            >
              <Text style={[styles.dayText, trained && styles.hitText, future && styles.futureText, sameDay(date, today) && !trained && styles.todayMark]}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {selected.length > 1 && (
        <View style={styles.list}>
          {selected.map((workout) => (
            <Pressable key={workout.id} style={styles.session} onPress={() => onOpen(workout.id)}>
              <Text style={typography.body}>{workout.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { color: colors.text, fontSize: 18 },
  navBtnDisabled: { opacity: 0.35 },
  futureDay: { opacity: 0.35 },
  futureText: { color: colors.textFaint },
  today: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  todayText: { ...typography.button, textTransform: 'uppercase', fontSize: 11 },
  monthName: { ...typography.h3, marginTop: spacing.sm, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: {
    width: '14.28%',
    textAlign: 'center',
    ...typography.caption,
    marginBottom: 6,
  },
  day: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { color: colors.textMuted, fontFamily: typography.body.fontFamily },
  hit: { backgroundColor: colors.accent, borderRadius: radii.sm },
  hitText: { color: colors.primaryForeground, fontFamily: typography.h3.fontFamily },
  open: { borderWidth: 1, borderColor: colors.primary },
  todayMark: { color: colors.primary },
  list: { marginTop: spacing.sm },
  session: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
});
