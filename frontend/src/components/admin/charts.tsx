'use client';

import { useState } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface BarPoint {
  label: string;
  sent: number;
  failed: number;
}

export interface RateLimitPoint {
  minute: number;
  total: number;
  c429: number;
}

export function RateLimitChart({ data, ariaLabel }: { data: RateLimitPoint[]; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const height = 230;
  const left = 44;
  const right = 624;
  const top = 20;
  const bottom = 184;
  const max = Math.max(1, ...data.map((point) => point.total));
  const points = data.map((point, index) => ({
    ...point,
    x: data.length < 2 ? (left + right) / 2 : left + (index / (data.length - 1)) * (right - left),
    y: bottom - (point.total / max) * (bottom - top),
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const selected = active === null ? null : points[active];
  const labels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] w-full overflow-visible" role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return <line key={fraction} x1={left} x2={right} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 5" />;
        })}
        <path d={line} pathLength={1} className="admin-area-line" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g key={point.minute}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.c429 > 0 ? 5 : active === index ? 4 : 2}
              fill={point.c429 > 0 ? 'var(--color-destructive)' : 'var(--color-primary)'}
              tabIndex={0}
              aria-label={`${formatMinute(point.minute)}: ${point.total} Discord calls, ${point.c429} rate limits`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
        {labels.map((point) => (
          <text key={point.minute} x={point.x} y={212} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="10">
            {formatMinute(point.minute)}
          </text>
        ))}
      </svg>
      {selected && (
        <div role="tooltip" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
          <span className="text-muted-foreground">{formatMinute(selected.minute)}</span>
          <span className="ml-2 font-semibold">{selected.total.toLocaleString('en-US')} calls</span>
          {selected.c429 > 0 && <span className="ml-2 text-destructive">{selected.c429} × 429</span>}
        </div>
      )}
    </div>
  );
}

export function AreaChart({ data, ariaLabel }: { data: ChartPoint[]; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const height = 230;
  const left = 44;
  const right = 624;
  const top = 20;
  const bottom = 184;
  const max = Math.max(1, ...data.map((point) => point.value));
  const points = data.map((point, index) => ({
    ...point,
    x: data.length < 2 ? (left + right) / 2 : left + (index / (data.length - 1)) * (right - left),
    y: bottom - (point.value / max) * (bottom - top),
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const area = points.length ? `${line} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z` : '';
  const selected = active === null ? null : points[active];
  const labels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 5) === 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] w-full overflow-visible" role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return <line key={fraction} x1={left} x2={right} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 5" />;
        })}
        <path d={area} fill="var(--color-primary)" fillOpacity="0.12" />
        <path d={line} pathLength={1} className="admin-area-line" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle
            key={point.label}
            cx={point.x}
            cy={point.y}
            r={active === index ? 5 : 3}
            fill="var(--color-background)"
            stroke="var(--color-primary)"
            strokeWidth="2"
            tabIndex={0}
            aria-label={`${point.label}: ${point.value.toLocaleString('en-US')} servers`}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          />
        ))}
        {labels.map((point) => (
          <text key={point.label} x={point.x} y={212} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="10">
            {point.label}
          </text>
        ))}
      </svg>
      {selected && (
        <div role="tooltip" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
          <span className="text-muted-foreground">{selected.label}</span>
          <span className="ml-2 font-semibold">{selected.value.toLocaleString('en-US')} servers</span>
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, ariaLabel }: { data: BarPoint[]; ariaLabel: string }) {
  const [active, setActive] = useState<{ index: number; series: 'sent' | 'failed' } | null>(null);
  const width = 640;
  const height = 230;
  const left = 44;
  const right = 624;
  const top = 20;
  const bottom = 184;
  const max = Math.max(1, ...data.flatMap((point) => [point.sent, point.failed]));
  const group = (right - left) / Math.max(data.length, 1);
  const barWidth = Math.max(2, Math.min(9, group * 0.32));
  const selected = active ? data[active.index] : null;
  const labels = data.filter((_, index) => index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 5) === 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[230px] w-full overflow-visible" role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return <line key={fraction} x1={left} x2={right} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 5" />;
        })}
        {data.map((point, index) => {
          const center = left + (index + 0.5) * group;
          const sentHeight = (point.sent / max) * (bottom - top);
          const failedHeight = (point.failed / max) * (bottom - top);
          return (
            <g key={point.label}>
              <rect
                className="admin-bar-grow"
                x={center - barWidth - 1}
                y={bottom - sentHeight}
                width={barWidth}
                height={Math.max(0.5, sentHeight)}
                rx="2"
                fill="var(--color-success)"
                tabIndex={0}
                aria-label={`${point.label}: ${point.sent} messages sent`}
                onMouseEnter={() => setActive({ index, series: 'sent' })}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive({ index, series: 'sent' })}
                onBlur={() => setActive(null)}
              />
              <rect
                className="admin-bar-grow"
                x={center + 1}
                y={bottom - failedHeight}
                width={barWidth}
                height={Math.max(0.5, failedHeight)}
                rx="2"
                fill="var(--color-destructive)"
                tabIndex={0}
                aria-label={`${point.label}: ${point.failed} messages failed`}
                onMouseEnter={() => setActive({ index, series: 'failed' })}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive({ index, series: 'failed' })}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
        {labels.map((point, index) => {
          const originalIndex = data.indexOf(point);
          const x = left + (originalIndex + 0.5) * group;
          return <text key={`${point.label}-${index}`} x={x} y={212} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="10">{point.label}</text>;
        })}
      </svg>
      {active && selected && (
        <div role="tooltip" className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
          <span className="text-muted-foreground">{selected.label}</span>
          <span className={`ml-2 font-semibold ${active.series === 'sent' ? 'text-success' : 'text-destructive'}`}>
            {selected[active.series].toLocaleString('en-US')} {active.series}
          </span>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ data, ariaLabel }: { data: number[]; ariaLabel: string }) {
  const width = 120;
  const height = 36;
  const max = Math.max(1, ...data);
  const points = data.map((value, index) => {
    const x = data.length < 2 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - (value / max) * (height - 4) - 2;
    return `${index ? 'L' : 'M'}${x},${y}`;
  }).join(' ');
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" role="img" aria-label={ariaLabel}><path d={points} pathLength={1} className="admin-area-line" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" /></svg>;
}

function formatMinute(minute: number): string {
  return new Date(minute * 60_000).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' });
}
