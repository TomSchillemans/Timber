import { useState } from "react";
import { LogEntryDetail } from "./LogEntryDetail";
import { formatTimestamp } from "../lib/formatTimestamp";
import type { DateFormatSettings } from "../lib/dateFormatSettings";

export interface LogEntry {
  timestamp: string | null;
  level: string | null;
  node: string | null;
  message: string;
  extraFields: Record<string, unknown>;
}

interface LogEntryListProps {
  entries: LogEntry[];
  dateFormatSettings?: DateFormatSettings;
}

const SEVERE_LEVELS = ["error", "critical", "alert", "emergency"];

function isSevere(level: string | null): boolean {
  return level !== null && SEVERE_LEVELS.includes(level.toLowerCase());
}

export function LogEntryList({
  entries,
  dateFormatSettings,
}: LogEntryListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (entries.length === 0) {
    return <p className="log-entry-list__empty">Geen logregels gevonden.</p>;
  }

  return (
    <ul className="log-entry-list">
      {entries.map((entry, index) => (
        <li key={index} className="log-entry-list__item">
          <button
            className={
              "log-entry-list__row" +
              (isSevere(entry.level) ? " log-entry-list__row--severe" : "")
            }
            onClick={() =>
              setExpandedIndex((prev) => (prev === index ? null : index))
            }
          >
            <span
              className="log-entry-list__timestamp"
              title={entry.timestamp ?? undefined}
            >
              {formatTimestamp(entry.timestamp, dateFormatSettings)}
            </span>
            <span className="log-entry-list__level">
              {entry.level ?? "—"}
            </span>
            {entry.node && (
              <span className="log-entry-list__node">{entry.node}</span>
            )}
            <span className="log-entry-list__message">{entry.message}</span>
          </button>
          {expandedIndex === index && <LogEntryDetail entry={entry} />}
        </li>
      ))}
    </ul>
  );
}
