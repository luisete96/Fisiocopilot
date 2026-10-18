import { type ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'primary' | 'accent';
  pulse?: boolean;
}

export function Badge({ children, variant = 'default', pulse = false }: BadgeProps) {
  const styles = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-success-50 text-success-700 border-success-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    error: 'bg-error-50 text-error-700 border-error-200',
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    accent: 'bg-accent-50 text-accent-700 border-accent-200',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${styles} ${
        pulse ? 'animate-pulse-soft' : ''
      }`}
    >
      {children}
    </span>
  );
}
