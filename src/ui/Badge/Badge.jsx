import './Badge.css'

/**
 * Small count or label badge.
 *
 * Props:
 *   count    number | string
 *   variant  'accent' | 'danger' | 'success' | 'neutral'
 */
export function Badge({ count, variant = 'accent', className = '' }) {
  if (count === null || count === undefined) return null
  return (
    <span className={`badge badge--${variant}${className ? ` ${className}` : ''}`}>
      {count}
    </span>
  )
}
