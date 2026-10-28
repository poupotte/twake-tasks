import { Avatar } from '@linagora/twake-mui'
import { CalendarToday, Check, Flag, Icon } from '@linagora/twake-icons'
import type { ReactElement } from 'react'

import { AvatarStack, MetaChip } from '@/ds/Columns'
import type { Person, Priority, Task } from '@/domain/board'
import { displayName } from '@/domain/person'
import {
  dueLabel,
  dueState,
  formatDay,
  shortDay,
  type DueState
} from '@/ui/boards/dueLabel'
import { PersonAvatar } from '@/ui/boards/PersonAvatar'
import { useI18n } from '@/ui/i18n/useI18n'

const PRIORITY_TONE = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'neutral'
} as const

export function PriorityChip({
  priority
}: {
  priority: Priority
}): ReactElement {
  const { t } = useI18n()
  return (
    <MetaChip
      icon={<Icon icon={Flag} />}
      tone={PRIORITY_TONE[priority]}
      label={t('board.priorityLabel', { level: priority })}
    >
      {t('board.priority', { level: priority })}
    </MetaChip>
  )
}

const DUE_TONE = {
  upcoming: 'neutral',
  soon: 'warning',
  overdue: 'error',
  done: 'success'
} as const satisfies Record<DueState, string>

const DUE_LABEL = {
  upcoming: 'board.due',
  soon: 'board.dueSoon',
  overdue: 'board.overdue',
  done: 'board.dueDone'
} as const satisfies Record<DueState, string>

// Like a Trello badge: grey ahead of time, amber within a day, red once late
// and green once done; a start date makes it a span.
export function DueChip({ task }: { task: Task }): ReactElement | null {
  const { t, lang } = useI18n()
  const due = dueLabel(task, lang)
  if (!task.dueDate || !due) {
    if (!task.startDate) return null
    return (
      <MetaChip
        icon={<Icon icon={CalendarToday} />}
        label={t('dates.startOn', { date: formatDay(task.startDate, lang) })}
      >
        {shortDay(task.startDate, lang)}
      </MetaChip>
    )
  }
  const state = dueState(task) ?? 'upcoming'
  const day = shortDay(task.dueDate, lang)
  return (
    <MetaChip
      icon={<Icon icon={state === 'done' ? Check : CalendarToday} />}
      tone={DUE_TONE[state]}
      label={[
        task.startDate &&
          t('dates.startOn', { date: formatDay(task.startDate, lang) }),
        t(DUE_LABEL[state], { date: due })
      ]
        .filter(Boolean)
        .join(', ')}
    >
      {task.startDate
        ? t('board.span', { start: shortDay(task.startDate, lang), due: day })
        : day}
    </MetaChip>
  )
}

export function Assignees({ people }: { people: Person[] }): ReactElement {
  const { t } = useI18n()
  const shown = people.length > 3 ? 2 : 3
  const hidden = people.length - shown
  return (
    <AvatarStack>
      {people.slice(0, shown).map(person => (
        <PersonAvatar
          key={person.userId}
          email={person.email}
          name={person.name}
          avatar={person.avatar}
          label={t('board.assignee', { name: displayName(person) })}
        />
      ))}
      {hidden > 0 && (
        <Avatar
          size={24}
          role="img"
          aria-label={t('board.moreAssignees', { smart_count: hidden })}
        >
          {`+${String(hidden)}`}
        </Avatar>
      )}
    </AvatarStack>
  )
}
