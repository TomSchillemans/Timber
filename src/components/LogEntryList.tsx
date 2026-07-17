import { useState } from "react";
import { LogEntryDetail } from "./LogEntryDetail";

export interface LogEntry {
  timestamp: string | null;
  level: string | null;
  message: string;
  extraFields: Record<string, unknown>;
}

interface LogEntryListProps {
  entries: LogEntry[];
}

export function LogEntryList({ entries }: LogEntryListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (entries.length === 0) {
    return <p className="log-entry-list__empty">Geen logregels gevonden.</p>;
  }

  return (
    <ul className="log-entry-list">
      {entries.map((entry, index) => (
        <li key={index} className="log-entry-list__item">
          <button
            className="log-entry-list__row"
            onClick={() =>
              setExpandedIndex((prev) => (prev === index ? null : index))
            }
          >
            <span className="log-entry-list__timestamp">
              {entry.timestamp ?? "—"}
            </span>
            <span className="log-entry-list__level">
              {entry.level ?? "—"}
            </span>
            <span className="log-entry-list__message">{entry.message}</span>
          </button>
          {expandedIndex === index && <LogEntryDetail entry={entry} />}
        </li>
      ))}
    </ul>
  );
}
