"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectFieldOption = { value: string; label: string; disabled?: boolean };

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  required = false,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} required={required} disabled={disabled}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
