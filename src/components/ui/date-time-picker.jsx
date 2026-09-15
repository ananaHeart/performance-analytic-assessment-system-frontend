import { useState } from 'react'
import DatePicker from 'react-datepicker'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import 'react-datepicker/dist/react-datepicker.css'
import '@/styles/date-time-picker.css'

function parseLocalDateTime(value) {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )

  return Number.isNaN(date.getTime()) ? null : date
}

function formatLocalDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  const pad = (value) => String(value).padStart(2, '0')

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

function formatDateTimeLabel(date) {
  if (!date) return ''

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return `${dateLabel} ${timeLabel}`
}

function isSameLocalDay(left, right) {
  return left?.getFullYear() === right?.getFullYear()
    && left?.getMonth() === right?.getMonth()
    && left?.getDate() === right?.getDate()
}

function DateTimePicker({
  className,
  disabled = false,
  id,
  minDateTime = '',
  onChange,
  placeholder = 'Select date and time',
  value,
}) {
  const [open, setOpen] = useState(false)
  const selectedDate = parseLocalDateTime(value)
  const minimumDate = parseLocalDateTime(minDateTime)

  const allowsTime = (time) => {
    if (!minimumDate || !selectedDate || !isSameLocalDay(selectedDate, minimumDate)) {
      return true
    }

    const selectedMinutes = time.getHours() * 60 + time.getMinutes()
    const minimumMinutes = minimumDate.getHours() * 60 + minimumDate.getMinutes()
    return selectedMinutes > minimumMinutes
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
            selectedDate ? 'text-foreground' : 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selectedDate ? formatDateTimeLabel(selectedDate) : placeholder}
          </span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="smart-date-time-popover w-auto overflow-hidden p-0"
      >
        <DatePicker
          inline
          selected={selectedDate}
          minDate={minimumDate}
          onChange={(date) => onChange(formatLocalDateTime(date))}
          filterTime={allowsTime}
          showTimeSelect
          timeIntervals={5}
          timeCaption="Time"
          timeFormat="h:mm aa"
          calendarStartDay={0}
          formatWeekDay={(weekday) => weekday.slice(0, 2)}
          calendarClassName="smart-date-time-calendar"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border bg-background p-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!selectedDate}
            onClick={() => onChange('')}
          >
            Clear
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DateTimePicker }
