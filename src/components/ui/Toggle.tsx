import type {ReactNode} from 'react';
import blocks from '@/components/layout/Blocks.module.css';

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
};

/** A checkbox with a title and one line of explanation: every "share this?" choice. */
export function Toggle({checked, onChange, title, hint, disabled}: ToggleProps) {
  return (
    <label className={blocks.toggle}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className={blocks.toggleText}>
        <span className={blocks.toggleTitle}>{title}</span>
        {hint && <span className={blocks.toggleHint}>{hint}</span>}
      </span>
    </label>
  );
}
