import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
  DATE_FORMAT_CHANGED_EVENT,
  DEFAULT_DATE_FORMAT_SETTINGS,
  type DateFormatSettings,
  type HourCycle,
  type MonthStyle,
} from "../lib/dateFormatSettings";
import "./SettingsPanel.css";

export function SettingsPanel() {
  const [settings, setSettings] = useState<DateFormatSettings>(
    DEFAULT_DATE_FORMAT_SETTINGS,
  );

  useEffect(() => {
    invoke<DateFormatSettings>("get_date_format_settings").then(setSettings);
  }, []);

  function update(next: DateFormatSettings) {
    setSettings(next);
    invoke("save_date_format_settings", { settings: next });
    emit(DATE_FORMAT_CHANGED_EVENT, next);
  }

  return (
    <div className="settings">
      <h1 className="settings__title">Datumnotatie</h1>

      <label className="settings__radio">
        <input
          type="radio"
          name="mode"
          checked={settings.mode === "system"}
          onChange={() => update({ ...settings, mode: "system" })}
        />
        Systeem (aanbevolen)
      </label>
      <label className="settings__radio">
        <input
          type="radio"
          name="mode"
          checked={settings.mode === "custom"}
          onChange={() => update({ ...settings, mode: "custom" })}
        />
        Aangepast
      </label>

      {settings.mode === "custom" && (
        <div className="settings__custom">
          <label className="settings__field">
            Maandweergave
            <select
              value={settings.monthStyle}
              onChange={(e) =>
                update({
                  ...settings,
                  monthStyle: e.target.value as MonthStyle,
                })
              }
            >
              <option value="numeric">Cijfers (07)</option>
              <option value="short">Kort (jul)</option>
              <option value="long">Lang (juli)</option>
            </select>
          </label>

          <label className="settings__field">
            Tijdnotatie
            <select
              value={settings.hourCycle}
              onChange={(e) =>
                update({
                  ...settings,
                  hourCycle: e.target.value as HourCycle,
                })
              }
            >
              <option value="h23">24-uurs</option>
              <option value="h12">12-uurs</option>
            </select>
          </label>

          <label className="settings__checkbox">
            <input
              type="checkbox"
              checked={settings.showSeconds}
              onChange={(e) =>
                update({ ...settings, showSeconds: e.target.checked })
              }
            />
            Seconden tonen
          </label>
        </div>
      )}
    </div>
  );
}
