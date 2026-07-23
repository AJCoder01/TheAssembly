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

type EntryPhase = "waiting" | "leaving" | "entered";

type PortfolioExperienceProps = {
  initialProjectNumber?: string;
};

class SoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  async enable() {
    const WebkitAudioContext = (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
    const AudioContextConstructor = window.AudioContext || WebkitAudioContext;
    if (!AudioContextConstructor) return false;

    if (!this.context) {
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.master.gain.setValueAtTime(0.0001, this.context.currentTime);
      this.master.connect(this.context.destination);
      this.noise = this.createNoiseBuffer(1.4);
    }
    if (this.context.state === "suspended") await this.context.resume();
    this.fadeTo(0.72, 0.42);
    return true;
  }

  fadeTo(value: number, duration: number) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
    gain.exponentialRampToValueAtTime(
      Math.max(value, 0.0001),
      now + Math.max(duration, 0.02),
    );
  }

  playTick(pan = 0) {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

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

    oscillator.connect(filter).connect(gain).connect(panner).connect(master);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }

  playGlass(pan = 0) {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const now = context.currentTime;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    panner.connect(master);

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
    const master = this.master;
    if (!context || !master) return;

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
    oscillator.connect(lowGain).connect(compressor).connect(master);
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
        .connect(master);
      source.start(now, 0, 0.44);
    }
  }

  playSweep(direction = 1) {
    const context = this.context;
    const master = this.master;
    if (!context || !master || !this.noise) return;

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
      .connect(master);
    source.start(now, 0, 0.76);
  }

  suspend() {
    this.fadeTo(0.0001, 0.16);
  }

  dispose() {
    this.fadeTo(0.0001, 0.08);
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.noise = null;
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

export function PortfolioExperience({
  initialProjectNumber,
}: PortfolioExperienceProps = {}) {
  const serverProjectIndex = findProjectIndex(initialProjectNumber);
  const [entryPhase, setEntryPhase] = useState<EntryPhase>("waiting");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeScene, setActiveScene] = useState(
    serverProjectIndex >= 0 ? serverProjectIndex : 0,
  );
  const [detailIndex, setDetailIndex] = useState<number | null>(
    serverProjectIndex >= 0 ? serverProjectIndex : null,
  );
  const [webglFailed, setWebglFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const soundRef = useRef<SoundEngine | null>(null);
  const lastSceneRef = useRef(0);
  const entryTimerRef = useRef<number | null>(null);
  const entryLockedRef = useRef(false);

  const activeProject = Math.min(activeScene, PROJECTS.length - 1);
  const project = PROJECTS[detailIndex ?? activeProject];

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
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

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
      const viewport = Math.max(window.innerHeight, 1);
      const nextScene = Math.max(
        0,
        Math.min(5, Math.floor((window.scrollY + viewport * 0.46) / viewport)),
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
  }, []);

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
        typeof stateProject === "number"
          ? stateProject
          : routeIndex >= 0
            ? routeIndex
            : null;
      setDetailIndex(next);
    };
    onPopState(new PopStateEvent("popstate", { state: window.history.state }));
    const initialIndex = getLocationProjectIndex();
    if (initialIndex >= 0) {
      alignmentFrame = window.requestAnimationFrame(() => {
        window.scrollTo(0, initialIndex * window.innerHeight);
        setActiveScene(initialIndex);
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
    if (soundEnabled && engine) {
      if (activeScene < 4) {
        const direction = Math.sign(activeScene - previousScene) || 1;
        engine.playTick((activeScene / 3 - 0.5) * 1.15);
        if (Math.abs(activeScene - previousScene) > 1) {
          engine.playSweep(direction);
        }
        engine.fadeTo(0.72, 0.5);
      } else if (activeScene === 4) {
        engine.playSweep(1);
        engine.fadeTo(0.58, 0.8);
      } else {
        engine.playImpact(0.62);
        engine.fadeTo(0.0001, 1.9);
      }
    }
    lastSceneRef.current = activeScene;
  }, [activeScene, detailIndex, entryPhase, soundEnabled]);

  useEffect(() => {
    const onVisibility = () => {
      const engine = soundRef.current;
      if (!engine || !soundEnabled) return;
      if (document.hidden) engine.suspend();
      else engine.fadeTo(activeScene === 5 ? 0.0001 : 0.72, 0.45);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeScene, soundEnabled]);

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
      () => setEntryPhase("entered"),
      reducedMotion ? 220 : 760,
    );

    if (withSound) {
      try {
        const enabled = await soundRef.current?.enable();
        if (enabled) {
          setSoundEnabled(true);
          soundRef.current?.playImpact(0.9);
          soundRef.current?.playSweep(1);
        }
      } catch {
        setSoundEnabled(false);
      }
    }
  };

  const toggleSound = async () => {
    const engine = soundRef.current;
    if (!engine) return;
    if (soundEnabled) {
      engine.fadeTo(0.0001, 0.3);
      setSoundEnabled(false);
      return;
    }

    try {
      const enabled = await engine.enable();
      if (enabled) {
        setSoundEnabled(true);
        engine.playGlass(0.55);
      }
    } catch {
      engine.fadeTo(0.0001, 0.1);
      setSoundEnabled(false);
    }
  };

  const scrollToScene = (index: number) => {
    const next = Math.max(0, Math.min(5, index));
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
    if (soundEnabled) {
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
    if (soundEnabled) {
      soundRef.current?.playSweep(-1);
      soundRef.current?.playGlass(-0.4);
    }
  }

  const sceneClass =
    activeScene < 4 ? "projects" : activeScene === 4 ? "about" : "contact";
  const isEnding = entryPhase === "entered" && activeScene === 5;

  return (
    <main
      className={`experience scene-${sceneClass} ${
        detailIndex !== null ? "is-detail" : ""
      } ${entryPhase === "entered" ? "is-entered" : ""} ${
        reducedMotion ? "is-reduced-motion" : ""
      }`}
    >
      <div className="fixed-world" aria-hidden={entryPhase !== "entered"}>
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
        {webglFailed && (
          <div className="fallback-media" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.image} alt="" />
          </div>
        )}
        <div className="world-vignette" />
      </div>

      <div
        className={`entry-screen entry-${entryPhase}`}
        aria-hidden={entryPhase === "entered"}
      >
        <div className="entry-identity">
          <h1>AYUSH</h1>
          <p>Developer / Product Builder</p>
        </div>
        <div className="entry-actions">
          <button type="button" onClick={() => void enter(true)}>
            Enter with sound
          </button>
          <button type="button" onClick={() => void enter(false)}>
            Enter muted
          </button>
        </div>
      </div>

      <div className="site-chrome" aria-hidden={entryPhase !== "entered"}>
        <nav
          className="scene-rail"
          aria-label="Scene navigation"
          aria-hidden={detailIndex !== null || activeScene === 5}
        >
          {sceneLabels.map((label, index) => (
            <button
              className={
                (detailIndex ?? activeScene) === index ? "is-active" : ""
              }
              type="button"
              key={label}
              onClick={() => scrollToScene(index)}
              tabIndex={detailIndex !== null || activeScene === 5 ? -1 : 0}
              aria-label={label}
              aria-current={
                (detailIndex ?? activeScene) === index ? "step" : undefined
              }
            >
              <span />
            </button>
          ))}
        </nav>

        <button
          className={`sound-control ${soundEnabled ? "is-on" : "is-off"}`}
          type="button"
          onClick={() => void toggleSound()}
          aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
          aria-pressed={soundEnabled}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div
        className={`scene-content project-content ${
          activeScene < 4 ? "is-visible" : ""
        }`}
        aria-hidden={activeScene >= 4 || entryPhase !== "entered"}
      >
        {detailIndex !== null && (
          <button
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
              href={`/project/${project.number}`}
              tabIndex={
                entryPhase === "entered" && activeScene < 4 ? 0 : -1
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
          activeScene === 4 ? "is-visible" : ""
        }`}
        aria-hidden={activeScene !== 4 || entryPhase !== "entered"}
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
