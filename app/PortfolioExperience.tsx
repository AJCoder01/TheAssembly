"use client";

import {
  type CSSProperties,
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
  TOTAL_SCENES,
} from "./sceneModel";

type EntryPhase = "waiting" | "launching" | "entered";
type RouteTransition = "idle" | "opening" | "closing";

type PortfolioExperienceProps = {
  initialProjectNumber?: string;
};

type CriticalAssets = {
  font: boolean;
  project01: boolean;
  project02: boolean;
  project03: boolean;
  stage: boolean;
};

const AUDIO_POSITION_KEY = "ayush:moonlight-position";
const SOUND_PREFERENCE_KEY = "ayush:sound-preference";
const SCROLL_POSITION_KEY = "ayush:portfolio-scroll";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const sceneMix = (sceneIndex: number) => {
  if (sceneIndex === ABOUT_SCENE) {
    return { cutoff: 6200, level: 0.105 };
  }
  if (sceneIndex === CONTACT_SCENE) {
    return { cutoff: 19_000, level: 0.13 };
  }
  if (isProjectScene(sceneIndex)) {
    return { cutoff: 20_000, level: 0.14 };
  }
  return { cutoff: 16_000, level: 0.13 };
};

class FilmScoreEngine {
  private audio: HTMLAudioElement | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private context: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private pauseTimer: number | null = null;
  private restoreTimer: number | null = null;
  private currentScene = LANDING_SCENE;
  private audible = false;
  private shouldResumeAfterVisibility = false;

