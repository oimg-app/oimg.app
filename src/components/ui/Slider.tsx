import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type SliderProps = Omit<
  React.ComponentProps<typeof SliderPrimitive.Root>,
  "value" | "defaultValue" | "onValueChange"
> & {
  value?: number | number[]
  defaultValue?: number | number[]
  onChange?: (value: number) => void
  label?: string
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onChange,
  label: _label,
  ...props
}: SliderProps) {
  const toArray = (v: number | number[] | undefined): number[] | undefined =>
    v === undefined ? undefined : Array.isArray(v) ? v : [v]

  const valueArr = toArray(value)
  const defaultValueArr = toArray(defaultValue)

  const _values = React.useMemo(
    () => valueArr ?? defaultValueArr ?? [min],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(valueArr), JSON.stringify(defaultValueArr), min]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValueArr}
      value={valueArr}
      min={min}
      max={max}
      onValueChange={onChange ? (vals) => onChange(vals[0]) : undefined}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-none bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="relative block size-3 shrink-0 rounded-none border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-1 focus-visible:ring-1 focus-visible:outline-hidden active:ring-1 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
