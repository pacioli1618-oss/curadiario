import blocks from '@/components/layout/Blocks.module.css';

/** One number of a month: "12 dias", "86h30", "R$ 1.800". */
export function Stat({value, label}: {value: string; label: string}) {
  return (
    <div className={blocks.stat}>
      <span className={blocks.statValue}>{value}</span>
      <span className={blocks.statLabel}>{label}</span>
    </div>
  );
}
