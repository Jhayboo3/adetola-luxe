"use client";

interface QuantitySelectorProps {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  onMaxError?: (message: string) => void;
  label?: string;
}

export default function QuantitySelector({ value, min = 1, max, onChange, onMaxError, label = "Quantity" }: QuantitySelectorProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const setValue = (n: number) => {
    const capped = clamp(n);
    if (n > max && onMaxError) onMaxError(`Only ${max} ${max === 1 ? "item" : "items"} available in stock.`);
    onChange(capped);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="font-body text-[11px] font-medium uppercase tracking-[2px]">{label}</span>
      <div className="flex items-center border border-line">
        <button
          type="button"
          onClick={() => setValue(value - 1)}
          disabled={value <= min}
          aria-label="Decrease quantity"
          className="flex h-11 w-11 items-center justify-center font-body text-[18px] transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (Number.isNaN(raw)) return;
            setValue(Number.isInteger(raw) ? raw : Math.floor(raw));
          }}
          className="h-11 w-14 border-x border-line bg-transparent text-center font-body text-[14px] font-medium outline-none focus:bg-black/5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => setValue(value + 1)}
          disabled={value >= max}
          aria-label="Increase quantity"
          className="flex h-11 w-11 items-center justify-center font-body text-[18px] transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
      {max > 0 && max <= 10 && (
        <span className="font-body text-[11px] text-muted">{max} in stock</span>
      )}
    </div>
  );
}
