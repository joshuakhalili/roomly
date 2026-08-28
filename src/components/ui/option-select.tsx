"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A dropdown that shows its selected value before you open it.
 *
 * Radix works out the trigger's label by reading the selected item's text —
 * but the item list lives inside the popover, which is unmounted while the
 * menu is closed. So a select that starts with a value chosen renders an
 * empty box until the first time someone clicks it, after which the label
 * appears and stays. Every form in this app preselects something, so every
 * dropdown looked broken on first paint.
 *
 * The fix is to hand Radix the label directly instead of letting it derive
 * one: the options are passed as data, so their text is known without
 * anything having to be mounted. Passing options in rather than as children
 * is what makes that possible, and it makes the call sites shorter too.
 *
 * Uncontrolled by default with `defaultValue`; pass `value` and
 * `onValueChange` together to control it.
 */
export function OptionSelect({
  name,
  options,
  defaultValue,
  value: controlledValue,
  onValueChange,
  placeholder,
  disabled,
  required,
  id,
  className,
}: {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolled;
  const selected = options.find((o) => o.value === value);

  return (
    <Select
      name={name}
      value={value}
      onValueChange={(next) => {
        if (controlledValue === undefined) setUncontrolled(next);
        onValueChange?.(next);
      }}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder}>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
