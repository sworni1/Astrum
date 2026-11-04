"use client";

import { format, isValid, parse, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Calendar } from "../../../components/ui/calendar";
import { FormControl } from "../../../components/ui/form";
import { Input } from "../../../components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";

const DATE_FORMAT = "dd.MM.yyyy";
const OLDEST_BIRTH_YEAR = 1900;
const DEFAULT_AGE_YEARS = 18;

type DateOfBirthFieldProps = {
  name: string;
  value?: Date;
  onChange: (date?: Date) => void;
  onBlur: () => void;
};

function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);

  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter((part) => part.length > 0)
    .join(".");
}

function parseDateInput(text: string): Date | undefined {
  if (text.length !== DATE_FORMAT.length) return undefined;

  const parsed = parse(text, DATE_FORMAT, new Date());

  if (!isValid(parsed)) return undefined;

  return format(parsed, DATE_FORMAT) === text ? parsed : undefined;
}

export function DateOfBirthField({
  name,
  value,
  onChange,
  onBlur,
}: DateOfBirthFieldProps) {
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
            placeholder="DD.MM.YYYY"
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
            aria-label="Open the calendar"
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
