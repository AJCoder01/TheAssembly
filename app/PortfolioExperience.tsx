"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WebGLStage } from "./WebGLStage";
import { findProjectIndex, PROJECTS } from "./projectData";
import {
  ABOUT_SCENE,
  CONTACT_SCENE,
  isProjectScene,
  LANDING_SCENE,
  LAST_SCENE,
  projectIndexToScene,
  sceneToProjectIndex,
} from "./sceneModel";

type EntryPhase = "waiting" | "leaving" | "entered";

type PortfolioExperienceProps = {
  initialProjectNumber?: string;
};

type GainAutomation = {
  endTime: number;
  startTime: number;
  startValue: number;
  target: number;
  timeConstant: number;
};

class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicLoad: Promise<AudioBuffer> | null = null;
  private musicAbort: AbortController | null = null;
  private suspendTimer: number | null = null;
  private gainAutomations = new WeakMap<GainNode, GainAutomation>();
  private disposed = false;

  async enable() {
    const WebkitAudioContext = (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
    const AudioContextConstructor = window.AudioContext || WebkitAudioContext;
    if (!AudioContextConstructor) return false;

    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (!this.context) {
      this.disposed = false;
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.master.gain.value = 0.0001;
      this.effectsGain.gain.value = 0.0001;
      this.musicGain.gain.value = 0.0001;
      this.effectsGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(this.context.destination);
      this.noise = this.createNoiseBuffer(1.4);
    }
    if (this.context.state === "suspended") await this.context.resume();
    return true;
  }

  fadeTo(value: number, duration: number) {
    this.rampGain(this.master, value, duration);
  }

  setEffectsEnabled(enabled: boolean, duration = 0.22) {
    this.rampGain(this.effectsGain, enabled ? 1 : 0, duration);
  }

  setMusicEnabled(enabled: boolean, duration = 0.42) {
    this.rampGain(this.musicGain, enabled ? 0.3 : 0, duration);
  }

  async startMusic(url: string) {
    const context = this.context;
    const musicGain = this.musicGain;
    if (!context || !musicGain || this.disposed) return false;
    if (this.musicSource) return true;

    if (!this.musicBuffer && !this.musicLoad) {
      this.musicAbort = new AbortController();
      const signal = this.musicAbort.signal;
      this.musicLoad = (async () => {
        const response = await fetch(url, {
          cache: "force-cache",
          signal,
        });
        if (!response.ok) {
          throw new Error(`Unable to load score (${response.status})`);
        }
        const encoded = await response.arrayBuffer();
        return context.decodeAudioData(encoded);
      })();
    }

    try {
      const buffer = this.musicBuffer ?? (await this.musicLoad);
      if (
        !buffer ||
        this.disposed ||
        this.context !== context ||
        this.musicSource
      ) {
        return Boolean(this.musicSource);
      }

      this.musicBuffer = buffer;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(musicGain);
      source.start();
      this.musicSource = source;
      return true;
    } catch {
      this.musicLoad = null;
      return false;
    }
  }

  playTick(pan = 0) {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (!context || !effectsGain) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = context.createStereoPanner();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(1260, now);
    oscillator.frequency.exponentialRampToValueAtTime(720, now + 0.085);
    filter.type = "bandpass";
    filter.frequency.value = 1150;
    filter.Q.value = 3.8;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.052, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));

    oscillator
      .connect(filter)
      .connect(gain)
      .connect(panner)
      .connect(effectsGain);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }

  playGlass(pan = 0) {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (!context || !effectsGain) return;

    const now = context.currentTime;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    panner.connect(effectsGain);

    [880, 1320, 2110].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(
        0.036 / (index + 1),
        now + 0.008,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.18 + index * 0.055,
      );
      oscillator.connect(gain).connect(panner);
      oscillator.start(now);
      oscillator.stop(now + 0.38);
    });
  }

  playImpact(intensity = 1) {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (!context || !effectsGain) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const lowGain = context.createGain();
    const compressor = context.createDynamicsCompressor();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(72, now);
    oscillator.frequency.exponentialRampToValueAtTime(34, now + 0.46);
    lowGain.gain.setValueAtTime(0.0001, now);
    lowGain.gain.exponentialRampToValueAtTime(
      Math.min(0.2, 0.14 * intensity),
      now + 0.018,
    );
    lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    oscillator.connect(lowGain).connect(compressor).connect(effectsGain);
    oscillator.start(now);
    oscillator.stop(now + 0.62);

    if (this.noise) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      const panner = context.createStereoPanner();
      source.buffer = this.noise;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(340, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 0.38);
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(
        0.042 * intensity,
        now + 0.012,
      );
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      panner.pan.value = -0.12;
      source
        .connect(filter)
        .connect(noiseGain)
        .connect(panner)
        .connect(effectsGain);
      source.start(now, 0, 0.44);
    }
  }

  playSweep(direction = 1) {
    const context = this.context;
    const effectsGain = this.effectsGain;
    if (!context || !effectsGain || !this.noise) return;

    const now = context.currentTime;
    const source = context.createBufferSource();
    const bandpass = context.createBiquadFilter();
    const highpass = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = this.noise;
    bandpass.type = "bandpass";
    bandpass.Q.value = 0.7;
    bandpass.frequency.setValueAtTime(240, now);
    bandpass.frequency.exponentialRampToValueAtTime(3700, now + 0.7);
    highpass.type = "highpass";
    highpass.frequency.value = 160;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.058, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.74);
    panner.pan.setValueAtTime(-0.52 * direction, now);
    panner.pan.linearRampToValueAtTime(0.52 * direction, now + 0.7);
    source
      .connect(bandpass)
      .connect(highpass)
      .connect(gain)
      .connect(panner)
      .connect(effectsGain);
    source.start(now, 0, 0.76);
  }

  suspend() {
    this.fadeTo(0, 0.16);
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
    }
    this.suspendTimer = window.setTimeout(() => {
      if (this.context?.state === "running") {
        void this.context.suspend();
      }
      this.suspendTimer = null;
    }, 190);
  }

  async restore() {
    if (!this.context || this.disposed) return false;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    try {
      if (this.context.state === "suspended") await this.context.resume();
      return true;
    } catch {
      this.fadeTo(0, 0.08);
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    this.musicAbort?.abort();
    try {
      this.musicSource?.stop();
    } catch {
      // The source may already be stopped during fast refresh.
    }
    this.musicSource?.disconnect();
    this.fadeTo(0, 0.08);
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.effectsGain = null;
    this.musicGain = null;
    this.noise = null;
    this.musicBuffer = null;
    this.musicSource = null;
    this.musicLoad = null;
    this.musicAbort = null;
  }

  private rampGain(node: GainNode | null, value: number, duration: number) {
    if (!this.context || !node) return;
    const now = this.context.currentTime;
    const gain = node.gain;
    const end = now + Math.max(duration, 0.02);
    const target = Math.max(value, 0);
    const previous = this.gainAutomations.get(node);
    const current =
      previous === undefined
        ? gain.value
        : now >= previous.endTime
          ? previous.target
          : previous.target +
            (previous.startValue - previous.target) *
              Math.exp(
                -(now - previous.startTime) / previous.timeConstant,
              );
    const timeConstant = Math.max(duration / 4.6, 0.004);

    if (typeof gain.cancelAndHoldAtTime === "function") {
      gain.cancelAndHoldAtTime(now);
    } else {
      gain.cancelScheduledValues(now);
    }
    gain.setValueAtTime(Math.max(current, 0), now);
    gain.setTargetAtTime(target, now, timeConstant);
    gain.setValueAtTime(target, end);
    this.gainAutomations.set(node, {
      endTime: end,
      startTime: now,
      startValue: Math.max(current, 0),
      target,
      timeConstant,
    });
  }

  private createNoiseBuffer(duration: number) {
    if (!this.context) return null;
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(
      1,
      frameCount,
      this.context.sampleRate,
    );
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < frameCount; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      channel[index] = previous;
    }
    return buffer;
  }
}

