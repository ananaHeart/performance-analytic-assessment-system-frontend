import { cn } from '@/lib/utils'

const inputClassName = cn(
  'flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
)

function DateTimePicker({
  className,
  disabled = false,
  id,
  maxDateTime = '',
  maxTime = '',
  minDateTime = '',
  minTime = '',
  onChange,
  value,
}) {
  const datePart = value ? value.slice(0, 10) : ''
  const timePart = value ? value.slice(11, 16) : ''
  const minDatePart = minDateTime ? minDateTime.slice(0, 10) : ''
  const maxDatePart = maxDateTime ? maxDateTime.slice(0, 10) : ''
  const minTimePart = minDateTime ? minDateTime.slice(11, 16) : ''
  const maxTimePart = maxDateTime ? maxDateTime.slice(11, 16) : ''
  const dateSpecificMin = datePart && minDatePart && datePart === minDatePart ? minTimePart : ''
  const dateSpecificMax = datePart && maxDatePart && datePart === maxDatePart ? maxTimePart : ''
  const effectiveTimeMin = [minTime, dateSpecificMin].filter(Boolean).sort().at(-1)
  const effectiveTimeMax = [maxTime, dateSpecificMax].filter(Boolean).sort().at(0)

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
        max={maxDatePart || undefined}
        disabled={disabled}
        onChange={handleDateChange}
        className={cn(inputClassName, 'flex-1')}
      />
      <input
        type="time"
        value={timePart}
        min={effectiveTimeMin || undefined}
        max={effectiveTimeMax || undefined}
        disabled={disabled || !datePart}
        onChange={handleTimeChange}
        className={cn(inputClassName, 'w-32 shrink-0')}
      />
    </div>
  )
}

export { DateTimePicker }
