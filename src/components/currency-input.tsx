import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type CurrencyInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
};

function formatCurrencyValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyValue(raw: string): number | null {
  const clean = raw.replace(/[^0-9,.-]/g, "").trim();
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function CurrencyInput({ value, onValueChange, onBlur, ...props }: CurrencyInputProps) {
  const [text, setText] = useState(() => formatCurrencyValue(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(formatCurrencyValue(value));
  }, [editing, value]);

  return (
    <Input
      {...props}
      inputMode="decimal"
      placeholder={props.placeholder ?? "0,00"}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        onValueChange(parseCurrencyValue(next));
      }}
      onBlur={(event) => {
        setEditing(false);
        setText(formatCurrencyValue(parseCurrencyValue(text)));
        onBlur?.(event);
      }}
    />
  );
}
