import { gradientFor } from '@/lib/image-styles';
import type { ImageStyleId } from '@/lib/types';

/** A CSS drawing of the welcome card, used on the landing page. The dashboard shows the real server-rendered PNG. */
export function CardMock({ style = 'midnight', title = 'Welcome', name = 'New member', subtitle = 'A new member has joined', accent = 'var(--color-primary)', members = 'Welcome message' }: { style?: ImageStyleId; title?: string; name?: string; subtitle?: string; accent?: string; members?: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-[2.5cqw] border border-white/10 shadow-2xl" style={{ aspectRatio: '1100 / 400', containerType: 'inline-size', background: gradientFor(style) }}>
      <div className="absolute -left-[8cqw] top-[2cqw] size-[40cqw] rounded-full opacity-35 blur-3xl" style={{ background: accent }} />
      <div className="absolute left-[9.5cqw] top-1/2 grid size-[21cqw] -translate-y-1/2 place-items-center rounded-full bg-[#0b0c1a] shadow-[0_0_4cqw_var(--ring)]" style={{ ['--ring' as string]: `${accent}aa`, border: `0.7cqw solid ${accent}` }}>
        <div className="grid size-full place-items-center rounded-full text-[9cqw] font-extrabold text-white" style={{ background: `radial-gradient(circle at 30% 25%, ${accent}, var(--color-card))` }}>
          {name[0]}
        </div>
      </div>
      <div className="absolute left-[34.5cqw] right-[5cqw] top-1/2 -translate-y-1/2">
        <div className="text-[2.5cqw] font-bold uppercase tracking-[0.35cqw]" style={{ color: accent }}>
          {title}
        </div>
        <div className="mt-[0.8cqw] truncate text-[6.4cqw] font-extrabold leading-none text-white">{name}</div>
        <div className="mt-[1.4cqw] truncate text-[2.7cqw] text-white/75">{subtitle}</div>
        <div className="mt-[2cqw] inline-block rounded-full px-[2cqw] py-[0.8cqw] text-[2.2cqw] font-bold" style={{ color: accent, background: `${accent}29`, border: `0.2cqw solid ${accent}8c` }}>
          {members}
        </div>
      </div>
    </div>
  );
}
