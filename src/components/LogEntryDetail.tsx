import type { LogEntry } from "./LogEntryList";

interface LogEntryDetailProps {
  entry: LogEntry;
}

export function LogEntryDetail({ entry }: LogEntryDetailProps) {
  const hasExtraFields = Object.keys(entry.extraFields).length > 0;

  return (
    <div className="log-entry-detail">
      {hasExtraFields ? (
        <pre className="log-entry-detail__json">
          {JSON.stringify(entry.extraFields, null, 2)}
        </pre>
      ) : (
        <p className="log-entry-detail__empty">Geen overige velden.</p>
      )}
    </div>
  );
}
