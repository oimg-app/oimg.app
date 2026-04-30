import { useId } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}

// Hand-rolled slider — Phase 1 deviation D-06 (see deferred-items.md).
// Native input[type=range] has implicit role="slider"; we set explicit
// aria-value* so screen readers announce the current value reliably even
// when the input is wrapped inside a styled container. aria-valuetext gives
// a friendly readout including any unit suffix (e.g. "82%").
export function Slider({ label, value, min = 0, max = 100, step = 1, suffix = '', onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="row" style={{ gridTemplateColumns: '90px 1fr' }}>
      <label htmlFor={id}>{label}</label>
      <div className="slider-block">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={String(value) + (suffix || '')}
          onChange={(e) => onChange(+e.target.value)}
        />
        <span className="v">{value}{suffix}</span>
      </div>
    </div>
  );
}
