"use client";

import { format, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DATE_FORMAT,
  DEFAULT_AGE_YEARS,
  maskDateInput,
  OLDEST_BIRTH_YEAR,
  parseDateInput,
} from "./lib/dateInput";

type DateOfBirthFieldProps = {
  name: string;
  value?: Date;
  onChange: (date?: Date) => void;
  onBlur: () => void;
};

export function DateOfBirthField({
  name,
  value,
  onChange,
  onBlur,
}: DateOfBirthFieldProps) {
  const t = useTranslations("auth");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() =>
    value ? format(value, DATE_FORMAT) : "",
  );

  const latestBirthDate = new Date();
  const earliestBirthDate = new Date(OLDEST_BIRTH_YEAR, 0, 1);
  const initialMonth = subYears(latestBirthDate, DEFAULT_AGE_YEARS);

  const pickDate = (date: Date | undefined) => {
    setOpen(false);

    if (!date) return;

    onChange(date);
    setText(format(date, DATE_FORMAT));
  };

  const changeText = (raw: string) => {
    const next = maskDateInput(raw);
    setText(next);

    const parsed = parseDateInput(next);

    if (parsed) {
      onChange(parsed);
      return;
    }

    if (!next) onChange(undefined);
  };

  const commitText = () => {
    const parsed = parseDateInput(text);

    if (parsed) {
      onChange(parsed);
      setText(format(parsed, DATE_FORMAT));
    } else {
      onChange(undefined);
    }

    onBlur();
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <FormControl>
          <Input
            name={name}
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onBlur={commitText}
            placeholder={t("dateOfBirthPlaceholder")}
            inputMode="numeric"
            autoComplete="bday"
            className="pr-9"
          />
        </FormControl>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("calendarOpen")}
            className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            style={{ width: "calc(7 * var(--cell-size) + 1rem)" }}
            selected={value}
            onSelect={pickDate}
            defaultMonth={value ?? initialMonth}
            startMonth={earliestBirthDate}
            endMonth={latestBirthDate}
            captionLayout="dropdown"
            navLayout="after"
            disabled={(date) =>
              date > latestBirthDate || date < earliestBirthDate
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
