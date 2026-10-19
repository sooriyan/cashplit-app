import { RecurrenceFrequency } from '../types/todo';

/**
 * Calculates the next future occurrence timestamp based on the base date and recurrence frequency.
 * Guarantees that the returned timestamp is strictly in the future (relative to now).
 */
export function calculateNextOccurrence(
  baseDate: Date | string,
  frequency: RecurrenceFrequency,
  relativeTo: Date = new Date()
): string {
  const initial = typeof baseDate === 'string' ? new Date(baseDate) : new Date(baseDate.getTime());
  
  if (isNaN(initial.getTime()) || frequency === 'none') {
    return initial.toISOString();
  }

  const next = new Date(initial.getTime());
  const nowMs = relativeTo.getTime();

  // If the next date is in the future, return it directly if it hasn't triggered yet.
  // Otherwise, iteratively advance according to the frequency until it's in the future.
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
        // Handle end of month roll-over (e.g., Jan 31 -> Feb 28)
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

/**
 * Human-readable label for recurrence frequency
 */
export function getHumanReadableRecurrence(frequency: RecurrenceFrequency): string {
  switch (frequency) {
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

  // Time format: e.g. "4:30 PM"
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Compare calendar days
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
