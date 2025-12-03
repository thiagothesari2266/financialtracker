import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * DatePicker padrão baseado no Calendar do shadcn.
 * Usa Popover + Button para exibir o calendário inline.
 */
export function DatePicker({
  date,
  onSelect,
  placeholder = "Selecione uma data",
  disabled = false,
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Button
            variant="outline"
            type="button"
            className={cn(
              "w-full justify-start text-left font-normal pr-9",
              !date && "text-muted-foreground",
              className,
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy") : placeholder}
          </Button>
          {date && !disabled && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(undefined);
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Limpar data</span>
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
