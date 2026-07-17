import type { LogEntry } from "./LogEntryList";

interface LogEntryDetailProps {
  entry: LogEntry;
}

export function LogEntryDetail({ entry }: LogEntryDetailProps) {
  return (
    <div className="log-entry-detail">
      <pre className="log-entry-detail__json">
        {JSON.stringify(entry.extraFields, null, 2)}
      </pre>
    </div>
  );
}
