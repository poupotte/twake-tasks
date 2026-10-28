import '@/ds/dayjsLocales'

import { Cross, Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Collapse,
  IconButton,
  Popover,
  Typography
} from '@linagora/twake-mui'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { DateField } from '@mui/x-date-pickers/DateField'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { TimeField } from '@mui/x-date-pickers/TimeField'
import {
  deDE,
  enUS,
  esES,
  frFR,
  itIT,
  ruRU,
  viVN
} from '@mui/x-date-pickers/locales'
import dayjs, { type Dayjs } from 'dayjs'
import {
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from 'react'

type LocaleText = NonNullable<
  ComponentProps<typeof LocalizationProvider>['localeText']
>

const TEXTS: Record<string, typeof enUS> = {
  en: enUS,
  fr: frFR,
  de: deDE,
  it: itIT,
  es: esES,
  ru: ruRU,
  vi: viVN
}

const DAY = 'YYYY-MM-DD'
const MINUTE = 'YYYY-MM-DDTHH:mm'

export function PickersProvider({
  lang,
  children
}: {
  lang: string
  children: ReactNode
}): ReactElement {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={lang}
      // The locale packs type each text as `string | undefined`, which
      // exactOptionalPropertyTypes refuses for an optional key.
      localeText={
        (TEXTS[lang] ?? enUS).components.MuiLocalizationProvider.defaultProps
          .localeText as LocaleText
      }
    >
      {children}
    </LocalizationProvider>
  )
}

const parse = (value: string): Dayjs | null => (value ? dayjs(value) : null)

/**
 * Days are YYYY-MM-DD strings, empty for none. With `rangeStart`, the days
 * from it to `value` show as one span, its first day marked like the value.
 */
export function DayCalendar({
  value,
  onChange,
  rangeStart = '',
  referenceDay = ''
}: {
  value: string
  onChange: (day: string) => void
  rangeStart?: string
  /** The month to open on when there is no value. */
  referenceDay?: string
}): ReactElement {
  const spanEnd = value || rangeStart
  return (
    <DateCalendar
      value={parse(value)}
      {...(referenceDay && !value && { referenceDate: dayjs(referenceDay) })}
      onChange={(next: Dayjs | null) => {
        onChange(next?.format(DAY) ?? '')
      }}
      slotProps={{
        day: ownerState => {
          const day = ownerState.day.format(DAY)
          if (!rangeStart || ownerState.isDayOutsideMonth) return {}
          if (day === rangeStart && day !== value) {
            return {
              sx: theme => ({
                bgcolor: theme.vars.palette.primary.main,
                color: theme.vars.palette.primary.contrastText,
                '&:hover, &:focus': {
                  bgcolor: theme.vars.palette.primary.dark
                }
              })
            }
          }
          if (day > rangeStart && day < spanEnd) {
            return {
              sx: theme => ({
                bgcolor: theme.alpha(theme.vars.palette.primary.main, 0.12)
              })
            }
          }
          return {}
        }
      }}
      sx={{
        width: '100%',
        height: 'auto',
        '& .MuiPickersCalendarHeader-root': { mt: 0, mb: 0.5, pl: 1.5 },
        '& .MuiDayCalendar-weekDayLabel': { width: 32, height: 32 },
        '& .MuiPickerDay-root': { '--PickerDay-size': '32px' },
        // Six weeks of 32px days and their 2px margins
        '& .MuiDayCalendar-slideTransition': { minHeight: 6 * 36 }
      }}
    />
  )
}

export function DayField({
  label,
  value,
  onChange,
  onFocus,
  disabled = false
}: {
  label: string
  value: string
  onChange: (day: string) => void
  onFocus?: () => void
  disabled?: boolean
}): ReactElement {
  return (
    <DatePicker
      label={label}
      value={parse(value)}
      disabled={disabled}
      onChange={(next: Dayjs | null) => {
        onChange(next?.isValid() ? next.format(DAY) : '')
      }}
      slotProps={{
        textField: {
          size: 'small',
          fullWidth: true,
          ...(onFocus && { onFocus })
        },
        field: { clearable: true }
      }}
    />
  )
}

