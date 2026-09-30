import { cn } from '@/lib/utils'

const inputClassName = cn(
  'flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
)

function DateTimePicker({
  className,
  disabled = false,
  id,
  minDateTime = '',
  onChange,
  value,
}) {
  const datePart = value ? value.slice(0, 10) : ''
  const timePart = value ? value.slice(11, 16) : ''
  const minDatePart = minDateTime ? minDateTime.slice(0, 10) : ''
  const minTimePart = minDateTime ? minDateTime.slice(11, 16) : ''
  const timeMin = datePart && minDatePart && datePart === minDatePart ? minTimePart : undefined

  const handleDateChange = (event) => {
    const nextDate = event.target.value
    onChange(nextDate ? `${nextDate}T${timePart || '00:00'}` : '')
  }

  const handleTimeChange = (event) => {
    if (!datePart) return
    onChange(`${datePart}T${event.target.value || '00:00'}`)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        id={id}
        type="date"
        value={datePart}
        min={minDatePart || undefined}
        disabled={disabled}
        onChange={handleDateChange}
        className={cn(inputClassName, 'flex-1')}
      />
      <input
        type="time"
        value={timePart}
        min={timeMin}
        disabled={disabled || !datePart}
        onChange={handleTimeChange}
        className={cn(inputClassName, 'w-32 shrink-0')}
      />
    </div>
  )
}

export { DateTimePicker }
