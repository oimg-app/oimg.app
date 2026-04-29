interface SegProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}

export function Seg<T extends string>({ options, value, onChange }: SegProps<T>) {
  return (
    <div className="seg-sm">
      {options.map((o) => (
        <button key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
