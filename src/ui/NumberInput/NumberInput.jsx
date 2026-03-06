import './NumberInput.css'

/**
 * Labeled number input used throughout config panels.
 *
 * Props:
 *   label     string   Display label
 *   value     number
 *   onChange  fn(number)
 *   min       number   (optional)
 *   max       number   (optional)
 *   step      number   default 1
 *   suffix    string   e.g. 'px' displayed after the input
 */
export function NumberInput({ label, value, onChange, min, max, step = 1, suffix }) {
  return (
    <label className="num-input">
      <span className="num-input__label">{label}</span>
      <div className="num-input__row">
        <input
          type="number"
          className="num-input__field"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(v)
          }}
        />
        {suffix && <span className="num-input__suffix">{suffix}</span>}
      </div>
    </label>
  )
}
