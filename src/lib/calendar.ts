export interface CalendarDay {
  date: string;
  day: number;
  inCurrentMonth: boolean;
}

const MONTH_NAMES = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Builds a full-week grid (always a multiple of 7 cells, Monday-first) for
 * the given month, padding with adjacent-month days so every row is complete.
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells: CalendarDay[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({
      date: toISODate(new Date(year, month - 2, day)),
      day,
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: toISODate(new Date(year, month - 1, day)),
      day,
      inCurrentMonth: true,
    });
  }

  let trailingDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      date: toISODate(new Date(year, month, trailingDay)),
      day: trailingDay,
      inCurrentMonth: false,
    });
    trailingDay += 1;
  }

  return cells;
}
