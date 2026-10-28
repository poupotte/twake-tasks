import { Icon, Pen } from '@linagora/twake-icons'
import {
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { Row } from '@/ds/Columns'
import {
  DayCalendar,
  DayField,
  EditorActions,
  EditorPopover,
  FieldRow,
  MoreFields,
  QuickPicks
} from '@/ds/Pickers'
import type { Reminder } from '@/application/boards'
import type { Duration, Recurrence, Task } from '@/domain/board'
import {
  dueLabel,
  formatDay,
  localToday,
  localZone,
  recurrenceLabel
} from '@/ui/boards/dueLabel'
import {
  useAddReminder,
  useBoardChange,
  useDeleteReminder,
  useReminders
} from '@/ui/boards/queries'
import { useI18n } from '@/ui/i18n/useI18n'

type Translate = ReturnType<typeof useI18n>['t']

const REPEATS = ['never', 'days', 'weeks', 'months', 'years', 'custom'] as const
type Repeat = (typeof REPEATS)[number]

const REPEAT_LABEL = {
  never: 'dates.repeatNever',
  days: 'dates.repeatDaily',
  weeks: 'dates.repeatWeekly',
  months: 'dates.repeatMonthly',
  years: 'dates.repeatYearly',
  custom: 'dates.repeatCustom'
} as const satisfies Record<Repeat, string>

// Minutes before the due time, as in Trello's reminder list.
const REMINDS = ['none', '0', '15', '60', '1440', '2880'] as const
type Remind = (typeof REMINDS)[number]

const HOUR = 60
const DAY = 24 * HOUR

function remindLabel(t: Translate, remind: Remind): string {
  if (remind === 'none') return t('dates.remindNone')
  const minutes = Number(remind)
  if (minutes === 0) return t('reminders.atDue')
  if (minutes % DAY === 0) {
    return t('reminders.daysBefore', { smart_count: minutes / DAY })
  }
  if (minutes % HOUR === 0) {
    return t('reminders.hoursBefore', { smart_count: minutes / HOUR })
  }
  return t('reminders.minutesBefore', { smart_count: minutes })
}

/** The relative reminder this panel manages: the first one it can show. */
function managedReminder(reminders: Reminder[] | undefined): Reminder | null {
  return (
    reminders?.find(reminder =>
      REMINDS.some(remind => remind === String(reminder.beforeMinutes))
    ) ?? null
  )
}

interface Draft {
  hasStart: boolean
  startDate: string
  hasDue: boolean
  dueDate: string
  dueTime: string
  pinned: boolean
  repeat: Repeat
  every: string
  recurUnit: Recurrence['unit']
  fromCompletion: boolean
  remind: Remind
  deadline: string
  amount: string
  unit: Duration['unit']
}

function repeatOf(recurrence: Recurrence | null): Repeat {
  if (!recurrence) return 'never'
  return recurrence.every === 1 && !recurrence.fromCompletion
    ? recurrence.unit
    : 'custom'
}

function draftOf(task: Task, reminder: Reminder | null): Draft {
  return {
    hasStart: task.startDate !== null,
    startDate: task.startDate ?? '',
    hasDue: task.dueDate !== null,
    dueDate: task.dueDate ?? '',
    dueTime: task.dueTime ?? '',
    pinned: task.dueZone !== null,
    repeat: repeatOf(task.recurrence),
    every: task.recurrence ? String(task.recurrence.every) : '1',
    recurUnit: task.recurrence?.unit ?? 'weeks',
    fromCompletion: task.recurrence?.fromCompletion ?? false,
    remind: reminder ? (String(reminder.beforeMinutes) as Remind) : 'none',
    deadline: task.deadline ?? '',
    amount: task.duration ? String(task.duration.amount) : '',
    unit: task.duration?.unit ?? 'minutes'
  }
}

function recurrenceOf(draft: Draft): Recurrence | null {
  if (draft.repeat === 'never') return null
  if (draft.repeat !== 'custom') {
    return { every: 1, unit: draft.repeat, fromCompletion: false }
  }
  return Number(draft.every) > 0
    ? {
        every: Number(draft.every),
        unit: draft.recurUnit,
        fromCompletion: draft.fromCompletion
      }
    : null
}

const RECURRENCE_UNITS: Recurrence['unit'][] = [
  'days',
  'weeks',
  'months',
  'years'
]

const today = () => new Date(`${localToday()}T00:00:00Z`)

function inDays(days: number): string {
  const day = today()
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

const untilNextMonday = (): number => 8 - (today().getUTCDay() || 7)

const hasDates = (task: Task): boolean =>
  task.startDate !== null ||
  task.dueDate !== null ||
  task.deadline !== null ||
  task.duration !== null

function Summary({ task }: { task: Task }): ReactElement {
  const { t, lang } = useI18n()
  const due = dueLabel(task, lang)
  const facts = [
    task.startDate &&
      t('dates.startOn', { date: formatDay(task.startDate, lang) }),
    due && t('board.due', { date: due }),
    task.deadline &&
      t('dates.deadlineOn', { date: formatDay(task.deadline, lang) }),
    task.duration &&
      t(`dates.${task.duration.unit}`, { amount: task.duration.amount }),
    task.recurrence && recurrenceLabel(t, task.recurrence)
  ].filter(Boolean)

  if (facts.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        {t('dates.none')}
      </Typography>
    )
  }
  return <Typography variant="body2">{facts.join(' · ')}</Typography>
}

export function Dates({
  task,
  boardId,
  editable
}: {
  task: Task
  boardId: string
  editable: boolean
}): ReactElement {
  const { t } = useI18n()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <Row>
      <Summary task={task} />
      {editable && (
        <IconButton
          size="small"
          aria-label={t('dates.edit')}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
        >
          <Icon icon={Pen} size={14} />
        </IconButton>
      )}
      {anchor && (
        <DatesEditor
          task={task}
          boardId={boardId}
          anchor={anchor}
          onClose={() => {
            setAnchor(null)
          }}
        />
      )}
    </Row>
  )
}

