import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type PercentageInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
};

function formatPercentage(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function parsePercentage(raw: string) {
  const normalized = raw.replace(".", ",").replace(/[^0-9,]/g, "");
  if (!normalized || normalized === ",") return null;
  const value = Number(normalized.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatWhileTyping(raw: string) {
  const normalized = raw.replace(".", ",").replace(/[^0-9,]/g, "");
  const [whole = "", ...decimal] = normalized.split(",");
  if (!decimal.length) return whole;
  return `${whole},${decimal.join("").slice(0, 2)}`;
}

export function PercentageInput({ value, onValueChange, onBlur, ...props }: PercentageInputProps) {
  const [text, setText] = useState(() => formatPercentage(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(formatPercentage(value));
  }, [editing, value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      placeholder={props.placeholder ?? "0"}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(event) => {
        const next = formatWhileTyping(event.target.value);
        setText(next);
        onValueChange(parsePercentage(next));
      }}
      onBlur={(event) => {
        setEditing(false);
        setText(formatPercentage(parsePercentage(text)));
        onBlur?.(event);
      }}
    />
  );
}
