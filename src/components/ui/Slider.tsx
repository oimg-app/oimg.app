interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}

export function Slider({ label, value, min = 0, max = 100, step = 1, suffix = '', onChange }: SliderProps) {
  return (
    <div className="row" style={{ gridTemplateColumns: '90px 1fr' }}>
      <label>{label}</label>
      <div className="slider-block">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
        />
        <span className="v">{value}{suffix}</span>
      </div>
    </div>
  );
}
