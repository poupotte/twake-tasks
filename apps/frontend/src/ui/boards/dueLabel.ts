import type { Recurrence, Task } from '@/domain/board'
import type { useI18n } from '@/ui/i18n/useI18n'

let followedZone: string | null = null

function isZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Counts days in this zone rather than the browser's, unless it is null or unknown. */
export function followZone(zone: string | null): void {
  followedZone = zone && isZone(zone) ? zone : null
}

export const localZone = (): string =>
  followedZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

// From parts, as the default pattern of a locale (even en-CA) varies by engine.
export function localToday(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: localZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .formatToParts(new Date())
      .map(part => [part.type, part.value])
  ) as Record<'year' | 'month' | 'day', string>
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** The instant a YYYY-MM-DDTHH:mm wall clock time shows in a zone, the local one by default. */
export function zonedInstant(wallClock: string, zone = localZone()): Date {
  const asUtc = Date.parse(`${wallClock}Z`)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
      .formatToParts(asUtc)
      .map(part => [part.type, Number(part.value)])
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute', number>
  const shown = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  )
  return new Date(2 * asUtc - shown)
}

// 24-hour in every language, like the stored due times and the pickers.
export function momentFormat(lang: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(lang, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: localZone()
  })
}

export function formatDay(day: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(new Date(day))
}

export type DueState = 'upcoming' | 'soon' | 'overdue' | 'done'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Where a due date stands, as on the card's badge: done once completed, late
 * once its time has passed, soon within the next 24 hours. A day without a
 * time is due at its end, so it is soon on the day itself. Canceled tasks and
 * tasks without a due date have no state.
 */
export function dueState(
  task: Pick<
    Task,
    'dueDate' | 'dueTime' | 'dueZone' | 'completedAt' | 'canceledAt'
  >,
  now: Date = new Date()
): DueState | null {
  if (!task.dueDate || task.canceledAt) return null
  if (task.completedAt) return 'done'
  if (!task.dueTime) {
    const today = localToday()
    if (task.dueDate < today) return 'overdue'
    return task.dueDate === today ? 'soon' : 'upcoming'
  }
  const due = zonedInstant(
    `${task.dueDate}T${task.dueTime}`,
    task.dueZone ?? localZone()
  ).getTime()
  if (due <= now.getTime()) return 'overdue'
  return due - now.getTime() <= DAY_MS ? 'soon' : 'upcoming'
}

export function shortDay(day: string, lang: string): string {
  const thisYear = day.slice(0, 4) === localToday().slice(0, 4)
  return new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
    ...(thisYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC'
  }).format(new Date(day))
}

export const recurrenceLabel = (
  t: ReturnType<typeof useI18n>['t'],
  recurrence: Recurrence
): string =>
  t(
    recurrence.fromCompletion
      ? `dates.every.${recurrence.unit}AfterCompletion`
      : `dates.every.${recurrence.unit}`,
    { smart_count: recurrence.every }
  )

// A pinned time shows its zone when the reader is elsewhere.
export function dueLabel(
  task: Pick<Task, 'dueDate' | 'dueTime' | 'dueZone'>,
  lang: string
): string | null {
  if (!task.dueDate) return null
  const day = formatDay(task.dueDate, lang)
  if (!task.dueTime) return day
  const zone =
    task.dueZone && task.dueZone !== localZone() ? ` ${task.dueZone}` : ''
  return `${day}, ${task.dueTime}${zone}`
}