/** A day typed in, without a picker of its own; `focused` tells a calendar it is the one it fills. */
export function DayInput({
  label,
  value,
  onChange,
  onFocus,
  disabled = false
}: {
  label: string
  value: string
  onChange: (day: string) => void
  onFocus?: () => void
  disabled?: boolean
}): ReactElement {
  return (
    <DateField
      label={label}
      value={parse(value)}
      disabled={disabled}
      size="small"
      fullWidth
      {...(onFocus && { onFocus })}
      onChange={(next: Dayjs | null) => {
        if (next === null) onChange('')
        else if (next.isValid()) onChange(next.format(DAY))
      }}
    />
  )
}

/** A 24-hour HH:mm time typed in, empty for none, whatever the browser's own format. */
export function TimeInput({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string
  value: string
  onChange: (time: string) => void
  disabled?: boolean
}): ReactElement {
  return (
    <TimeField
      label={label}
      value={value ? dayjs(`2000-01-01T${value}`) : null}
      ampm={false}
      format="HH:mm"
      disabled={disabled}
      size="small"
      fullWidth
      onChange={(next: Dayjs | null) => {
        if (next === null) onChange('')
        else if (next.isValid()) onChange(next.format('HH:mm'))
      }}
    />
  )
}

/** Moments are local YYYY-MM-DDTHH:mm strings, empty for none. */
export function MomentField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (moment: string) => void
}): ReactElement {
  return (
    <DateTimePicker
      label={label}
      value={parse(value)}
      ampm={false}
      onChange={(next: Dayjs | null) => {
        onChange(next?.isValid() ? next.format(MINUTE) : '')
      }}
      slotProps={{ textField: { size: 'small', fullWidth: true } }}
    />
  )
}

export function EditorPopover({
  label,
  anchor,
  onClose,
  onSubmit,
  width = 320,
  title,
  closeLabel = '',
  children
}: {
  label: string
  anchor: HTMLElement | null
  onClose: () => void
  onSubmit: () => void
  width?: number
  /** A heading with a close button, like a small dialog's. */
  title?: string
  closeLabel?: string
  children: ReactNode
}): ReactElement {
  return (
    <Popover
      open={anchor !== null}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': label,
          sx: { width, maxWidth: 'calc(100vw - 32px)' }
        }
      }}
    >
      <Box
        component="form"
        onSubmit={event => {
          event.preventDefault()
          onSubmit()
        }}
        sx={{
          p: 1.5,
          display: 'grid',
          // One column as wide as the popover, whatever the fields' own widths
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 1,
          // twake-mui makes small fields 48px high, MUI's own 40px fit here
          '& .MuiInputBase-sizeSmall:not(.MuiInputBase-multiline) .MuiInputBase-input':
            { py: '8.5px' },
          '& .MuiInputLabel-sizeSmall:not(.MuiInputLabel-shrink)': {
            transform: 'translate(14px, 9px) scale(1)'
          },
          '& .MuiFormControlLabel-label': { typography: 'body2' }
        }}
      >
        {title && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <IconButton size="small" aria-label={closeLabel} onClick={onClose}>
              <Icon icon={Cross} size={16} />
            </IconButton>
          </Box>
        )}
        {children}
      </Box>
    </Popover>
  )
}

/** The form's buttons on the right, and an optional one apart on the left. */
export function EditorActions({
  start,
  children
}: {
  start?: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
      {start && <Box sx={{ mr: 'auto' }}>{start}</Box>}
      {children}
    </Box>
  )
}

/** Fields folded under a text button, open from the start when `open`. */
export function MoreFields({
  label,
  open,
  children
}: {
  label: string
  open: boolean
  children: ReactNode
}): ReactElement {
  const [shown, setShown] = useState(open)
  return (
    <>
      <Box>
        <Button
          variant="text"
          size="small"
          aria-expanded={shown}
          onClick={() => {
            setShown(was => !was)
          }}
        >
          {label}
        </Button>
      </Box>
      <Collapse in={shown} unmountOnExit>
        <Box sx={{ display: 'grid', gap: 1, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </>
  )
}

/** A day and its time on one line, the time just wide enough for HH:mm. */
export function TimeRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 104px',
        gap: 1
      }}
    >
      {children}
    </Box>
  )
}

export function FieldRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        '& > *': { flex: '1 1 0', minWidth: 0 }
      }}
    >
      {children}
    </Box>
  )
}