/**
 * One panel for every date of a task, after Trello's: a calendar on top that
 * fills the start or the due date, whichever was last focused, then the two
 * dates with their check boxes, the repetition and a reminder. The deadline
 * and the duration sit under "More options".
 */
function DatesEditor({
  task,
  boardId,
  anchor,
  onClose
}: {
  task: Task
  boardId: string
  anchor: HTMLElement
  onClose: () => void
}): ReactElement | null {
  const reminders = useReminders(boardId, task.id)
  // The draft starts from the reminders, so it waits for them.
  if (reminders.isPending) return null
  return (
    <DatesForm
      task={task}
      boardId={boardId}
      anchor={anchor}
      onClose={onClose}
      reminder={managedReminder(reminders.data)}
    />
  )
}

function DatesForm({
  task,
  boardId,
  anchor,
  onClose,
  reminder
}: {
  task: Task
  boardId: string
  anchor: HTMLElement
  onClose: () => void
  reminder: Reminder | null
}): ReactElement {
  const { t } = useI18n()
  const [draft, setDraft] = useState(() => draftOf(task, reminder))
  const [target, setTarget] = useState<'start' | 'due'>(
    task.startDate !== null && task.dueDate === null ? 'start' : 'due'
  )
  const addReminder = useAddReminder(boardId, task.id)
  const deleteReminder = useDeleteReminder(boardId, task.id)

  const startDate = draft.hasStart ? draft.startDate : ''
  const dueDate = draft.hasDue ? draft.dueDate : ''
  const startAfterDue = Boolean(startDate && dueDate && startDate > dueDate)

  const save = useBoardChange(boardId, async (api, next: Draft) => {
    const due = next.hasDue ? next.dueDate : ''
    const dueTime = due && next.dueTime ? next.dueTime : null
    await api.editTask(boardId, task.id, {
      startDate: (next.hasStart && next.startDate) || null,
      dueDate: due || null,
      dueTime,
      dueZone: dueTime && next.pinned ? (task.dueZone ?? localZone()) : null,
      deadline: next.deadline || null,
      duration:
        Number(next.amount) > 0
          ? { amount: Number(next.amount), unit: next.unit }
          : null,
      recurrence: due ? recurrenceOf(next) : null
    })
    const kept = reminder ? String(reminder.beforeMinutes) : 'none'
    const wanted = due ? next.remind : kept
    if (wanted === kept) return
    if (reminder) await deleteReminder.mutateAsync(reminder.id)
    if (wanted !== 'none') {
      await addReminder.mutateAsync({
        beforeMinutes: Number(wanted),
        zone: localZone()
      })
    }
  })

  const set = (changes: Partial<Draft>) => {
    setDraft(previous => ({ ...previous, ...changes }))
  }
  const pick = (day: string) => {
    if (target === 'start') {
      set({ startDate: day, hasStart: day !== '' })
      // Like a range: the next click picks the due date.
      setTarget('due')
    } else {
      set({ dueDate: day, hasDue: day !== '' })
    }
  }
  const picks = [
    { label: t('dates.today'), day: inDays(0) },
    { label: t('dates.tomorrow'), day: inDays(1) },
    { label: t('dates.nextWeek'), day: inDays(untilNextMonday()) },
    { label: t('dates.noDate'), day: '' }
  ]
  const remove = () => {
    save.mutate(
      {
        ...draft,
        hasStart: false,
        hasDue: false,
        repeat: 'never',
        deadline: '',
        amount: ''
      },
      { onSuccess: onClose }
    )
  }

  return (
    <EditorPopover
      label={t('task.dates')}
      anchor={anchor}
      onClose={onClose}
      onSubmit={() => {
        if (!startAfterDue) save.mutate(draft, { onSuccess: onClose })
      }}
    >
      <DayCalendar
        value={target === 'start' ? startDate : dueDate}
        rangeStart={target === 'due' ? startDate : ''}
        referenceDay={startDate || dueDate}
        onChange={pick}
      />
      <QuickPicks>
        {picks.map(quick => (
          <Chip
            key={quick.label}
            size="small"
            label={quick.label}
            variant={
              (target === 'start' ? startDate : dueDate) === quick.day
                ? 'filled'
                : 'outlined'
            }
            onClick={() => {
              pick(quick.day)
            }}
          />
        ))}
      </QuickPicks>
      <Divider />
      <FormControlLabel
        label={t('dates.start')}
        control={
          <Checkbox
            size="small"
            checked={draft.hasStart}
            onChange={event => {
              set({
                hasStart: event.target.checked,
                ...(event.target.checked &&
                  !draft.startDate && { startDate: dueDate || inDays(0) })
              })
              setTarget(event.target.checked ? 'start' : 'due')
            }}
          />
        }
      />
      <DayField
        label={t('dates.start')}
        value={startDate}
        disabled={!draft.hasStart}
        onFocus={() => {
          setTarget('start')
        }}
        onChange={day => {
          set({ startDate: day })
        }}
      />
      <FormControlLabel
        label={t('dates.due')}
        control={
          <Checkbox
            size="small"
            checked={draft.hasDue}
            onChange={event => {
              set({
                hasDue: event.target.checked,
                ...(event.target.checked &&
                  !draft.dueDate && { dueDate: inDays(1) })
              })
              setTarget('due')
            }}
          />
        }
      />
      <FieldRow>
        <DayField
          label={t('dates.dueDate')}
          value={dueDate}
          disabled={!draft.hasDue}
          onFocus={() => {
            setTarget('due')
          }}
          onChange={day => {
            set({ dueDate: day })
          }}
        />
        <TextField
          type="time"
          label={t('dates.time')}
          value={draft.dueTime}
          disabled={!dueDate}
          onChange={event => {
            set({ dueTime: event.target.value })
          }}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </FieldRow>
      {dueDate && draft.dueTime && (
        <FormControlLabel
          label={t('dates.pin', { zone: task.dueZone ?? localZone() })}
          control={
            <Checkbox
              size="small"
              checked={draft.pinned}
              onChange={event => {
                set({ pinned: event.target.checked })
              }}
            />
          }
        />
      )}
      {startAfterDue && (
        <Typography role="alert" variant="caption" color="error">
          {t('dates.startAfterDue')}
        </Typography>
      )}
      <TextField
        select
        label={t('dates.repeat')}
        value={dueDate ? draft.repeat : 'never'}
        disabled={!dueDate}
        onChange={event => {
          set({ repeat: event.target.value as Repeat })
        }}
        size="small"
        fullWidth
      >
        {REPEATS.map(repeat => (
          <MenuItem key={repeat} value={repeat}>
            {t(REPEAT_LABEL[repeat])}
          </MenuItem>
        ))}
      </TextField>
      {dueDate && draft.repeat === 'custom' && (
        <>
          <FieldRow>
            <TextField
              type="number"
              label={t('dates.repeatEvery')}
              value={draft.every}
              onChange={event => {
                set({ every: event.target.value })
              }}
              size="small"
              slotProps={{ htmlInput: { min: 1, max: 1000 } }}
            />
            <TextField
              select
              label={t('dates.unit')}
              value={draft.recurUnit}
              onChange={event => {
                set({ recurUnit: event.target.value as Recurrence['unit'] })
              }}
              size="small"
            >
              {RECURRENCE_UNITS.map(unit => (
                <MenuItem key={unit} value={unit}>
                  {t(`dates.units.${unit}`)}
                </MenuItem>
              ))}
            </TextField>
          </FieldRow>
          <FormControlLabel
            label={t('dates.fromCompletion')}
            control={
              <Checkbox
                size="small"
                checked={draft.fromCompletion}
                onChange={event => {
                  set({ fromCompletion: event.target.checked })
                }}
              />
            }
          />
        </>
      )}
      <TextField
        select
        label={t('dates.remind')}
        value={dueDate ? draft.remind : 'none'}
        disabled={!dueDate}
        onChange={event => {
          set({ remind: event.target.value as Remind })
        }}
        size="small"
        fullWidth
      >
        {REMINDS.map(remind => (
          <MenuItem key={remind} value={remind}>
            {remindLabel(t, remind)}
          </MenuItem>
        ))}
      </TextField>
      <MoreFields
        label={t('dates.more')}
        open={task.deadline !== null || task.duration !== null}
      >
        <DayField
          label={t('dates.deadline')}
          value={draft.deadline}
          onChange={deadline => {
            set({ deadline })
          }}
        />
        <FieldRow>
          <TextField
            type="number"
            label={t('dates.duration')}
            value={draft.amount}
            onChange={event => {
              set({ amount: event.target.value })
            }}
            size="small"
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <TextField
            select
            label={t('dates.unit')}
            value={draft.unit}
            onChange={event => {
              set({ unit: event.target.value as Duration['unit'] })
            }}
            size="small"
          >
            <MenuItem value="minutes">{t('dates.unitMinutes')}</MenuItem>
            <MenuItem value="days">{t('dates.unitDays')}</MenuItem>
          </TextField>
        </FieldRow>
      </MoreFields>
      {save.isError && (
        <Typography role="alert" variant="caption" color="error">
          {t('dates.saveFailed')}
        </Typography>
      )}
      <EditorActions
        start={
          hasDates(task) && (
            <Button
              variant="text"
              color="error"
              size="small"
              disabled={save.isPending}
              onClick={remove}
            >
              {t('dates.remove')}
            </Button>
          )
        }
      >
        <Button
          type="submit"
          size="small"
          disabled={save.isPending || startAfterDue}
        >
          {t('dates.save')}
        </Button>
      </EditorActions>
    </EditorPopover>
  )
}
