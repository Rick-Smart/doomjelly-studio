import './Card.css'

/**
 * Surface container with border, background, and optional hover state.
 * Pass onClick to make the card interactive (keyboard + hover).
 *
 * Props:
 *   children   ReactNode
 *   onClick    fn         Makes card clickable/interactive when provided
 *   variant    'default' | 'raised' | 'outlined'
 *   padding    bool       default true
 *   className  string
 */
export function Card({ children, onClick, variant = 'default', padding = true, className = '' }) {
  const interactive = !!onClick
  return (
    <div
      className={[
        'card',
        `card--${variant}`,
        interactive ? 'card--interactive' : '',
        padding     ? 'card--pad'         : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? e => (e.key === 'Enter' || e.key === ' ') && onClick(e) : undefined}
    >
      {children}
    </div>
  )
}
