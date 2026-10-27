import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export function Button({
  children,
  onClick,
  variant = 'default',
  disabled,
  title,
  type = 'button',
  full,
  className,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  full?: boolean;
  className?: string;
  testId?: string;
}) {
  const classes: Record<string, string> = {
    default: 'vf-button hover:bg-steel',
    primary: 'vf-button vf-button-primary hover:brightness-110',
    danger: 'vf-button border-alert/60 text-alert hover:bg-alert/10',
    ghost: 'vf-button border-transparent bg-transparent hover:bg-steel/60',
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`${classes[variant]} ${full ? 'w-full justify-center' : ''} ${className ?? ''} ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ember' | 'mint' | 'alert' | 'sky';
}) {
  const tones: Record<string, string> = {
    neutral: '',
    ember: 'border-ember/50 text-ember',
    mint: 'border-mint/50 text-mint',
    alert: 'border-alert/50 text-alert',
    sky: 'border-sky/50 text-sky',
  };
  return <span className={`vf-chip ${tones[tone]}`}>{children}</span>;
}

export function Panel({
  title,
  children,
  actions,
  className,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col ${className ?? ''}`}>
      <header className="flex items-center justify-between border-b border-steel px-3 py-1.5">
        <h2 className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          {title}
        </h2>
        <div className="flex items-center gap-1">{actions}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; badge?: number }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-0.5 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex cursor-pointer items-center gap-1 rounded-t border-b-2 px-2.5 py-1.5 text-xs transition-colors ${
            active === tab.id
              ? 'border-ember text-slate-100'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 ? (
            <span className="rounded-full bg-ember px-1.5 text-[10px] font-bold text-anvil">
              {tab.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-2xl',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-anvil/70 p-6 pt-16 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div ref={ref} className={`w-full ${width} vf-panel flex max-h-[80vh] flex-col shadow-2xl`}>
        <header className="flex items-center justify-between border-b border-steel px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} title="Stäng">
            ✕
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">{children}</div>
        {footer ? (
          <footer className="flex justify-end gap-2 border-t border-steel px-4 py-2.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--color-ember)]"
      />
      {label}
    </label>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="text-sm text-slate-400">{title}</p>
      {hint ? <p className="max-w-md text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
