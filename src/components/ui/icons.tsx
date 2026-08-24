export function Coin({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="currentColor" opacity="0.18" />
      <circle cx="10" cy="10" r="6.2" fill="currentColor" />
      <path
        d="M7.4 10.2c1.2-.9 2.2.6 3.4-.3.9-.7.6-1.9-.5-2.1-1.6-.3-3 .8-3.4 2.1-.5 1.6.7 3 2.4 3 1.2 0 2-.5 2.5-1.2"
        fill="none"
        stroke="var(--panel)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Flame({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        d="M8 1.5s.6 2-1 3.6C5.2 6.9 4 8.2 4 10a4 4 0 1 0 8 0c0-1.4-.6-2.3-1.3-3.1-.3 1-1 1.4-1 1.4s.6-2.2-1.7-6.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Plus({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function Check({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function Trash({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8M6.8 7v4M9.2 7v4" />
    </svg>
  );
}

export function Cart({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 2.2h1.7l1.7 7.4h6.6l1.5-5.3H4.2" />
      <circle cx="6.2" cy="12.6" r="1.1" />
      <circle cx="11.4" cy="12.6" r="1.1" />
    </svg>
  );
}

export function Close({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
