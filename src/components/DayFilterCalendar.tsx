import { useState } from "react";
import { buildMonthGrid, monthLabel } from "../lib/calendar";

interface DayFilterCalendarProps {
  availableDates: string[];
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  onSelectDates: (dates: string[]) => void;
}

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function parseYearMonth(date: string): { year: number; month: number } {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

export function DayFilterCalendar({
  availableDates,
  selectedDates,
  onToggleDate,
  onSelectDates,
}: DayFilterCalendarProps) {
  const mostRecent = availableDates[0] ?? null;
  const [cursor, setCursor] = useState(() =>
    parseYearMonth(mostRecent ?? new Date().toISOString().slice(0, 10)),
  );

  const availableSet = new Set(availableDates);
  const cells = buildMonthGrid(cursor.year, cursor.month);
  const last7 = availableDates.slice(0, 7);

  function goToPreviousMonth() {
    setCursor((c) =>
      c.month === 1
        ? { year: c.year - 1, month: 12 }
        : { year: c.year, month: c.month - 1 },
    );
  }

  function goToNextMonth() {
    setCursor((c) =>
      c.month === 12
        ? { year: c.year + 1, month: 1 }
        : { year: c.year, month: c.month + 1 },
    );
  }

  return (
    <div className="day-filter">
      <div className="day-filter__presets">
        <button
          type="button"
          onClick={() => onSelectDates(mostRecent ? [mostRecent] : [])}
        >
          Meest recent
        </button>
        <button type="button" onClick={() => onSelectDates(last7)}>
          Laatste 7 dagen
        </button>
        <button type="button" onClick={() => onSelectDates(availableDates)}>
          Alles
        </button>
      </div>
      <div className="day-filter__calendar">
        <div className="day-filter__calendar-header">
          <button
            type="button"
            onClick={goToPreviousMonth}
            aria-label="Vorige maand"
          >
            ‹
          </button>
          <span>{monthLabel(cursor.year, cursor.month)}</span>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="Volgende maand"
          >
            ›
          </button>
        </div>
        <div className="day-filter__weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="day-filter__grid">
          {cells.map((cell) => {
            const hasLogs = availableSet.has(cell.date);
            const isSelected = selectedDates.includes(cell.date);
            return (
              <button
                type="button"
                key={cell.date}
                disabled={!hasLogs}
                aria-pressed={isSelected}
                className={
                  "day-filter__day" +
                  (!cell.inCurrentMonth ? " day-filter__day--outside" : "") +
                  (hasLogs ? " day-filter__day--has-logs" : "") +
                  (isSelected ? " day-filter__day--selected" : "")
                }
                onClick={() => onToggleDate(cell.date)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
