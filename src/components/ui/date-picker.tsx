
"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from 'date-fns/locale'; // Import Spanish locale
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTranslation } from "@/context/I18nContext";

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
}

export function DatePicker({ date, setDate, disabled, placeholder }: DatePickerProps) {
  const { language, t } = useTranslation();
  const currentLocale = language === 'es' ? es : undefined;
  const dateFormat = language === 'es' ? "PPP" : "PPP"; // Example: "LLL dd, y" or "dd MMM, y"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, dateFormat, { locale: currentLocale }) : <span>{placeholder || t('datePicker.pickDate', {defaultValue: "Pick a date"})}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
          disabled={disabled}
          locale={currentLocale}
        />
      </PopoverContent>
    </Popover>
  )
}
