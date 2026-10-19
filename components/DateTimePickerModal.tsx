import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DateTimePickerModalProps {
  visible: boolean;
  initialDate?: Date;
  onConfirm: (selectedDate: Date) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  initialTab?: 'date' | 'time';
  timeOnly?: boolean;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function DateTimePickerModal({
  visible,
  initialDate,
  onConfirm,
  onCancel,
  title,
  subtitle,
  initialTab = 'date',
  timeOnly = false,
}: DateTimePickerModalProps) {
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(timeOnly ? 'time' : initialTab);
  
  // Date State
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => initialDate || new Date());
  const [selectedDay, setSelectedDay] = useState<number>(() => (initialDate || new Date()).getDate());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => (initialDate || new Date()).getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => (initialDate || new Date()).getFullYear());

  // Time State
  const [selectedHour12, setSelectedHour12] = useState<number>(() => {
    const h = (initialDate || new Date()).getHours();
    const h12 = h % 12;
    return h12 === 0 ? 12 : h12;
  });
  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    const m = (initialDate || new Date()).getMinutes();
    // Round to nearest 5 minutes
    return Math.round(m / 5) * 5 % 60;
  });
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>(() => {
    return (initialDate || new Date()).getHours() >= 12 ? 'PM' : 'AM';
  });

  // Sync state when modal opens with initialDate
  useEffect(() => {
    if (visible) {
      const base = initialDate ? new Date(initialDate) : new Date();
      // default to at least 1 hour from now if base is in the past and not timeOnly
      if (!timeOnly && base.getTime() < Date.now()) {
        base.setHours(base.getHours() + 1);
      }
      setCurrentMonthDate(new Date(base.getFullYear(), base.getMonth(), 1));
      setSelectedDay(base.getDate());
      setSelectedMonth(base.getMonth());
      setSelectedYear(base.getFullYear());

      const h = base.getHours();
      const h12 = h % 12 === 0 ? 12 : h % 12;
      setSelectedHour12(h12);
      setSelectedMinute(Math.round(base.getMinutes() / 5) * 5 % 60);
      setSelectedAmPm(h >= 12 ? 'PM' : 'AM');
      setActiveTab(timeOnly ? 'time' : initialTab);
    }
  }, [visible, initialDate, initialTab, timeOnly]);

  // Calendar Math
  const viewYear = currentMonthDate.getFullYear();
  const viewMonth = currentMonthDate.getMonth();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    setSelectedMonth(viewMonth);
    setSelectedYear(viewYear);
  };

  // Quick Date presets
  const applyDatePreset = (preset: 'today' | 'tomorrow' | 'weekend' | 'nextMonday') => {
    const d = new Date();
    if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (preset === 'weekend') {
      const day = d.getDay();
      const daysUntilSaturday = (6 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilSaturday);
    } else if (preset === 'nextMonday') {
      const day = d.getDay();
      const daysUntilMonday = (8 - day) % 7 || 7;
      d.setDate(d.getDate() + daysUntilMonday);
    }
    setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(d.getDate());
    setSelectedMonth(d.getMonth());
    setSelectedYear(d.getFullYear());
  };

  // Quick Time presets
  const applyTimePreset = (h24: number, m: number) => {
    const isPm = h24 >= 12;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    setSelectedHour12(h12);
    setSelectedMinute(m);
    setSelectedAmPm(isPm ? 'PM' : 'AM');
  };

  const handleConfirm = () => {
    let hour24 = selectedHour12 % 12;
    if (selectedAmPm === 'PM') {
      hour24 += 12;
    }
    const finalDate = new Date(selectedYear, selectedMonth, selectedDay, hour24, selectedMinute, 0);
    onConfirm(finalDate);
  };

  // Compute preview string
  let previewHour24 = selectedHour12 % 12;
  if (selectedAmPm === 'PM') previewHour24 += 12;
  const previewDate = new Date(selectedYear, selectedMonth, selectedDay, previewHour24, selectedMinute);
  const formattedPreview = timeOnly
    ? `Daily at ${selectedHour12}:${selectedMinute.toString().padStart(2, '0')} ${selectedAmPm}`
    : previewDate.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }) + ` at ${selectedHour12}:${selectedMinute.toString().padStart(2, '0')} ${selectedAmPm}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>{title || 'Select Reminder Time'}</Text>
              <Text style={styles.headerSubtitle}>{subtitle || 'Pick an exact date and hour'}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher Tabs */}
          {!timeOnly && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'date' && styles.tabItemActive]}
                onPress={() => setActiveTab('date')}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color={activeTab === 'date' ? Colors.dark.primary : Colors.dark.textMuted}
                />
                <Text style={[styles.tabText, activeTab === 'date' && styles.tabTextActive]}>
                  {previewDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'time' && styles.tabItemActive]}
                onPress={() => setActiveTab('time')}
              >
                <Ionicons
                  name="time"
                  size={16}
                  color={activeTab === 'time' ? Colors.dark.primary : Colors.dark.textMuted}
                />
                <Text style={[styles.tabText, activeTab === 'time' && styles.tabTextActive]}>
                  {`${selectedHour12}:${selectedMinute.toString().padStart(2, '0')} ${selectedAmPm}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {activeTab === 'date' ? (
              <View style={styles.calendarSection}>
                {/* Quick Date Presets */}
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyDatePreset('today')}>
                    <Text style={styles.quickChipText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyDatePreset('tomorrow')}>
                    <Text style={styles.quickChipText}>Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyDatePreset('weekend')}>
                    <Text style={styles.quickChipText}>This Weekend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyDatePreset('nextMonday')}>
                    <Text style={styles.quickChipText}>Next Mon</Text>
                  </TouchableOpacity>
                </View>

                {/* Month Navigator */}
                <View style={styles.monthNav}>
                  <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
                    <Ionicons name="chevron-back" size={20} color={Colors.dark.text} />
                  </TouchableOpacity>
                  <Text style={styles.monthTitle}>
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </Text>
                  <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
                    <Ionicons name="chevron-forward" size={20} color={Colors.dark.text} />
                  </TouchableOpacity>
                </View>

                {/* Weekday Names */}
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((wd) => (
                    <Text key={wd} style={styles.weekdayText}>
                      {wd}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {/* Empty cells before 1st of month */}
                  {Array.from({ length: firstDayWeekday }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.dayCellEmpty} />
                  ))}

                  {/* Day numbers */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const isSelected =
                      selectedDay === dayNum &&
                      selectedMonth === viewMonth &&
                      selectedYear === viewYear;

                    const today = new Date();
                    const isToday =
                      today.getDate() === dayNum &&
                      today.getMonth() === viewMonth &&
                      today.getFullYear() === viewYear;

                    return (
                      <TouchableOpacity
                        key={`day-${dayNum}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                        onPress={() => handleSelectDay(dayNum)}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                            isToday && !isSelected && styles.dayTextToday,
                          ]}
                        >
                          {dayNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={styles.timeSection}>
                {/* Time Presets */}
                <View style={styles.quickPresetRow}>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyTimePreset(9, 0)}>
                    <Text style={styles.quickChipText}>9:00 AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyTimePreset(13, 0)}>
                    <Text style={styles.quickChipText}>1:00 PM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyTimePreset(18, 0)}>
                    <Text style={styles.quickChipText}>6:00 PM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => applyTimePreset(21, 0)}>
                    <Text style={styles.quickChipText}>9:00 PM</Text>
                  </TouchableOpacity>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.amPmContainer}>
                  <TouchableOpacity
                    style={[styles.amPmBtn, selectedAmPm === 'AM' && styles.amPmBtnActive]}
                    onPress={() => setSelectedAmPm('AM')}
                  >
                    <Text style={[styles.amPmText, selectedAmPm === 'AM' && styles.amPmTextActive]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.amPmBtn, selectedAmPm === 'PM' && styles.amPmBtnActive]}
                    onPress={() => setSelectedAmPm('PM')}
                  >
                    <Text style={[styles.amPmText, selectedAmPm === 'PM' && styles.amPmTextActive]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Hour Selection */}
                <Text style={styles.sectionLabel}>Hour</Text>
                <View style={styles.hoursGrid}>
                  {HOURS_12.map((h) => {
                    const isSelected = selectedHour12 === h;
                    return (
                      <TouchableOpacity
                        key={`hour-${h}`}
                        style={[styles.hourChip, isSelected && styles.hourChipSelected]}
                        onPress={() => setSelectedHour12(h)}
                      >
                        <Text style={[styles.hourText, isSelected && styles.hourTextSelected]}>
                          {h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Minute Selection */}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Minute</Text>
                <View style={styles.minutesGrid}>
                  {MINUTE_STEPS.map((m) => {
                    const isSelected = selectedMinute === m;
                    return (
                      <TouchableOpacity
                        key={`min-${m}`}
                        style={[styles.minuteChip, isSelected && styles.minuteChipSelected]}
                        onPress={() => setSelectedMinute(m)}
                      >
                        <Text style={[styles.minuteText, isSelected && styles.minuteTextSelected]}>
                          :{m.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Confirmation Bar */}
          <View style={styles.footer}>
            <View style={styles.previewPill}>
              <Ionicons name="alarm" size={16} color={Colors.dark.primary} />
              <Text style={styles.previewText} numberOfLines={1}>
                {formattedPreview}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <LinearGradient
                  colors={['#13ec6d', '#0da84e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmGradient}
                >
                  <Text style={styles.confirmText}>Confirm Time</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - 32, 380),
    maxHeight: '85%',
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: Colors.dark.cardHover,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textMuted,
  },
  tabTextActive: {
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: 340,
  },
  quickPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickChip: {
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  quickChipText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  calendarSection: {
    paddingBottom: 10,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  monthNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  weekdayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 38,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 19,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  dayCellSelected: {
    backgroundColor: Colors.dark.primary,
  },
  dayText: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  dayTextToday: {
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#0D0D0D',
    fontWeight: '800',
  },
  timeSection: {
    paddingBottom: 10,
  },
  amPmContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  amPmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 6,
  },
  amPmBtnActive: {
    backgroundColor: Colors.dark.primaryFaded,
    borderColor: Colors.dark.primary,
    borderWidth: 1,
  },
  amPmText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textMuted,
  },
  amPmTextActive: {
    color: Colors.dark.primary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hourChip: {
    width: '23%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  hourChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  hourText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  hourTextSelected: {
    color: '#0D0D0D',
  },
  minutesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  minuteChip: {
    width: '23%',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  minuteChipSelected: {
    backgroundColor: Colors.dark.primary,
    borderColor: Colors.dark.primary,
  },
  minuteText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  minuteTextSelected: {
    color: '#0D0D0D',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primaryFaded,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  previewText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  confirmGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#0D0D0D',
    fontSize: 14,
    fontWeight: '800',
  },
});
