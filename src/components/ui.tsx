import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export type Tone = 'ok' | 'warn' | 'error' | 'muted' | 'accent' | 'info';

export function StatusDot({ tone = 'muted', pulse = false }: { tone?: Tone; pulse?: boolean }): React.ReactElement {
  return <span className={`status-dot status-dot--${tone}${pulse ? ' status-dot--pulse' : ''}`} aria-hidden="true" />;
}

export function Badge({ tone = 'muted', children, title }: { tone?: Tone; children: React.ReactNode; title?: string }): React.ReactElement {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active = false,
  disabled = false,
  className = '',
  title,
}: {
  label: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={`icon-button${active ? ' is-active' : ''} ${className}`}
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'sm',
  disabled = false,
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}): React.ReactElement {
  return (
    <button
      type={type}
      className={`button button--${variant} button--${size}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function SectionHeader({
  title,
  count,
  actions,
}: {
  title: string;
  count?: number;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="section-header">
      <span className="section-header__title">
        {title}
        {typeof count === 'number' ? <span className="section-header__count">{count}</span> : null}
      </span>
      {actions ? <div className="section-header__actions">{actions}</div> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Filter…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}): React.ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className="search-input">
      <Search size={13} aria-hidden="true" />
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('');
            ref.current?.blur();
          }
        }}
      />
      {value ? (
        <button type="button" aria-label="Clear filter" onClick={() => onChange('')}>
          <X size={12} />
        </button>
      ) : null}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}): React.ReactElement {
  return (
    <div className={`empty-state${compact ? ' empty-state--compact' : ''}`}>
      <div className="empty-state__icon">{icon}</div>
      <h3>{title}</h3>
      {description ? <div className="empty-state__description">{description}</div> : null}
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}

export function Modal({
  title,
  children,
  footer,
  onClose,
  width = 520,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  width?: number;
}): React.ReactElement {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }}>
        <div className="modal__header">
          <h2>{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }): React.ReactElement {
  return (
    <span className="spinner" role="status" aria-label={label}>
      <span className="spinner__ring" />
    </span>
  );
}

export function KeyHint({ keys }: { keys: string[] }): React.ReactElement {
  return (
    <span className="key-hint">
      {keys.map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}

export function InlineError({ message }: { message: string }): React.ReactElement {
  return <div className="inline-error">{message}</div>;
}

export function InlineNote({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'error' }): React.ReactElement {
  return <div className={`inline-note inline-note--${tone}`}>{children}</div>;
}
