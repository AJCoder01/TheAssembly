"use client";

import { useState } from "react";
import { useAudio } from "./AudioProvider";

export function SoundControls() {
  const {
    currentTrack,
    enabled,
    entered,
    setEnabled,
    setVolume,
    volume,
  } = useAudio();
  const [panelOpen, setPanelOpen] = useState(false);
  const percentage = Math.round(volume * 100);

  return (
    <aside
      className={`sound-dock ${entered ? "sound-dock--visible" : ""}`}
      aria-label="Music controls"
    >
      <div className="sound-dock__main">
        <button
          className="sound-dock__toggle"
          type="button"
          aria-pressed={enabled}
          onClick={() => void setEnabled(!enabled)}
        >
          SOUND {enabled ? "ON" : "OFF"}
        </button>
        <button
          className="sound-dock__panel-toggle"
          type="button"
          aria-label="Sound options and music credit"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((current) => !current)}
        >
          {panelOpen ? "−" : "+"}
        </button>
      </div>
      {panelOpen ? (
        <div className="sound-panel">
          <label className="sound-dock__range">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={percentage}
              aria-label="Music volume"
              onChange={(event) => setVolume(Number(event.target.value) / 100)}
            />
          </label>
          <div className="sound-credit">
            <p>{currentTrack.composer}</p>
            <p>{currentTrack.composition}</p>
            <p>{currentTrack.performer}</p>
            <p>
              {currentTrack.sourceUrl ? (
                <a
                  href={currentTrack.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {currentTrack.sourceLabel}
                </a>
              ) : (
                currentTrack.sourceLabel
              )}
            </p>
            <p>{currentTrack.licence}</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
