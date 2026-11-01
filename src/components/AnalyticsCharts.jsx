import { useEffect, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '../lib/theme'

// SVG attributes cannot take var(), so chart colors are read from the design tokens at render time.
function readToken(styles, name) {
  return styles.getPropertyValue(name).trim() || 'currentColor'
}

function getChartColors() {
  const styles = getComputedStyle(document.documentElement)

  return {
    strong: readToken(styles, '--chart-success'),
    warning: readToken(styles, '--chart-warning'),
    weak: readToken(styles, '--chart-danger'),
    neutral: readToken(styles, '--text-faint'),
    info: readToken(styles, '--chart-info'),
    grid: readToken(styles, '--chart-grid'),
    axis: readToken(styles, '--text-secondary'),
    axisMuted: readToken(styles, '--muted'),
    label: readToken(styles, '--text'),
    cursor: readToken(styles, '--chart-cursor'),
    track: readToken(styles, '--surface-sunken'),
  }
}

function normalizePercent(value) {
  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return null
  }

  return Math.max(0, Math.min(100, parsedValue))
}

function getTone(value) {
  if (value === null) {
    return 'neutral'
  }

  if (value >= 80) {
    return 'strong'
  }

  if (value >= 60) {
    return 'warning'
  }

  return 'weak'
}

function formatChartValue(value) {
  return value === null ? 'No data' : `${Math.round(value)}%`
}

function truncateLabel(label, limit = 18) {
  const text = String(label ?? 'No label')

  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text
}

// Splits a long competency name into at most `maxLines` lines so the axis shows it instead of cutting it off.
function wrapLabel(label, lineLength, maxLines) {
  const words = String(label ?? 'No label').split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word
    if (next.length > lineLength && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  })
  if (current) lines.push(current)

  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = truncateLabel(`${kept[maxLines - 1]} ${lines[maxLines]}`, lineLength)
  return kept
}

function WrappedCategoryTick({ x, y, payload, fill, lineLength = 30 }) {
  const lines = wrapLabel(payload?.value, lineLength, 2)
  const lineHeight = 14
  const firstLineOffset = 4 - ((lines.length - 1) * lineHeight) / 2

  return (
    <text x={x} y={y} textAnchor="end" fill={fill} fontSize={12} fontWeight={700}>
      <title>{payload?.value}</title>
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? firstLineOffset : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function normalizeRows(data = [], chartColors) {
  return data.map((item, index) => {
    const value = normalizePercent(item.value)
    const tone = item.tone || getTone(value)

    return {
      id: item.id ?? `${item.label}-${index}`,
      label: item.label || 'No label',
      value: value ?? 0,
      displayValue: formatChartValue(value),
      tone,
      fill: item.fill || chartColors[tone] || chartColors.neutral,
    }
  })
}

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  const row = payload[0]?.payload

  return (
    <div className="analytics-chart-tooltip">
      <strong>{row?.label || label}</strong>
      <span>{row?.displayValue || formatChartValue(payload[0]?.value)}</span>
    </div>
  )
}

export function VerticalMasteryChart({ data, height = 280 }) {
  useTheme() // re-render, and so re-read the token colors, when the theme changes
  const colors = getChartColors()
  const rows = normalizeRows(data, colors)

  return (
    <div className="analytics-chart-shell" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 22, right: 14, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.axis, fontSize: 12, fontWeight: 800 }}
            tickFormatter={(label) => truncateLabel(label)}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.axisMuted, fontSize: 12, fontWeight: 700 }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
            width={42}
          />
          <Tooltip cursor={{ fill: colors.cursor }} content={<AnalyticsTooltip />} />
          <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={84}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <LabelList
              dataKey="displayValue"
              position="top"
              fill={colors.label}
              fontSize={12}
              fontWeight={900}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

// Height follows the row count (a fixed height spreads two bars far apart), unless a caller sets one.
export function HorizontalMasteryChart({ data, height }) {
  useTheme() // re-render, and so re-read the token colors, when the theme changes
  const [shellRef, shellWidth] = useElementWidth()
  const colors = getChartColors()
  const rows = normalizeRows(data, colors)
  const chartHeight = height ?? rows.length * 44 + 24
  // On a phone a fixed 230px label column would leave no room for the bars.
  const labelWidth = shellWidth && shellWidth < 600 ? Math.max(110, Math.round(shellWidth * 0.4)) : 230
  const labelLineLength = Math.max(14, Math.floor(labelWidth / 7.5))

  return (
    <div ref={shellRef} className="analytics-chart-shell is-horizontal" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 52, left: 8, bottom: 4 }}
          barCategoryGap={12}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            dataKey="label"
            type="category"
            axisLine={false}
            tickLine={false}
            tick={(tickProps) => (
              <WrappedCategoryTick {...tickProps} fill={colors.label} lineLength={labelLineLength} />
            )}
            width={labelWidth}
            interval={0}
          />
          <Tooltip cursor={{ fill: colors.cursor }} content={<AnalyticsTooltip />} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14} background={{ fill: colors.track, radius: 6 }}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <LabelList
              dataKey="displayValue"
              position="right"
              fill={colors.label}
              fontSize={12}
              fontWeight={900}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