const masterLevelForScene = (sceneIndex: number) =>
  sceneIndex === CONTACT_SCENE
    ? 0
    : sceneIndex === ABOUT_SCENE
      ? 0.58
      : 0.72;

export function PortfolioExperience({
  initialProjectNumber,
}: PortfolioExperienceProps = {}) {
  const serverProjectIndex = findProjectIndex(initialProjectNumber);
  const initialScene =
    serverProjectIndex >= 0
      ? projectIndexToScene(serverProjectIndex)
      : LANDING_SCENE;
  const [entryPhase, setEntryPhase] = useState<EntryPhase>("waiting");
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicPending, setMusicPending] = useState(false);
  const [visualPaused, setVisualPaused] = useState(false);
  const [motionPreferenceKnown, setMotionPreferenceKnown] = useState(false);
  const [activeScene, setActiveScene] = useState(initialScene);
  const [detailIndex, setDetailIndex] = useState<number | null>(
    serverProjectIndex >= 0 ? serverProjectIndex : null,
  );
  const [webglFailed, setWebglFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const soundRef = useRef<SoundEngine | null>(null);
  const activeSceneRef = useRef(initialScene);
  const visibilityGenerationRef = useRef(0);
  const lastSceneRef = useRef(initialScene);
  const entryTimerRef = useRef<number | null>(null);
  const entryLockedRef = useRef(false);
  const landingVideoRef = useRef<HTMLVideoElement | null>(null);
  const landingHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const backControlRef = useRef<HTMLButtonElement | null>(null);
  const viewLinkRef = useRef<HTMLAnchorElement | null>(null);
  const previousDetailRef = useRef<number | null>(detailIndex);

  const activeProject = sceneToProjectIndex(activeScene);
  const project = PROJECTS[detailIndex ?? activeProject];
  const audioActive = effectsEnabled || musicEnabled;
  const landingVisible =
    activeScene === LANDING_SCENE && detailIndex === null;

  const handleWebGLFailure = useCallback(() => {
    setWebglFailed(true);
  }, []);

  useEffect(() => {
    soundRef.current = new SoundEngine();
    return () => {
      if (entryTimerRef.current) window.clearTimeout(entryTimerRef.current);
      soundRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      setMotionPreferenceKnown(true);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = landingVideoRef.current;
    if (!video) return;
    if (
      !motionPreferenceKnown ||
      !landingVisible ||
      reducedMotion ||
      visualPaused
    ) {
      video.pause();
      return;
    }
    void video.play().catch(() => setVisualPaused(true));
  }, [
    landingVisible,
    motionPreferenceKnown,
    reducedMotion,
    visualPaused,
  ]);

  useEffect(() => {
    activeSceneRef.current = activeScene;
  }, [activeScene]);

  useEffect(() => {
    if (serverProjectIndex >= 0) return;
    window.scrollTo(0, 0);
    activeSceneRef.current = LANDING_SCENE;
    lastSceneRef.current = LANDING_SCENE;
  }, [serverProjectIndex]);

  useEffect(() => {
    const previousDetail = previousDetailRef.current;
    previousDetailRef.current = detailIndex;
    if (entryPhase !== "entered") return;

    if (detailIndex !== null && previousDetail === null) {
      window.requestAnimationFrame(() => backControlRef.current?.focus());
    } else if (detailIndex === null && previousDetail !== null) {
      window.requestAnimationFrame(() => viewLinkRef.current?.focus());
    }
  }, [detailIndex, entryPhase]);

  useEffect(() => {
    const shouldLock = entryPhase !== "entered" || detailIndex !== null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = shouldLock ? "hidden" : "";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [detailIndex, entryPhase]);

  useEffect(() => {
    let ticking = false;
    let scrollFrame = 0;
    const updateScene = () => {
      if (entryPhase !== "entered" && detailIndex === null) {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
        setActiveScene(LANDING_SCENE);
        ticking = false;
        return;
      }
      const viewport = Math.max(window.innerHeight, 1);
      const nextScene = Math.max(
        0,
        Math.min(
          LAST_SCENE,
          Math.floor((window.scrollY + viewport * 0.46) / viewport),
        ),
      );
      setActiveScene(nextScene);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      scrollFrame = window.requestAnimationFrame(updateScene);
    };
    updateScene();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    };
  }, [detailIndex, entryPhase]);

  useEffect(() => {
    let alignmentFrame = 0;
    const getLocationProjectIndex = () => {
      const pathMatch = window.location.pathname.match(
        /^\/project\/(0[1-4])\/?$/,
      );
      const queryProject = new URLSearchParams(window.location.search).get(
        "project",
      );
      return findProjectIndex(pathMatch?.[1] ?? queryProject);
    };
    const onPopState = (event: PopStateEvent) => {
      const stateProject = event.state?.ayushProject;
      const routeIndex = getLocationProjectIndex();
      const next =
        routeIndex >= 0
          ? typeof stateProject === "number"
            ? stateProject
            : routeIndex
          : null;
      setDetailIndex(next);
      if (next !== null) {
        const projectScene = projectIndexToScene(next);
        setActiveScene(projectScene);
        window.scrollTo(0, projectScene * window.innerHeight);
      }
    };
    onPopState(new PopStateEvent("popstate", { state: window.history.state }));
    const initialIndex = getLocationProjectIndex();
    if (initialIndex >= 0) {
      alignmentFrame = window.requestAnimationFrame(() => {
        const projectScene = projectIndexToScene(initialIndex);
        window.scrollTo(0, projectScene * window.innerHeight);
        setActiveScene(projectScene);
      });
    }
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (alignmentFrame) window.cancelAnimationFrame(alignmentFrame);
    };
  }, []);

  useEffect(() => {
    if (
      entryPhase !== "entered" ||
      detailIndex !== null ||
      activeScene === lastSceneRef.current
    ) {
      return;
    }

    const previousScene = lastSceneRef.current;
    const engine = soundRef.current;
    if (audioActive && engine) {
      if (activeScene === LANDING_SCENE) {
        if (effectsEnabled) engine.playGlass(-0.35);
        engine.fadeTo(masterLevelForScene(activeScene), 0.62);
      } else if (isProjectScene(activeScene)) {
        const projectIndex = sceneToProjectIndex(activeScene);
        const direction = Math.sign(activeScene - previousScene) || 1;
        if (effectsEnabled) {
          engine.playTick((projectIndex / 3 - 0.5) * 1.15);
        }
        if (
          effectsEnabled &&
          Math.abs(activeScene - previousScene) > 1
        ) {
          engine.playSweep(direction);
        }
        engine.fadeTo(masterLevelForScene(activeScene), 0.5);
      } else if (activeScene === ABOUT_SCENE) {
        if (effectsEnabled) engine.playSweep(1);
        engine.fadeTo(masterLevelForScene(activeScene), 0.8);
      } else {
        if (effectsEnabled) engine.playImpact(0.62);
        engine.fadeTo(masterLevelForScene(activeScene), 1.9);
      }
    }
    lastSceneRef.current = activeScene;
  }, [
    activeScene,
    audioActive,
    detailIndex,
    effectsEnabled,
    entryPhase,
  ]);

  useEffect(() => {
    const onVisibility = () => {
      const generation = visibilityGenerationRef.current + 1;
      visibilityGenerationRef.current = generation;
      const engine = soundRef.current;
      if (!engine) return;
      if (document.hidden) {
        engine.suspend();
        return;
      }
      if (!audioActive) return;

      void (async () => {
        const restored = await engine.restore();
        if (
          !restored ||
          generation !== visibilityGenerationRef.current ||
          document.hidden
        ) {
          return;
        }
        engine.fadeTo(
          masterLevelForScene(activeSceneRef.current),
          0.45,
        );
      })();
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      visibilityGenerationRef.current += 1;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [audioActive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailIndex !== null) {
        closeProject();
        return;
      }
      if (
        entryPhase !== "entered" ||
        detailIndex !== null ||
        !["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(event.key)
      ) {
        return;
      }
      event.preventDefault();
      const direction =
        event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1;
      scrollToScene(activeScene + direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const sceneLabels = useMemo(
    () => [
      "Landing",
      "Project 01",
      "Project 02",
      "Project 03",
      "Project 04",
      "About",
      "Contact",
    ],
    [],
  );

  const enter = async (withSound: boolean) => {
    if (entryPhase !== "waiting" || entryLockedRef.current) return;
    entryLockedRef.current = true;
    setEntryPhase("leaving");
    entryTimerRef.current = window.setTimeout(
      () => {
        setEntryPhase("entered");
        window.requestAnimationFrame(() => {
          if (detailIndex !== null) backControlRef.current?.focus();
          else landingHeadingRef.current?.focus({ preventScroll: true });
        });
      },
      reducedMotion ? 220 : 760,
    );

    if (withSound) {
      const engine = soundRef.current;
      if (!engine) return;
      try {
        const enabled = await engine.enable();
        if (enabled) {
          engine.fadeTo(masterLevelForScene(activeScene), 0.42);
          engine.setEffectsEnabled(true, 0.08);
          setEffectsEnabled(true);
          engine.playImpact(0.9);
          engine.playSweep(1);
          setMusicPending(true);
          const started = await engine.startMusic(
            "/audio/ayush-nocturne.mp3",
          );
          if (started) {
            engine.fadeTo(
              masterLevelForScene(activeSceneRef.current),
              0.22,
            );
            engine.setMusicEnabled(true, 1.65);
            setMusicEnabled(true);
          }
          setMusicPending(false);
        }
      } catch {
        engine.setEffectsEnabled(false, 0.1);
        engine.setMusicEnabled(false, 0.1);
        setEffectsEnabled(false);
        setMusicEnabled(false);
        setMusicPending(false);
      }
    }
  };

  const toggleEffects = async () => {
    const engine = soundRef.current;
    if (!engine) return;
    if (effectsEnabled) {
      engine.setEffectsEnabled(false, 0.28);
      setEffectsEnabled(false);
      return;
    }

    try {
      const enabled = await engine.enable();
      if (enabled) {
        engine.fadeTo(masterLevelForScene(activeScene), 0.35);
        engine.setEffectsEnabled(true, 0.2);
        setEffectsEnabled(true);
        engine.playGlass(0.55);
      }
    } catch {
      engine.setEffectsEnabled(false, 0.1);
      setEffectsEnabled(false);
    }
  };

  const toggleMusic = async () => {
    const engine = soundRef.current;
    if (!engine || musicPending) return;
    if (musicEnabled) {
      engine.setMusicEnabled(false, 0.35);
      setMusicEnabled(false);
      return;
    }

    setMusicPending(true);
    try {
      const enabled = await engine.enable();
      if (!enabled) return;
      engine.fadeTo(masterLevelForScene(activeScene), 0.35);
      const started = await engine.startMusic("/audio/ayush-nocturne.mp3");
      if (started) {
        engine.fadeTo(
          masterLevelForScene(activeSceneRef.current),
          0.22,
        );
        engine.setMusicEnabled(true, 1.2);
        setMusicEnabled(true);
      }
    } catch {
      engine.setMusicEnabled(false, 0.1);
      setMusicEnabled(false);
    } finally {
      setMusicPending(false);
    }
  };

  const scrollToScene = (index: number) => {
    const next = Math.max(0, Math.min(LAST_SCENE, index));
    window.scrollTo({
      top: next * window.innerHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  const openProject = (index: number) => {
    if (detailIndex !== null) return;
    const nextProject = PROJECTS[index];
    window.history.pushState(
      { ayushProject: index },
      "",
      `/project/${nextProject.number}`,
    );
    setDetailIndex(index);
    if (effectsEnabled) {
      soundRef.current?.playSweep(1);
      soundRef.current?.playImpact(0.72);
    }
  };

  function closeProject() {
    if (detailIndex === null) return;
    if (window.history.state?.ayushProject !== undefined) {
      window.history.back();
    } else {
      window.history.replaceState({}, "", "/");
      setDetailIndex(null);
    }
    if (effectsEnabled) {
      soundRef.current?.playSweep(-1);
      soundRef.current?.playGlass(-0.4);
    }
  }

  const sceneClass =
    activeScene === LANDING_SCENE
      ? "landing"
      : isProjectScene(activeScene)
        ? "projects"
        : activeScene === ABOUT_SCENE
          ? "about"
          : "contact";
  const isEnding =
    entryPhase === "entered" && activeScene === CONTACT_SCENE;
  const projectVisible =
    detailIndex !== null || isProjectScene(activeScene);
  const railScene =
    detailIndex === null ? activeScene : projectIndexToScene(detailIndex);

  return (
    <main
      className={`experience scene-${sceneClass} ${
        detailIndex !== null ? "is-detail" : ""
      } ${entryPhase === "entered" ? "is-entered" : ""} ${
        reducedMotion ? "is-reduced-motion" : ""
      }`}
    >
      <div className="fixed-world" aria-hidden="true">
        {!webglFailed && (
          <WebGLStage
            activeIndex={detailIndex ?? activeProject}
            detailIndex={detailIndex}
            entered={entryPhase === "entered"}
            reducedMotion={reducedMotion}
            sceneIndex={activeScene}
            onFailure={handleWebGLFailure}
          />
        )}
        {webglFailed && projectVisible && (
          <div className="fallback-media" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.image} alt="" />
          </div>
        )}
        <div className="world-vignette" />
      </div>

      <section
        className={`scene-content landing-content ${
          landingVisible ? "is-visible" : ""
        }`}
        aria-hidden={!landingVisible}
      >
        <div className="landing-visual-shell">
          <video
            className="landing-visual"
            ref={landingVideoRef}
            loop
            muted
            playsInline
            preload="metadata"
            poster="/media/ayush-landing-poster.webp"
            tabIndex={-1}
            aria-hidden="true"
          >
            <source
              src="/media/ayush-landing-loop.mp4"
              type="video/mp4"
            />
          </video>
          <div className="landing-visual-shade" aria-hidden="true" />
          <button
            className="landing-visual-control"
            type="button"
            onClick={() => setVisualPaused((paused) => !paused)}
            aria-label="Landing visual animation"
            aria-pressed={!visualPaused}
            tabIndex={landingVisible ? 0 : -1}
          >
            <span />
            <span />
          </button>
        </div>
        <div className="landing-identity">
          <h1 ref={landingHeadingRef} tabIndex={-1}>
            AYUSH
          </h1>
          <p>Developer / Product Builder</p>
        </div>
        {entryPhase === "entered" && (
          <button
            className="landing-scroll"
            type="button"
            onClick={() => scrollToScene(projectIndexToScene(0))}
          >
            <span aria-hidden="true">↓</span>
            SCROLL TO PROJECTS
          </button>
        )}
      </section>

      <div
        className={`entry-screen entry-${entryPhase}`}
        aria-hidden={entryPhase === "entered"}
      >
        <div className="entry-actions">
          <button
            type="button"
            onClick={() => void enter(true)}
            disabled={entryPhase !== "waiting"}
            tabIndex={entryPhase === "waiting" ? 0 : -1}
          >
            Enter with sound
          </button>
          <button
            type="button"
            onClick={() => void enter(false)}
            disabled={entryPhase !== "waiting"}
            tabIndex={entryPhase === "waiting" ? 0 : -1}
          >
            Enter muted
          </button>
        </div>
      </div>

      <div className="site-chrome" aria-hidden={entryPhase !== "entered"}>
        <nav
          className="scene-rail"
          aria-label="Scene navigation"
          aria-hidden={
            detailIndex !== null || activeScene === CONTACT_SCENE
          }
        >
          {sceneLabels.map((label, index) => (
            <button
              className={railScene === index ? "is-active" : ""}
              type="button"
              key={label}
              onClick={() => scrollToScene(index)}
              tabIndex={
                detailIndex !== null || activeScene === CONTACT_SCENE
                  ? -1
                  : 0
              }
              aria-label={label}
              aria-current={railScene === index ? "step" : undefined}
            >
              <span />
            </button>
          ))}
        </nav>

        <div className="audio-controls">
          <button
            className={`music-control ${
              musicEnabled ? "is-on" : "is-off"
            } ${musicPending ? "is-pending" : ""}`}
            type="button"
            onClick={() => void toggleMusic()}
            aria-label="Background music"
            aria-pressed={musicEnabled}
            aria-busy={musicPending}
            disabled={musicPending}
          >
            <span aria-hidden="true" />
            MUSIC
          </button>
          <button
            className={`sound-control ${
              effectsEnabled ? "is-on" : "is-off"
            }`}
            type="button"
            onClick={() => void toggleEffects()}
            aria-label="Interaction sounds"
            aria-pressed={effectsEnabled}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div
        className={`scene-content project-content ${
          projectVisible ? "is-visible" : ""
        }`}
        aria-hidden={!projectVisible || entryPhase !== "entered"}
      >
        {detailIndex !== null && (
          <button
            ref={backControlRef}
            type="button"
            className="back-control"
            onClick={closeProject}
            aria-label="Back to project archive"
            tabIndex={entryPhase === "entered" ? 0 : -1}
          >
            ←
          </button>
        )}
        <div className="project-number" key={`number-${project.number}`}>
          {project.number}
        </div>
        <div className="project-title-mask">
          <h2 key={`title-${project.number}`}>PROJECT NAME</h2>
        </div>
        <div className="project-meta" key={`meta-${project.number}`}>
          <span>CATEGORY</span>
          <span>YEAR</span>
          {detailIndex === null ? (
            <a
              ref={viewLinkRef}
              href={`/project/${project.number}`}
              tabIndex={
                entryPhase === "entered" &&
                detailIndex === null &&
                isProjectScene(activeScene)
                  ? 0
                  : -1
              }
              onClick={(event) => {
                event.preventDefault();
                openProject(activeProject);
              }}
            >
              VIEW
            </a>
          ) : (
            <span>VIEW</span>
          )}
        </div>
      </div>

      <section
        className={`scene-content about-content ${
          activeScene === ABOUT_SCENE ? "is-visible" : ""
        }`}
        aria-hidden={
          activeScene !== ABOUT_SCENE || entryPhase !== "entered"
        }
      >
        <p className="scene-kicker">ABOUT</p>
        <p className="about-line">
          I build thoughtful products where engineering, interaction and
          intelligent systems meet.
        </p>
        <ul>
          <li>PRODUCT ENGINEERING</li>
          <li>INTERACTIVE FRONTEND</li>
          <li>AI SYSTEMS</li>
        </ul>
        <span className="resume-link">RÉSUMÉ</span>
      </section>

      <div
        className={`curtain-layer ${isEnding ? "is-closed" : ""}`}
        aria-hidden="true"
      >
        <div className="curtain curtain-left" />
        <div className="curtain curtain-right" />
      </div>

      <section
        className={`scene-content contact-content ${
          isEnding ? "is-visible" : ""
        }`}
        aria-hidden={!isEnding}
      >
        <h2>LET’S BUILD SOMETHING.</h2>
        <div className="contact-links">
          <span>EMAIL</span>
          <span>GITHUB</span>
          <span>LINKEDIN</span>
        </div>
      </section>

      <div className="scroll-track" aria-hidden="true">
        {sceneLabels.map((label) => (
          <div className="scroll-panel" key={label} />
        ))}
      </div>
    </main>
  );
}