  async start(
    audio: HTMLAudioElement,
    sceneIndex: number,
    fadeDuration = 2.5,
  ) {
    const ready = await this.ensureGraph(audio);
    if (!ready || !this.context || !this.gain) return false;

    this.clearPauseTimer();
    this.currentScene = sceneIndex;
    const savedPosition = Number(
      window.sessionStorage.getItem(AUDIO_POSITION_KEY),
    );
    if (
      audio.currentTime < 0.1 &&
      Number.isFinite(savedPosition) &&
      savedPosition > 0 &&
      (!Number.isFinite(audio.duration) || savedPosition < audio.duration - 1)
    ) {
      audio.currentTime = savedPosition;
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    await audio.play();
    this.audible = true;
    this.applyScene(sceneIndex, fadeDuration);
    return true;
  }

  mute(duration = 0.38) {
    this.audible = false;
    this.fadeGain(0, duration);
    this.clearPauseTimer();
    this.pauseTimer = window.setTimeout(() => {
      this.savePosition();
      this.audio?.pause();
      this.pauseTimer = null;
    }, Math.ceil(duration * 1000) + 45);
  }

  applyScene(sceneIndex: number, duration = 0.8) {
    this.currentScene = sceneIndex;
    const mix = sceneMix(sceneIndex);
    if (this.context && this.filter) {
      const now = this.context.currentTime;
      this.filter.frequency.cancelScheduledValues(now);
      this.filter.frequency.setTargetAtTime(
        mix.cutoff,
        now,
        Math.max(duration / 4.6, 0.03),
      );
    }
    if (this.audible) this.fadeGain(mix.level, duration);
  }

  duckForProjectTransition() {
    if (!this.audible || !this.context || !this.filter) return;
    const now = this.context.currentTime;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setTargetAtTime(8200, now, 0.08);
    this.fadeGain(0.092, 0.28);
    if (this.restoreTimer !== null) window.clearTimeout(this.restoreTimer);
    this.restoreTimer = window.setTimeout(() => {
      this.applyScene(this.currentScene, 0.9);
      this.restoreTimer = null;
    }, 760);
  }

  handleVisibility(hidden: boolean) {
    if (hidden) {
      this.shouldResumeAfterVisibility = this.audible && Boolean(this.audio);
      this.fadeGain(0, 0.12);
      this.clearPauseTimer();
      this.pauseTimer = window.setTimeout(() => {
        this.savePosition();
        this.audio?.pause();
        this.pauseTimer = null;
      }, 165);
      return;
    }

    if (!this.shouldResumeAfterVisibility || !this.audio || !this.context) {
      return;
    }
    this.shouldResumeAfterVisibility = false;
    void (async () => {
      try {
        if (this.context?.state === "suspended") await this.context.resume();
        await this.audio?.play();
        if (this.audible) this.applyScene(this.currentScene, 0.55);
      } catch {
        this.audible = false;
      }
    })();
  }

  savePosition() {
    if (!this.audio || !Number.isFinite(this.audio.currentTime)) return;
    window.sessionStorage.setItem(
      AUDIO_POSITION_KEY,
      this.audio.currentTime.toFixed(3),
    );
  }

  dispose() {
    this.savePosition();
    this.clearPauseTimer();
    if (this.restoreTimer !== null) window.clearTimeout(this.restoreTimer);
    this.audio?.pause();
    this.source?.disconnect();
    this.filter?.disconnect();
    this.compressor?.disconnect();
    this.gain?.disconnect();
    void this.context?.close();
    this.audio = null;
    this.compressor = null;
    this.context = null;
    this.filter = null;
    this.gain = null;
    this.source = null;
  }

  private async ensureGraph(audio: HTMLAudioElement) {
    if (this.context && this.audio === audio) return true;

    const WebkitAudioContext = (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
    const AudioContextConstructor = window.AudioContext || WebkitAudioContext;
    if (!AudioContextConstructor) return false;

    this.audio = audio;
    this.context = new AudioContextConstructor();
    this.source = this.context.createMediaElementSource(audio);
    this.filter = this.context.createBiquadFilter();
    this.compressor = this.context.createDynamicsCompressor();
    this.gain = this.context.createGain();

    this.filter.type = "lowpass";
    this.filter.frequency.value = 16_000;
    this.filter.Q.value = 0.24;
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 1.65;
    this.compressor.attack.value = 0.08;
    this.compressor.release.value = 0.8;
    this.gain.gain.value = 0;

    this.source
      .connect(this.filter)
      .connect(this.compressor)
      .connect(this.gain)
      .connect(this.context.destination);
    return true;
  }

  private fadeGain(target: number, duration: number) {
    if (!this.context || !this.gain) return;
    const parameter = this.gain.gain;
    const now = this.context.currentTime;
    const from = Math.max(0, parameter.value);
    const frames = 64;
    const curve = new Float32Array(frames);
    for (let index = 0; index < frames; index += 1) {
      const t = index / (frames - 1);
      const eased =
        target >= from
          ? Math.sin((t * Math.PI) / 2)
          : 1 - Math.cos((t * Math.PI) / 2);
      curve[index] = from + (target - from) * eased;
    }
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(from, now);
    parameter.setValueCurveAtTime(
      curve,
      now,
      Math.max(duration, 0.025),
    );
  }

  private clearPauseTimer() {
    if (this.pauseTimer === null) return;
    window.clearTimeout(this.pauseTimer);
    this.pauseTimer = null;
  }
}

const emptyCriticalAssets: CriticalAssets = {
  font: false,
  project01: false,
  project02: false,
  project03: false,
  stage: false,
};

export function PortfolioExperience({
  initialProjectNumber,
}: PortfolioExperienceProps = {}) {
  const serverProjectIndex = findProjectIndex(initialProjectNumber);
  const initialScene =
    serverProjectIndex >= 0
      ? projectIndexToScene(serverProjectIndex)
      : LANDING_SCENE;
  const [entryPhase, setEntryPhase] = useState<EntryPhase>(
    serverProjectIndex >= 0 ? "entered" : "waiting",
  );
  const [criticalAssets, setCriticalAssets] =
    useState<CriticalAssets>(emptyCriticalAssets);
  const [activeScene, setActiveScene] = useState(initialScene);
  const [scrollProgress, setScrollProgress] = useState(initialScene);
  const [detailIndex, setDetailIndex] = useState<number | null>(
    serverProjectIndex >= 0 ? serverProjectIndex : null,
  );
  const [routeTransition, setRouteTransition] =
    useState<RouteTransition>("idle");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<FilmScoreEngine | null>(null);
  const activeSceneRef = useRef(initialScene);
  const entryLockedRef = useRef(false);
  const entryTimerRef = useRef<number | null>(null);
  const routeTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const previousDetailRef = useRef<number | null>(detailIndex);
  const resumeScrollRef = useRef(initialScene);
  const backControlRef = useRef<HTMLButtonElement | null>(null);
  const viewLinkRef = useRef<HTMLAnchorElement | null>(null);

  const loadedCriticalCount = Object.values(criticalAssets).filter(Boolean).length;
  const loadProgress = loadedCriticalCount / Object.keys(criticalAssets).length;
  const entryReady = loadedCriticalCount === Object.keys(criticalAssets).length;
  const activeProject = sceneToProjectIndex(
    clamp(activeScene, projectIndexToScene(0), projectIndexToScene(3)),
  );
  const visibleProjectIndex = detailIndex ?? activeProject;
  const project = PROJECTS[visibleProjectIndex];
  const projectVisible =
    detailIndex !== null || (entryPhase !== "waiting" && isProjectScene(activeScene));
  const heroVisible =
    detailIndex === null && activeScene === LANDING_SCENE;
  const chromeVisible =
    entryPhase !== "waiting" &&
    (scrollProgress > 0.42 || detailIndex !== null);
  const heroProgress = clamp(scrollProgress, 0, 1);
  const journeyStarted = entryPhase !== "waiting";

  const markCriticalAsset = useCallback((key: keyof CriticalAssets) => {
    setCriticalAssets((current) =>
      current[key] ? current : { ...current, [key]: true },
    );
  }, []);

  const handleWebGLReady = useCallback(() => {
    markCriticalAsset("stage");
  }, [markCriticalAsset]);

  const handleWebGLFailure = useCallback(() => {
    setWebglFailed(true);
    markCriticalAsset("stage");
  }, [markCriticalAsset]);

  const scrollToScene = useCallback(
    (index: number) => {
      const next = clamp(index, LANDING_SCENE, LAST_SCENE);
      window.scrollTo({
        top: next * window.innerHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );

  const restoreHomepageScroll = useCallback(() => {
    const stored = Number(window.sessionStorage.getItem(SCROLL_POSITION_KEY));
    const target = Number.isFinite(stored)
      ? stored
      : resumeScrollRef.current * window.innerHeight;
    window.requestAnimationFrame(() => window.scrollTo(0, target));
  }, []);

  useEffect(() => {
    engineRef.current = new FilmScoreEngine();
    return () => {
      if (entryTimerRef.current !== null) {
        window.clearTimeout(entryTimerRef.current);
      }
      if (routeTimerRef.current !== null) {
        window.clearTimeout(routeTimerRef.current);
      }
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
      }
      engineRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const mark = (key: keyof CriticalAssets) => {
      if (!cancelled) markCriticalAsset(key);
    };
    const imageAssets: Array<[keyof CriticalAssets, string]> = [
      ["project01", PROJECTS[0].image],
      ["project02", PROJECTS[1].image],
      ["project03", PROJECTS[2].image],
    ];

    imageAssets.forEach(([key, source]) => {
      const image = new Image();
      image.onload = () => mark(key);
      image.onerror = () => mark(key);
      image.src = source;
      if (image.complete) mark(key);
    });

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => mark("font"));
    } else {
      mark("font");
    }

    return () => {
      cancelled = true;
    };
  }, [markCriticalAsset]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    activeSceneRef.current = activeScene;
    engineRef.current?.applyScene(activeScene);
  }, [activeScene]);

  useEffect(() => {
    if (serverProjectIndex >= 0) return;
    window.scrollTo(0, 0);
  }, [serverProjectIndex]);

  useEffect(() => {
    const shouldLock = entryPhase === "waiting" || detailIndex !== null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = shouldLock ? "hidden" : "";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [detailIndex, entryPhase]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const viewport = Math.max(window.innerHeight, 1);
      const nextProgress = clamp(window.scrollY / viewport, 0, LAST_SCENE);
      const nextScene = clamp(
        Math.floor(nextProgress + 0.48),
        LANDING_SCENE,
        LAST_SCENE,
      );
      setScrollProgress(nextProgress);
      setActiveScene(nextScene);
      frame = 0;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const readRouteProject = () => {
      const pathMatch = window.location.pathname.match(
        /^\/project\/(0[1-4])\/?$/,
      );
      return findProjectIndex(pathMatch?.[1]);
    };
    const onPopState = () => {
      const routeProject = readRouteProject();
      const nextDetail = routeProject >= 0 ? routeProject : null;
      if (nextDetail === null && detailIndex !== null) {
        setRouteTransition("closing");
        engineRef.current?.duckForProjectTransition();
        setDetailIndex(null);
        restoreHomepageScroll();
        routeTimerRef.current = window.setTimeout(() => {
          setRouteTransition("idle");
        }, reducedMotion ? 180 : 1050);
      } else if (nextDetail !== null) {
        setDetailIndex(nextDetail);
        setActiveScene(projectIndexToScene(nextDetail));
        setScrollProgress(projectIndexToScene(nextDetail));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [detailIndex, reducedMotion, restoreHomepageScroll]);

  useEffect(() => {
    if (serverProjectIndex < 0) return;
    const projectScene = projectIndexToScene(serverProjectIndex);
    window.requestAnimationFrame(() => {
      setActiveScene(projectScene);
      setScrollProgress(projectScene);
      window.scrollTo(0, projectScene * window.innerHeight);
    });
  }, [serverProjectIndex]);

  useEffect(() => {
    const previousDetail = previousDetailRef.current;
    previousDetailRef.current = detailIndex;
    if (detailIndex !== null && previousDetail === null) {
      focusTimerRef.current = window.setTimeout(
        () => backControlRef.current?.focus(),
        reducedMotion ? 50 : 980,
      );
    } else if (detailIndex === null && previousDetail !== null) {
      focusTimerRef.current = window.setTimeout(
        () => viewLinkRef.current?.focus(),
        reducedMotion ? 50 : 980,
      );
    }
  }, [detailIndex, reducedMotion]);

  useEffect(() => {
    const onVisibility = () => {
      engineRef.current?.handleVisibility(document.hidden);
    };
    const save = () => engineRef.current?.savePosition();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailIndex !== null) {
        closeProject();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const enter = async (withMusic: boolean) => {
    if (!entryReady || entryPhase !== "waiting" || entryLockedRef.current) {
      return;
    }
    entryLockedRef.current = true;
    setEntryPhase("launching");
    window.localStorage.setItem(
      SOUND_PREFERENCE_KEY,
      withMusic ? "on" : "off",
    );
    entryTimerRef.current = window.setTimeout(
      () => {
        setEntryPhase("entered");
        entryTimerRef.current = null;
      },
      reducedMotion ? 260 : 3100,
    );

    if (!withMusic || !audioRef.current || !engineRef.current) {
      setSoundEnabled(false);
      return;
    }

    setSoundPending(true);
    try {
      const started = await engineRef.current.start(
        audioRef.current,
        activeSceneRef.current,
        reducedMotion ? 0.2 : 2.5,
      );
      setSoundEnabled(started);
    } catch {
      setSoundEnabled(false);
    } finally {
      setSoundPending(false);
    }
  };

  const toggleSound = async () => {
    const engine = engineRef.current;
    const audio = audioRef.current;
    if (!engine || !audio || soundPending) return;

    if (soundEnabled) {
      engine.mute();
      setSoundEnabled(false);
      window.localStorage.setItem(SOUND_PREFERENCE_KEY, "off");
      return;
    }

    setSoundPending(true);
    try {
      const started = await engine.start(
        audio,
        activeSceneRef.current,
        reducedMotion ? 0.2 : 1.5,
      );
      setSoundEnabled(started);
      if (started) window.localStorage.setItem(SOUND_PREFERENCE_KEY, "on");
    } catch {
      setSoundEnabled(false);
    } finally {
      setSoundPending(false);
    }
  };

  const openProject = (index: number) => {
    if (detailIndex !== null || routeTransition !== "idle") return;
    const targetProject = PROJECTS[index];
    const currentScroll = window.scrollY;
    resumeScrollRef.current = currentScroll / Math.max(window.innerHeight, 1);
    window.sessionStorage.setItem(
      SCROLL_POSITION_KEY,
      currentScroll.toFixed(0),
    );
    setRouteTransition("opening");
    setDetailIndex(index);
    engineRef.current?.duckForProjectTransition();

    routeTimerRef.current = window.setTimeout(
      () => {
        window.history.pushState(
          { ayushProject: index },
          "",
          `/project/${targetProject.number}`,
        );
        routeTimerRef.current = window.setTimeout(() => {
          setRouteTransition("idle");
          routeTimerRef.current = null;
        }, reducedMotion ? 40 : 760);
      },
      reducedMotion ? 20 : 260,
    );
  };

  function closeProject() {
    if (detailIndex === null || routeTransition !== "idle") return;
    setRouteTransition("closing");
    engineRef.current?.duckForProjectTransition();
    routeTimerRef.current = window.setTimeout(
      () => {
        if (window.history.state?.ayushProject !== undefined) {
          window.history.back();
        } else {
          window.history.replaceState({}, "", "/");
          setDetailIndex(null);
          restoreHomepageScroll();
          routeTimerRef.current = window.setTimeout(() => {
            setRouteTransition("idle");
            routeTimerRef.current = null;
          }, reducedMotion ? 40 : 760);
        }
      },
      reducedMotion ? 20 : 260,
    );
  }

  const entryStyle = {
    "--fragment-opacity": 0.22 + loadProgress * 0.7,
    "--fragment-scale": 0.04 + loadProgress * 0.96,
    "--load-progress": loadProgress,
  } as CSSProperties;
  const experienceStyle = {
    "--hero-left": `${heroProgress * -8}vw`,
    "--hero-right": `${heroProgress * 8}vw`,
  } as CSSProperties;
  const projectScenes = useMemo(
    () => PROJECTS.map((item) => `Project ${item.number}`),
    [],
  );

  return (
    <main
      className={`experience entry-${entryPhase} route-${routeTransition} ${
        detailIndex !== null ? "is-detail" : ""
      } ${reducedMotion ? "is-reduced-motion" : ""} scene-${activeScene}`}
      style={experienceStyle}
      data-active-scene={activeScene}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        onError={() => {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "Moonlight Sonata is unavailable. Expected /audio/music/moonlight-adagio.ogg or .mp3.",
            );
          }
        }}
      >
        <source
          src="/audio/music/moonlight-adagio.ogg"
          type="audio/ogg"
        />
        <source
          src="/audio/music/moonlight-adagio.mp3"
          type="audio/mpeg"
        />
      </audio>

      <div className="fixed-world" aria-hidden="true">
        {!webglFailed ? (
          <WebGLStage
            detailIndex={detailIndex}
            entered={journeyStarted}
            onFailure={handleWebGLFailure}
            onReady={handleWebGLReady}
            reducedMotion={reducedMotion}
            scrollProgress={scrollProgress}
          />
        ) : (
          <div className="fallback-cinema">
            {PROJECTS.slice(0, 3).map((item, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className={`fallback-screen fallback-screen-${index + 1}`}
                key={item.number}
                src={item.image}
              />
            ))}
          </div>
        )}
        <div className="world-exposure" />
      </div>

      <section
        className="entry-screen"
        style={entryStyle}
        aria-hidden={entryPhase === "entered"}
      >
        <div className="entry-fragments" aria-hidden="true">
          {PROJECTS.slice(0, 3).map((item, index) => (
            <span
              className={`entry-fragment entry-fragment-${index + 1}`}
              key={item.number}
              style={{ backgroundImage: `url(${item.image})` }}
            />
          ))}
        </div>
        <p className="entry-meta">PORTFOLIO — 2026</p>
        <h1>AYUSH JHA</h1>
        <div className="entry-actions" data-ready={entryReady}>
          <button
            type="button"
            disabled={!entryReady || entryPhase !== "waiting"}
            onClick={() => void enter(true)}
          >
            ENTER WITH MUSIC
          </button>
          <button
            type="button"
            disabled={!entryReady || entryPhase !== "waiting"}
            onClick={() => void enter(false)}
          >
            ENTER SILENT
          </button>
        </div>
        <div className="loading-line" aria-label="Loading portfolio">
          <span />
        </div>
      </section>

      <header
        className={`site-nav ${chromeVisible ? "is-visible" : ""}`}
        aria-hidden={!chromeVisible}
      >
        <button
          className="nav-name"
          type="button"
          onClick={() => scrollToScene(LANDING_SCENE)}
          tabIndex={chromeVisible ? 0 : -1}
        >
          AYUSH JHA
        </button>
        <nav aria-label="Primary navigation">
          <button
            type="button"
            onClick={() => scrollToScene(projectIndexToScene(0))}
            tabIndex={chromeVisible ? 0 : -1}
          >
            WORK
          </button>
          <button
            type="button"
            onClick={() => scrollToScene(ABOUT_SCENE)}
            tabIndex={chromeVisible ? 0 : -1}
          >
            ABOUT
          </button>
          <button
            type="button"
            onClick={() => scrollToScene(CONTACT_SCENE)}
            tabIndex={chromeVisible ? 0 : -1}
          >
            EMAIL
          </button>
          <button
            className="sound-toggle"
            type="button"
            aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
            aria-pressed={soundEnabled}
            aria-busy={soundPending}
            disabled={soundPending}
            onClick={() => void toggleSound()}
            tabIndex={chromeVisible ? 0 : -1}
          >
            {soundEnabled ? "SOUND ON" : "SOUND OFF"}
          </button>
        </nav>
      </header>

      <section
        className={`scene-content hero-content ${
          heroVisible && journeyStarted ? "is-visible" : ""
        }`}
        aria-hidden={!heroVisible || !journeyStarted}
      >
        <div className="hero-title" aria-label="Ayush Jha">
          <span>AYUSH</span>
          <span>JHA</span>
        </div>
        <p className="hero-role">PRODUCT BUILDER / DEVELOPER</p>
        <button
          className="hero-scroll"
          type="button"
          onClick={() => scrollToScene(projectIndexToScene(0))}
          tabIndex={heroVisible && entryPhase === "entered" ? 0 : -1}
        >
          SCROLL TO ENTER <span aria-hidden="true">↓</span>
        </button>
      </section>

      <section
        className={`scene-content project-content ${
          projectVisible ? "is-visible" : ""
        }`}
        aria-hidden={!projectVisible}
      >
        {detailIndex !== null && (
          <button
            ref={backControlRef}
            type="button"
            className="back-control"
            onClick={closeProject}
            aria-label="Back to project journey"
          >
            <span aria-hidden="true">←</span> BACK
          </button>
        )}
        <div
          className="project-copy"
          key={`${project.number}-${detailIndex === null ? "chapter" : "detail"}`}
        >
          <span className="project-number">{project.number}</span>
          <div className="project-title-mask">
            <h2>PROJECT NAME</h2>
          </div>
          <div className="project-meta">
            <span>CATEGORY</span>
            <span>YEAR</span>
            {detailIndex === null ? (
              <a
                ref={viewLinkRef}
                href={`/project/${project.number}`}
                onClick={(event) => {
                  event.preventDefault();
                  openProject(visibleProjectIndex);
                }}
              >
                VIEW PROJECT
              </a>
            ) : (
              <span>CASE STUDY</span>
            )}
          </div>
        </div>
        <div className="project-light-sweep" aria-hidden="true" />
      </section>

      <section
        className={`scene-content about-content ${
          detailIndex === null && activeScene === ABOUT_SCENE
            ? "is-visible"
            : ""
        }`}
        aria-hidden={detailIndex !== null || activeScene !== ABOUT_SCENE}
      >
        <p className="scene-kicker">ABOUT</p>
        <p className="about-line">
          I build thoughtful products and interactive systems.
        </p>
        <ul>
          <li>PRODUCT ENGINEERING</li>
          <li>AI SYSTEMS</li>
          <li>INTERACTIVE FRONTEND</li>
        </ul>
        <span className="resume-link">RÉSUMÉ</span>
      </section>

      <section
        className={`scene-content contact-content ${
          detailIndex === null && activeScene === CONTACT_SCENE
            ? "is-visible"
            : ""
        }`}
        aria-hidden={detailIndex !== null || activeScene !== CONTACT_SCENE}
      >
        <h2>LET’S BUILD SOMETHING.</h2>
        <div className="contact-links">
          <span>EMAIL</span>
          <span>GITHUB</span>
          <span>LINKEDIN</span>
        </div>
      </section>

      <div className="chapter-indicator" aria-hidden="true">
        {activeScene === LANDING_SCENE
          ? "PROLOGUE"
          : isProjectScene(activeScene)
            ? `CHAPTER ${String(activeScene).padStart(2, "0")}`
            : activeScene === ABOUT_SCENE
              ? "INTERMISSION"
              : "EPILOGUE"}
      </div>

      <div className="scroll-track" aria-hidden="true">
        {Array.from({ length: TOTAL_SCENES }, (_, index) => (
          <div
            className="scroll-panel"
            key={index === 0 ? "Prologue" : projectScenes[index - 1] ?? index}
          />
        ))}
      </div>
    </main>
  );
}
