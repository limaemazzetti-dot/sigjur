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
  const dotParts = clean.split(".");
  const isBrazilianThousands =
    !clean.includes(",") &&
    dotParts.length > 1 &&
    dotParts.slice(1).every((part) => part.length === 3);
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : isBrazilianThousands
      ? clean.replace(/\./g, "")
      : clean;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatCurrencyWhileTyping(raw: string) {
  const clean = raw.replace(/[^0-9,.-]/g, "");
  if (!clean) return "";

  const hasDecimalSeparator = clean.includes(",");
  const [integerPart = "", ...decimalParts] = clean.replace(/\./g, "").split(",");
  const integerDigits = integerPart.replace(/\D/g, "") || "0";
  const formattedInteger = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (!hasDecimalSeparator) return formattedInteger;
  return `${formattedInteger},${decimalParts.join("").replace(/\D/g, "").slice(0, 2)}`;
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
        const next = formatCurrencyWhileTyping(event.target.value);
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
