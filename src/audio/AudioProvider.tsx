"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EFFECTS, type EffectName, PLAYLIST } from "./playlist";

const VOLUME_KEY = "ayush:music-volume";
const SOUND_KEY = "ayush:sound-preference";
const PLAYBACK_KEY = "ayush:playlist-playback";
const DEFAULT_VOLUME = 0.38;
const MAX_VOLUME = 0.6;
const CROSSFADE_SECONDS = 7;

type ResolvedTrack = {
  source: string;
  index: number;
};

type Deck = {
  audio: HTMLAudioElement;
  gain: GainNode;
  index: number;
  source: MediaElementAudioSourceNode;
};

type AudioContextValue = {
  audioReady: boolean;
  currentTrack: (typeof PLAYLIST)[number];
  currentTrackIndex: number;
  enabled: boolean;
  entered: boolean;
  enter: (withSound: boolean) => Promise<void>;
  playEffect: (name: EffectName) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setMusicAtmosphere: (mode: "normal" | "distant") => void;
  setVolume: (volume: number) => void;
  duckForProject: () => void;
  volume: number;
};

const AudioContextState = createContext<AudioContextValue | null>(null);

const clampVolume = (value: number) =>
  Math.max(0, Math.min(MAX_VOLUME, value));

const equalPowerCurve = (
  start: number,
  end: number,
  frames = 96,
) => {
  const curve = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    const progress = index / (frames - 1);
    const eased =
      end > start
        ? Math.sin((progress * Math.PI) / 2)
        : Math.cos((progress * Math.PI) / 2);
    curve[index] = end > start ? start + (end - start) * eased : end + (start - end) * eased;
  }
  return curve;
};

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioReady, setAudioReady] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [enabled, setEnabledState] = useState(false);
  const [entered, setEntered] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const resolvedTracksRef = useRef<ResolvedTrack[]>([]);
  const contextRef = useRef<AudioContext | null>(null);
  const decksRef = useRef<[Deck, Deck] | null>(null);
  const activeDeckRef = useRef(0);
  const masterGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicFilterRef = useRef<BiquadFilterNode | null>(null);
  const effectsGainRef = useRef<GainNode | null>(null);
  const crossfadingRef = useRef(false);
  const crossfadeTimerRef = useRef<number | null>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const resumeAfterVisibilityRef = useRef(false);
  const enabledRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);

  const savePlayback = useCallback(() => {
    const decks = decksRef.current;
    if (!decks) return;
    const deck = decks[activeDeckRef.current];
    if (!Number.isFinite(deck.audio.currentTime)) return;
    window.sessionStorage.setItem(
      PLAYBACK_KEY,
      JSON.stringify({ index: deck.index, position: deck.audio.currentTime }),
    );
  }, []);

  const clearCrossfadeTimer = useCallback(() => {
    if (crossfadeTimerRef.current === null) return;
    window.clearTimeout(crossfadeTimerRef.current);
    crossfadeTimerRef.current = null;
  }, []);

  const scheduleGain = useCallback(
    (gain: GainNode, target: number, seconds: number) => {
      const context = contextRef.current;
      if (!context) return;
      const now = context.currentTime;
      const start = Math.max(0, gain.gain.value);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(start, now);
      gain.gain.setValueCurveAtTime(
        equalPowerCurve(start, target),
        now,
        Math.max(0.025, seconds),
      );
    },
    [],
  );

  const ensureGraph = useCallback(async () => {
    if (contextRef.current && decksRef.current) {
      if (contextRef.current.state === "suspended") {
        await contextRef.current.resume();
      }
      return true;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextConstructor) return false;

    const context = new AudioContextConstructor();
    const master = context.createGain();
    const music = context.createGain();
    const musicFilter = context.createBiquadFilter();
    const effects = context.createGain();
    master.gain.value = 1;
    music.gain.value = volumeRef.current;
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 18_000;
    musicFilter.Q.value = 0.18;
    effects.gain.value = 0.22;
    music.connect(musicFilter).connect(master);
    effects.connect(master);
    master.connect(context.destination);

    const makeDeck = (): Deck => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(music);
      return { audio, gain, index: -1, source };
    };

    contextRef.current = context;
    masterGainRef.current = master;
    musicGainRef.current = music;
    musicFilterRef.current = musicFilter;
    effectsGainRef.current = effects;
    decksRef.current = [makeDeck(), makeDeck()];
    await context.resume();
    return true;
  }, []);

  const nextResolvedTrack = useCallback((currentIndex: number) => {
    const available = resolvedTracksRef.current;
    if (!available.length) return null;
    const currentPosition = available.findIndex(
      (track) => track.index === currentIndex,
    );
    return available[(Math.max(-1, currentPosition) + 1) % available.length];
  }, []);

  const beginCrossfade = useCallback(async () => {
    if (crossfadingRef.current || !enabledRef.current) return;
    const decks = decksRef.current;
    const context = contextRef.current;
    if (!decks || !context) return;
    const outgoingIndex = activeDeckRef.current;
    const outgoing = decks[outgoingIndex];
    const resolved = nextResolvedTrack(outgoing.index);
    if (!resolved) return;

    const incomingIndex = outgoingIndex === 0 ? 1 : 0;
    const incoming = decks[incomingIndex];
    crossfadingRef.current = true;
    clearCrossfadeTimer();
    incoming.audio.pause();
    incoming.audio.src = resolved.source;
    incoming.audio.currentTime = 0;
    incoming.index = resolved.index;
    incoming.gain.gain.cancelScheduledValues(context.currentTime);
    incoming.gain.gain.setValueAtTime(0, context.currentTime);

    try {
      await incoming.audio.play();
    } catch {
      crossfadingRef.current = false;
      return;
    }

    const remaining = Number.isFinite(outgoing.audio.duration)
      ? Math.max(0.8, outgoing.audio.duration - outgoing.audio.currentTime)
      : CROSSFADE_SECONDS;
    const duration = Math.min(CROSSFADE_SECONDS, remaining);
    scheduleGain(outgoing.gain, 0, duration);
    scheduleGain(incoming.gain, 1, duration);

    crossfadeTimerRef.current = window.setTimeout(() => {
      outgoing.audio.pause();
      outgoing.audio.removeAttribute("src");
      outgoing.audio.load();
      outgoing.gain.gain.value = 0;
      activeDeckRef.current = incomingIndex;
      setCurrentTrackIndex(resolved.index);
      crossfadingRef.current = false;
      crossfadeTimerRef.current = null;
      savePlayback();
    }, duration * 1000 + 120);
  }, [clearCrossfadeTimer, nextResolvedTrack, savePlayback, scheduleGain]);

  const attachDeckListeners = useCallback(() => {
    const decks = decksRef.current;
    if (!decks) return () => {};
    const handlers = decks.map((deck, deckIndex) => {
      const handleTime = () => {
        if (deckIndex !== activeDeckRef.current || crossfadingRef.current) return;
        if (
          Number.isFinite(deck.audio.duration) &&
          deck.audio.duration - deck.audio.currentTime <= CROSSFADE_SECONDS
        ) {
          void beginCrossfade();
        }
      };
      const handleEnded = () => {
        if (deckIndex === activeDeckRef.current) void beginCrossfade();
      };
      deck.audio.addEventListener("timeupdate", handleTime);
      deck.audio.addEventListener("ended", handleEnded);
      return () => {
        deck.audio.removeEventListener("timeupdate", handleTime);
        deck.audio.removeEventListener("ended", handleEnded);
      };
    });
    return () => handlers.forEach((remove) => remove());
  }, [beginCrossfade]);

  const startResolvedTrack = useCallback(
    async (resolved: ResolvedTrack, restorePosition = true) => {
      const graphReady = await ensureGraph();
      const decks = decksRef.current;
      const context = contextRef.current;
      if (!graphReady || !decks || !context) return false;

      const deck = decks[activeDeckRef.current];
      clearCrossfadeTimer();
      crossfadingRef.current = false;
      deck.audio.pause();
      deck.audio.src = resolved.source;
      deck.index = resolved.index;
      deck.gain.gain.cancelScheduledValues(context.currentTime);
      deck.gain.gain.setValueAtTime(0, context.currentTime);
      deck.audio.load();

      if (restorePosition) {
        try {
          const saved = JSON.parse(
            window.sessionStorage.getItem(PLAYBACK_KEY) ?? "{}",
          ) as { index?: number; position?: number };
          if (
            saved.index === resolved.index &&
            Number.isFinite(saved.position) &&
            (saved.position ?? 0) > 0
          ) {
            deck.audio.currentTime = saved.position ?? 0;
          }
        } catch {
          window.sessionStorage.removeItem(PLAYBACK_KEY);
        }
      }

      try {
        await deck.audio.play();
      } catch {
        return false;
      }
      setCurrentTrackIndex(resolved.index);
      scheduleGain(deck.gain, 1, 2.2);
      return true;
    },
    [clearCrossfadeTimer, ensureGraph, scheduleGain],
  );

  const enter = useCallback(
    async (withSound: boolean) => {
      setEntered(true);
      window.sessionStorage.setItem("ayush:entered", "true");
      window.localStorage.setItem(SOUND_KEY, withSound ? "on" : "off");
      if (!withSound) {
        enabledRef.current = false;
        setEnabledState(false);
        return;
      }
      const first = resolvedTracksRef.current[0];
      if (!first) {
        enabledRef.current = false;
        setEnabledState(false);
        return;
      }
      enabledRef.current = true;
      setEnabledState(true);
      await startResolvedTrack(first);
    },
    [startResolvedTrack],
  );

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      window.localStorage.setItem(SOUND_KEY, nextEnabled ? "on" : "off");
      enabledRef.current = nextEnabled;
      setEnabledState(nextEnabled);
      const master = masterGainRef.current;
      const decks = decksRef.current;

      if (!nextEnabled) {
        if (master) scheduleGain(master, 0, 0.06);
        window.setTimeout(() => {
          decks?.forEach((deck) => deck.audio.pause());
          savePlayback();
        }, 90);
        return;
      }

      const graphReady = await ensureGraph();
      if (!graphReady) return;
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = 0;
        scheduleGain(masterGainRef.current, 1, 0.45);
      }
      const active = decksRef.current?.[activeDeckRef.current];
      if (active?.audio.src) {
        try {
          await active.audio.play();
          return;
        } catch {
          // Fall through to a clean restart from saved state.
        }
      }
      const first =
        resolvedTracksRef.current.find(
          (track) => track.index === currentTrackIndex,
        ) ?? resolvedTracksRef.current[0];
      if (first) await startResolvedTrack(first);
    },
    [currentTrackIndex, ensureGraph, savePlayback, scheduleGain, startResolvedTrack],
  );

  const setVolume = useCallback(
    (nextVolume: number) => {
      const next = clampVolume(nextVolume);
      volumeRef.current = next;
      setVolumeState(next);
      window.localStorage.setItem(VOLUME_KEY, next.toFixed(3));
      if (musicGainRef.current) {
        scheduleGain(musicGainRef.current, next, 0.16);
      }
    },
    [scheduleGain],
  );

  const setMusicAtmosphere = useCallback(
    (mode: "normal" | "distant") => {
      const context = contextRef.current;
      const music = musicGainRef.current;
      const filter = musicFilterRef.current;
      if (!context || !music || !filter) return;
      const now = context.currentTime;
      const distant = mode === "distant";
      music.gain.cancelScheduledValues(now);
      music.gain.setValueAtTime(music.gain.value, now);
      music.gain.linearRampToValueAtTime(
        distant ? Math.max(0.22, volumeRef.current * 0.78) : volumeRef.current,
        now + (distant ? 1.4 : 0.8),
      );
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(filter.frequency.value, now);
      filter.frequency.exponentialRampToValueAtTime(
        distant ? 2_600 : 18_000,
        now + (distant ? 1.4 : 0.8),
      );
    },
    [],
  );

  const duckForProject = useCallback(() => {
    const music = musicGainRef.current;
    if (!music || !enabledRef.current) return;
    scheduleGain(music, volumeRef.current * 0.74, 0.18);
    window.setTimeout(() => {
      if (musicGainRef.current && enabledRef.current) {
        scheduleGain(musicGainRef.current, volumeRef.current, 0.65);
      }
    }, 720);
  }, [scheduleGain]);

  const playEffect = useCallback(
    async (name: EffectName) => {
      const context = contextRef.current;
      const effects = effectsGainRef.current;
      if (!context || !effects || !enabledRef.current) return;
      try {
        const response = await fetch(EFFECTS[name]);
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(effects);
        source.start();
      } catch {
        // Permission-cleared Foley is optional; missing files intentionally stay silent.
      }
    },
    [],
  );

  useEffect(() => {
    const savedVolumeValue = window.localStorage.getItem(VOLUME_KEY);
    const savedVolume =
      savedVolumeValue === null ? Number.NaN : Number(savedVolumeValue);
    const nextVolume = Number.isFinite(savedVolume)
      ? clampVolume(savedVolume)
      : DEFAULT_VOLUME;
    volumeRef.current = nextVolume;
    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      setVolumeState(nextVolume);
      setEntered(window.sessionStorage.getItem("ayush:entered") === "true");
    });
    void Promise.all(
      PLAYLIST.map(async (track, index) => {
        for (const source of track.sources) {
          try {
            const response = await fetch(source, { method: "HEAD" });
            if (response.ok) return { source, index } satisfies ResolvedTrack;
          } catch {
            // Try the next local source.
          }
        }
        return null;
      }),
    ).then((resolved) => {
      if (cancelled) return;
      resolvedTracksRef.current = resolved.flatMap((track) =>
        track
          ? [{ source: String(track.source), index: track.index }]
          : [],
      );
      const first = resolvedTracksRef.current[0];
      if (first) setCurrentTrackIndex(first.index);
      setAudioReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!decksRef.current) return;
    return attachDeckListeners();
  }, [attachDeckListeners, enabled]);

  useEffect(() => {
    const handleVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      const decks = decksRef.current;
      if (!decks) return;
      if (hidden) {
        resumeAfterVisibilityRef.current =
          enabledRef.current && !decks[activeDeckRef.current].audio.paused;
        if (masterGainRef.current) scheduleGain(masterGainRef.current, 0, 0.12);
        if (visibilityTimerRef.current !== null) {
          window.clearTimeout(visibilityTimerRef.current);
        }
        visibilityTimerRef.current = window.setTimeout(() => {
          decks.forEach((deck) => deck.audio.pause());
          savePlayback();
          visibilityTimerRef.current = null;
        }, 155);
        return;
      }

      if (!resumeAfterVisibilityRef.current || !enabledRef.current) return;
      resumeAfterVisibilityRef.current = false;
      void decks[activeDeckRef.current].audio.play().then(() => {
        if (masterGainRef.current) {
          masterGainRef.current.gain.value = 0;
          scheduleGain(masterGainRef.current, 1, 0.48);
        }
      }).catch(() => {
        enabledRef.current = false;
        setEnabledState(false);
      });
    };

    const save = () => savePlayback();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", save);
    };
  }, [savePlayback, scheduleGain]);

  useEffect(
    () => () => {
      clearCrossfadeTimer();
      if (visibilityTimerRef.current !== null) {
        window.clearTimeout(visibilityTimerRef.current);
      }
      savePlayback();
      decksRef.current?.forEach((deck) => {
        deck.audio.pause();
        deck.source.disconnect();
        deck.gain.disconnect();
      });
      musicGainRef.current?.disconnect();
      musicFilterRef.current?.disconnect();
      effectsGainRef.current?.disconnect();
      masterGainRef.current?.disconnect();
      void contextRef.current?.close();
    },
    [clearCrossfadeTimer, savePlayback],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      audioReady,
      currentTrack: PLAYLIST[currentTrackIndex],
      currentTrackIndex,
      duckForProject,
      enabled,
      entered,
      enter,
      playEffect,
      setEnabled,
      setMusicAtmosphere,
      setVolume,
      volume,
    }),
    [
      audioReady,
      currentTrackIndex,
      duckForProject,
      enabled,
      enter,
      entered,
      playEffect,
      setEnabled,
      setMusicAtmosphere,
      setVolume,
      volume,
    ],
  );

  return (
    <AudioContextState.Provider value={value}>
      {children}
    </AudioContextState.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContextState);
  if (!context) {
    throw new Error("useAudio must be used within AudioProvider");
  }
  return context;
}
