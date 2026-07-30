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

const chartColors = {
  strong: '#22c55e',
  warning: '#f59e0b',
  weak: '#ef4444',
  neutral: '#94a3b8',
  info: '#2563eb',
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

function normalizeRows(data = []) {
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
  const rows = normalizeRows(data)

  return (
    <div className="analytics-chart-shell" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 22, right: 14, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#334155', fontSize: 12, fontWeight: 800 }}
            tickFormatter={(label) => truncateLabel(label)}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
            width={42}
          />
          <Tooltip cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} content={<AnalyticsTooltip />} />
          <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={84}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <LabelList
              dataKey="displayValue"
              position="top"
              fill="#0f172a"
              fontSize={12}
              fontWeight={900}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function HorizontalMasteryChart({ data, height = 220 }) {
  const rows = normalizeRows(data)

  return (
    <div className="analytics-chart-shell" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
          barCategoryGap={14}
        >
          <CartesianGrid stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            dataKey="label"
            type="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 850 }}
            tickFormatter={(label) => truncateLabel(label, 24)}
            width={150}
          />
          <Tooltip cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} content={<AnalyticsTooltip />} />
          <Bar dataKey="value" radius={[0, 7, 7, 0]} barSize={12}>
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <LabelList
              dataKey="displayValue"
              position="right"
              fill="#0f172a"
              fontSize={12}
              fontWeight={900}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
