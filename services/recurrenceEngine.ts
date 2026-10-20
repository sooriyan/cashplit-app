import { RecurrenceFrequency } from '../types/todo';

/**
 * Parses "HH:mm" 24h string into hours and minutes
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hStr, mStr] = timeStr.split(':');
  const hour = parseInt(hStr || '0', 10);
  const minute = parseInt(mStr || '0', 10);
  return {
    hour: isNaN(hour) ? 0 : Math.min(23, Math.max(0, hour)),
    minute: isNaN(minute) ? 0 : Math.min(59, Math.max(0, minute)),
  };
}

/**
 * Formats "HH:mm" 24h string to 12h display (e.g. "14:30" -> "2:30 PM")
 */
export function formatTime12Hour(timeStr: string): string {
  const { hour, minute } = parseTimeString(timeStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Sorts and deduplicates "HH:mm" time strings chronologically
 */
export function sortTimeStrings(times: string[]): string[] {
  const unique = Array.from(new Set(times.filter(Boolean)));
  return unique.sort((a, b) => {
    const { hour: hA, minute: mA } = parseTimeString(a);
    const { hour: hB, minute: mB } = parseTimeString(b);
    return hA * 60 + mA - (hB * 60 + mB);
  });
}

/**
 * Calculates the next upcoming intra-day slot from an array of "HH:mm" times.
 * Guarantees that the returned timestamp is strictly in the future.
 */
export function calculateNextIntraDaySlot(
  dailyTimes: string[],
  relativeTo: Date = new Date()
): { nextIso: string; slotIndex: number; isTomorrow: boolean } {
  if (!dailyTimes || dailyTimes.length === 0) {
    const fallback = new Date(relativeTo.getTime() + 60 * 60 * 1000);
    return { nextIso: fallback.toISOString(), slotIndex: 0, isTomorrow: false };
  }

  const sortedTimes = sortTimeStrings(dailyTimes);
  const nowMs = relativeTo.getTime();

  // 1. Check if any slot later today is in the future
  for (let i = 0; i < sortedTimes.length; i++) {
    const { hour, minute } = parseTimeString(sortedTimes[i]);
    const candidate = new Date(
      relativeTo.getFullYear(),
      relativeTo.getMonth(),
      relativeTo.getDate(),
      hour,
      minute,
      0,
      0
    );

    if (candidate.getTime() > nowMs) {
      return {
        nextIso: candidate.toISOString(),
        slotIndex: i,
        isTomorrow: false,
      };
    }
  }

  // 2. All slots for today have elapsed; roll over to the first slot tomorrow
  const { hour: firstHour, minute: firstMinute } = parseTimeString(sortedTimes[0]);
  const tomorrowCandidate = new Date(
    relativeTo.getFullYear(),
    relativeTo.getMonth(),
    relativeTo.getDate() + 1,
    firstHour,
    firstMinute,
    0,
    0
  );

  return {
    nextIso: tomorrowCandidate.toISOString(),
    slotIndex: 0,
    isTomorrow: true,
  };
}

/**
 * Calculates the next future occurrence timestamp based on base date, frequency, and optional daily slots.
 * Guarantees that the returned timestamp is strictly in the future (relative to now).
 */
export function calculateNextOccurrence(
  baseDate: Date | string,
  frequency: RecurrenceFrequency,
  relativeTo: Date = new Date(),
  dailyTimes?: string[]
): string {
  // Handle multiple daily slots
  if (frequency === 'multiple_daily') {
    if (dailyTimes && dailyTimes.length > 0) {
      return calculateNextIntraDaySlot(dailyTimes, relativeTo).nextIso;
    }
    // Fallback if dailyTimes not provided: default to every 4 hours
    const next = new Date(relativeTo.getTime() + 4 * 60 * 60 * 1000);
    return next.toISOString();
  }

  const initial = typeof baseDate === 'string' ? new Date(baseDate) : new Date(baseDate.getTime());
  
  if (isNaN(initial.getTime()) || frequency === 'none') {
    return initial.toISOString();
  }

  const next = new Date(initial.getTime());
  const nowMs = relativeTo.getTime();

  let safetyCounter = 0;
  while (next.getTime() <= nowMs && safetyCounter < 1000) {
    safetyCounter++;
    switch (frequency) {
      case 'daily': {
        next.setDate(next.getDate() + 1);
        break;
      }
      case 'weekly': {
        next.setDate(next.getDate() + 7);
        break;
      }
      case 'monthly': {
        const currentMonth = next.getMonth();
        const currentDate = next.getDate();
        next.setMonth(currentMonth + 1);
        if (next.getDate() < currentDate) {
          next.setDate(0);
        }
        break;
      }
      case 'yearly': {
        next.setFullYear(next.getFullYear() + 1);
        break;
      }
    }
  }

  return next.toISOString();
}

export interface UpcomingOccurrence {
  triggerDate: Date;
  slotIndex?: number;
  subtitle?: string;
}

/**
 * Calculates a rolling lookahead window of upcoming occurrences (e.g. next 7 days / up to maxCount).
 * Ensures scheduled notifications fire continuously even if the app remains closed for days.
 */
export function calculateUpcomingOccurrences(
  baseDate: Date | string,
  frequency: RecurrenceFrequency,
  relativeTo: Date = new Date(),
  dailyTimes?: string[],
  maxCount = 14,
  maxDaysAhead = 7
): UpcomingOccurrence[] {
  const occurrences: UpcomingOccurrence[] = [];
  const nowMs = relativeTo.getTime();
  const maxHorizonMs = nowMs + maxDaysAhead * 24 * 60 * 60 * 1000;

  if (frequency === 'none') {
    const d = typeof baseDate === 'string' ? new Date(baseDate) : new Date(baseDate.getTime());
    if (d.getTime() > nowMs) {
      occurrences.push({ triggerDate: d });
    }
    return occurrences;
  }

  if (frequency === 'multiple_daily') {
    if (!dailyTimes || dailyTimes.length === 0) return occurrences;
    const sortedTimes = sortTimeStrings(dailyTimes);

    // Iterate through today (day 0) and next maxDaysAhead days
    for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset++) {
      const curDay = new Date(
        relativeTo.getFullYear(),
        relativeTo.getMonth(),
        relativeTo.getDate() + dayOffset,
        0, 0, 0, 0
      );

      for (let sIdx = 0; sIdx < sortedTimes.length; sIdx++) {
        const { hour, minute } = parseTimeString(sortedTimes[sIdx]);
        const slotDate = new Date(
          curDay.getFullYear(),
          curDay.getMonth(),
          curDay.getDate(),
          hour,
          minute,
          0,
          0
        );

        if (slotDate.getTime() > nowMs && slotDate.getTime() <= maxHorizonMs) {
          occurrences.push({
            triggerDate: slotDate,
            slotIndex: sIdx,
            subtitle: `🔁 ${sortedTimes.length}× Daily (Slot ${sIdx + 1}/${sortedTimes.length})`,
          });
          if (occurrences.length >= maxCount) {
            return occurrences;
          }
        }
      }
    }
    return occurrences;
  }

  // Single recurrence frequency: daily, weekly, monthly, yearly
  let currentRef = relativeTo;
  let safetyCounter = 0;

  while (occurrences.length < maxCount && safetyCounter < 50) {
    safetyCounter++;
    const nextIso = calculateNextOccurrence(baseDate, frequency, currentRef);
    const nextDate = new Date(nextIso);

    if (nextDate.getTime() <= currentRef.getTime()) {
      break;
    }
    if (nextDate.getTime() > maxHorizonMs) {
      break;
    }

    if (nextDate.getTime() > nowMs) {
      occurrences.push({
        triggerDate: nextDate,
        subtitle: `🔁 Repeat: ${frequency}`,
      });
    }

    // Advance reference point by 1 second past nextDate to get subsequent occurrence
    currentRef = new Date(nextDate.getTime() + 1000);
  }

  return occurrences;
}

/**
 * Human-readable label for recurrence frequency
 */
export function getHumanReadableRecurrence(
  frequency: RecurrenceFrequency,
  dailyTimesCount?: number
): string {
  switch (frequency) {
    case 'multiple_daily':
      return dailyTimesCount && dailyTimesCount > 1
        ? `${dailyTimesCount}× Daily`
        : 'Multiple times daily';
    case 'daily':
      return 'Repeats Daily';
    case 'weekly':
      return 'Repeats Weekly';
    case 'monthly':
      return 'Repeats Monthly';
    case 'yearly':
      return 'Repeats Yearly';
    case 'none':
    default:
      return 'Does not repeat';
  }
}

/**
 * Formats an ISO reminder date for display and flags whether it is overdue
 */
export function formatReminderDisplay(isoString: string | null | undefined): {
  label: string;
  isOverdue: boolean;
  timeString: string;
} {
  if (!isoString) {
    return { label: 'No reminder', isOverdue: false, timeString: '' };
  }

  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return { label: 'Invalid date', isOverdue: false, timeString: '' };
  }

  const now = new Date();
  const isOverdue = date.getTime() < now.getTime();

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let dayLabel = '';
  if (diffDays === 0) {
    dayLabel = 'Today';
  } else if (diffDays === 1) {
    dayLabel = 'Tomorrow';
  } else if (diffDays === -1) {
    dayLabel = 'Yesterday';
  } else if (diffDays > 1 && diffDays < 7) {
    dayLabel = date.toLocaleDateString([], { weekday: 'short' });
  } else {
    dayLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return {
    label: `${dayLabel}, ${timeString}`,
    isOverdue,
    timeString,
  };
}
