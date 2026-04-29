interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <div
      role="switch"
      aria-checked={value}
      tabIndex={0}
      className={'toggle' + (value ? ' on' : '')}
      onClick={() => onChange(!value)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!value);
        }
      }}
    />
  );
}
