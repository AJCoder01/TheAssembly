"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useAudio } from "../src/audio/AudioProvider";
import { CORRIDOR_MOTION, LAST_SCENE } from "./motionStore";
import { PROJECTS } from "./projectData";

const WebGLStage = dynamic(
  () => import("./WebGLStage").then((module) => module.WebGLStage),
  { ssr: false },
);

type EntryPhase = "loading" | "ready" | "opening" | "entered";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
};

const FILM_ROWS = [
  [2, 0, 1, 3, 0, 2, 1, 3],
  [1, 3, 0, 2, 3, 1, 0, 2],
  [3, 2, 1, 0, 2, 0, 3, 1],
] as const;

const FRAME_TOTAL = 148;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const projectScene = (index: number) => index + 1;

export function HomeExperience() {
  const router = useRouter();
  const {
    audioReady,
    duckForProject,
    enter,
    entered,
    playEffect,
    setMusicAtmosphere,
  } = useAudio();
  const [activeScene, setActiveScene] = useState(0);
  const [fontReady, setFontReady] = useState(false);
  const [mediaReady, setMediaReady] = useState<boolean[]>(() =>
    PROJECTS.map(() => false),
  );
  const [stageReady, setStageReady] = useState(false);
  const [stageFailed, setStageFailed] = useState(false);
  const [phase, setPhase] = useState<EntryPhase>(
    entered ? "entered" : "loading",
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [debugProgress, setDebugProgress] = useState<number | null>(null);
  const [openingProject, setOpeningProject] = useState<number | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [indexProject, setIndexProject] = useState(0);
  const restoredRef = useRef(false);
  const openingTimerRef = useRef<number | null>(null);
  const activeSceneRef = useRef(0);
  const indexCloseRef = useRef<HTMLButtonElement>(null);

  const criticalReady = useMemo(
    () => [
      audioReady,
      fontReady,
      stageReady || stageFailed,
      ...mediaReady,
    ],
    [audioReady, fontReady, mediaReady, stageFailed, stageReady],
  );
  const naturalProgress =
    criticalReady.filter(Boolean).length / criticalReady.length;
  const loadProgress = debugProgress ?? naturalProgress;
  const entryReady = loadProgress >= 1;
  const frameNumber = Math.max(1, Math.round(loadProgress * FRAME_TOTAL));

  const markMediaReady = useCallback((index: number) => {
    setMediaReady((current) => {
      if (current[index]) return current;
      const next = [...current];
      next[index] = true;
      return next;
    });
  }, []);

  const handleStageReady = useCallback(() => setStageReady(true), []);
  const handleStageFailure = useCallback(() => {
    setStageFailed(true);
    setStageReady(true);
  }, []);

  useEffect(() => {
    CORRIDOR_MOTION.routeTransition = 0;
    CORRIDOR_MOTION.indexOpen = false;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const localReviewParams = new URLSearchParams(window.location.search);
    const forcedReducedMotion =
      window.location.hostname === "localhost" &&
      localReviewParams.get("motion") === "reduce";
    const updateEnvironment = () => {
      const nextReducedMotion = forcedReducedMotion || motionQuery.matches;
      setReducedMotion(nextReducedMotion);
      setIsMobile(mobileQuery.matches);
      CORRIDOR_MOTION.reducedMotion = nextReducedMotion;
      CORRIDOR_MOTION.mobile = mobileQuery.matches;
      if (nextReducedMotion) setStageReady(true);
    };
    updateEnvironment();
    motionQuery.addEventListener("change", updateEnvironment);
    mobileQuery.addEventListener("change", updateEnvironment);

    const requestedProgress = localReviewParams.get("loader");
    const requestedEntry =
      window.location.hostname === "localhost" &&
      localReviewParams.get("entry") === "silent";
    if (requestedEntry) {
      CORRIDOR_MOTION.entered = true;
      window.queueMicrotask(() => setPhase("entered"));
    }
    if (
      window.location.hostname === "localhost" &&
      requestedProgress !== null &&
      !requestedEntry
    ) {
      const requested = Number(requestedProgress);
      if (Number.isFinite(requested)) {
        window.queueMicrotask(() => {
          setDebugProgress(clamp(requested / 100, 0, 1));
          setPhase(requested >= 100 ? "ready" : "loading");
        });
      }
    } else if (window.sessionStorage.getItem("ayush:entered") === "true") {
      CORRIDOR_MOTION.entered = true;
      window.queueMicrotask(() => setPhase("entered"));
    }

    void document.fonts.ready.then(() => setFontReady(true));
    return () => {
      motionQuery.removeEventListener("change", updateEnvironment);
      mobileQuery.removeEventListener("change", updateEnvironment);
    };
  }, []);

  useEffect(() => {
    if (phase !== "loading" || !entryReady) return;
    const frame = window.requestAnimationFrame(() => setPhase("ready"));
    return () => window.cancelAnimationFrame(frame);
  }, [entryReady, phase]);

  useEffect(() => {
    const locked = phase !== "entered" || indexOpen;
    const navVisible =
      phase === "entered" && (activeScene >= 1 || isMobile || indexOpen);
    document.documentElement.classList.toggle("entry-locked", locked);
    document.documentElement.classList.toggle(
      "entry-transitioning",
      phase === "opening",
    );
    document.documentElement.classList.toggle(
      "archive-navigation-visible",
      navVisible,
    );
    document.documentElement.classList.toggle("archive-index-open", indexOpen);
    CORRIDOR_MOTION.indexOpen = indexOpen;
    if (indexOpen) window.requestAnimationFrame(() => indexCloseRef.current?.focus());
    return () => {
      document.documentElement.classList.remove("entry-locked");
      document.documentElement.classList.remove("entry-transitioning");
      document.documentElement.classList.remove("archive-navigation-visible");
      document.documentElement.classList.remove("archive-index-open");
      CORRIDOR_MOTION.indexOpen = false;
    };
  }, [activeScene, indexOpen, isMobile, phase]);

  useEffect(() => {
    if (!indexOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndexOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [indexOpen]);

  useEffect(() => {
    setMusicAtmosphere(activeScene === 5 ? "distant" : "normal");
  }, [activeScene, setMusicAtmosphere]);

  useEffect(() => {
    if (phase !== "entered") return;
    CORRIDOR_MOTION.routeTransition = 0;
    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.lagSmoothing(0);
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const useNative = isMobile || !finePointer || reducedMotion;

    const updateMotion = (scrollTop: number, velocity = 0) => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = clamp((scrollTop / maxScroll) * LAST_SCENE, 0, LAST_SCENE);
      CORRIDOR_MOTION.progress = progress;
      CORRIDOR_MOTION.velocity = velocity;
      const nextScene = Math.round(progress);
      CORRIDOR_MOTION.activeScene = nextScene;
      if (nextScene !== activeSceneRef.current) {
        activeSceneRef.current = nextScene;
        setActiveScene(nextScene);
        if (nextScene >= 1 && nextScene <= 4) void playEffect("focus");
        if (nextScene === 5) void playEffect("shutdown");
      }
    };

    let lenis: Lenis | null = null;
    let ticker: ((time: number) => void) | null = null;
    const handleNativeScroll = () => updateMotion(window.scrollY);

    if (useNative) {
      window.addEventListener("scroll", handleNativeScroll, { passive: true });
      updateMotion(window.scrollY);
    } else {
      lenis = new Lenis({
        lerp: 0.105,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.92,
        touchMultiplier: 1,
      });
      lenis.on("scroll", ({ scroll, velocity }) => {
        updateMotion(scroll, velocity);
        ScrollTrigger.update();
      });
      ticker = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(ticker);
      updateMotion(window.scrollY);
    }

    const handlePointer = (event: PointerEvent) => {
      if (useNative || CORRIDOR_MOTION.indexOpen) return;
      CORRIDOR_MOTION.pointerX = event.clientX / window.innerWidth - 0.5;
      CORRIDOR_MOTION.pointerY = event.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", handlePointer, { passive: true });

    const storedScroll = Number(
      window.sessionStorage.getItem("ayush:home-scroll"),
    );
    if (!restoredRef.current && Number.isFinite(storedScroll) && storedScroll > 0) {
      restoredRef.current = true;
      window.requestAnimationFrame(() => {
        window.scrollTo(0, storedScroll);
        updateMotion(storedScroll);
      });
    }

    return () => {
      if (ticker) gsap.ticker.remove(ticker);
      lenis?.destroy();
      window.removeEventListener("scroll", handleNativeScroll);
      window.removeEventListener("pointermove", handlePointer);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [isMobile, phase, playEffect, reducedMotion]);

  useEffect(
    () => () => {
      if (openingTimerRef.current !== null) {
        window.clearTimeout(openingTimerRef.current);
      }
    },
    [],
  );

  const chooseEntry = useCallback(
    async (withSound: boolean) => {
      if (!entryReady || phase === "opening") return;
      setPhase("opening");
      CORRIDOR_MOTION.entered = true;
      await enter(withSound);
      if (withSound) {
        void playEffect("filmThread");
        void playEffect("frameStop");
        window.setTimeout(() => void playEffect("projectorStart"), 360);
      }
      openingTimerRef.current = window.setTimeout(() => {
        setPhase("entered");
        openingTimerRef.current = null;
      }, reducedMotion ? 180 : 1260);
    },
    [enter, entryReady, phase, playEffect, reducedMotion],
  );

  const openProject = useCallback(
    (index: number, event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      const project = PROJECTS[index];
      window.sessionStorage.setItem(
        "ayush:home-scroll",
        window.scrollY.toFixed(2),
      );
      window.sessionStorage.setItem("ayush:return-project", project.number);
      setOpeningProject(index);
      CORRIDOR_MOTION.routeTransition = 1;
      duckForProject();
      void playEffect("projectEnter");

      openingTimerRef.current = window.setTimeout(() => {
        const navigate = () => router.push(`/project/${project.number}`);
        const transitionDocument = document as ViewTransitionDocument;
        if (
          !reducedMotion &&
          typeof transitionDocument.startViewTransition === "function"
        ) {
          transitionDocument.startViewTransition(navigate);
        } else {
          navigate();
        }
        openingTimerRef.current = null;
      }, reducedMotion ? 80 : 620);
    },
    [duckForProject, playEffect, reducedMotion, router],
  );

  const jumpToProject = useCallback((index: number) => {
    setIndexOpen(false);
    const target = document.getElementById(
      `project-${PROJECTS[index].number}`,
    );
    window.requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, []);

  const archiveStyle = {
    "--load-progress": loadProgress.toFixed(4),
    "--frame-progress": `${frameNumber}`,
    "--project-accent":
      activeScene >= 1 && activeScene <= 4
        ? PROJECTS[activeScene - 1].accent
        : "#f0eee7",
  } as CSSProperties;

  return (
    <main
      id="main-content"
      className={`experience projection-experience phase-${phase} scene-${activeScene}`}
      style={archiveStyle}
    >
      {!reducedMotion && !stageFailed ? (
        <WebGLStage
          onFailure={handleStageFailure}
          onReady={handleStageReady}
        />
      ) : (
        <div className="reduced-gallery" aria-hidden="true">
          {PROJECTS.map((project, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={project.number}
              src={project.image}
              alt=""
              className={
                activeScene === projectScene(index) ||
                (index === 0 && activeScene === 0)
                  ? "is-visible"
                  : ""
              }
            />
          ))}
        </div>
      )}

      <div className="film-loader" aria-hidden={phase === "entered"}>
        <div className="film-loader__identity">
          <span>AYUSH JHA</span>
          <span>PORTFOLIO / 2026</span>
        </div>
        <div className="film-loader__strips" aria-hidden="true">
          {FILM_ROWS.map((row, rowIndex) => (
            <div
              className="film-strip"
              key={rowIndex}
              style={{ "--strip-row": rowIndex } as CSSProperties}
            >
              <div className="film-strip__track">
                {row.map((projectIndex, frameIndex) => (
                  <div className="film-frame" key={`${rowIndex}-${frameIndex}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={PROJECTS[projectIndex].image} alt="" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="film-loader__selected" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PROJECTS[0].image} alt="" />
        </div>
        <output className="film-loader__counter" aria-label="Loading progress">
          {String(frameNumber).padStart(3, "0")} / {FRAME_TOTAL}
        </output>
        <div className="film-loader__entry" aria-hidden={!entryReady}>
          <button
            type="button"
            disabled={!entryReady}
            onClick={() => void chooseEntry(true)}
          >
            ENTER WITH SOUND
          </button>
          <button
            type="button"
            disabled={!entryReady}
            onClick={() => void chooseEntry(false)}
          >
            ENTER SILENT
          </button>
        </div>
        <div className="critical-preloads" aria-hidden="true">
          {PROJECTS.map((project, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={project.number}
              src={project.image}
              alt=""
              onLoad={() => markMediaReady(index)}
              onError={() => markMediaReady(index)}
            />
          ))}
        </div>
      </div>

      <nav
        className={`archive-nav ${
          phase === "entered" && (activeScene >= 1 || isMobile || indexOpen)
            ? "is-visible"
            : ""
        }`}
        aria-label="Portfolio navigation"
      >
        <a href="#hero-scroll-point">AYUSH JHA</a>
        <div>
          <button
            type="button"
            aria-expanded={indexOpen}
            aria-controls="archive-index"
            onClick={() => setIndexOpen(true)}
          >
            INDEX
          </button>
          <a href="#about">ABOUT</a>
          <a href="mailto:ayushwork2401@gmail.com">EMAIL</a>
        </div>
      </nav>

      <section
        id="archive-index"
        className={`archive-index ${indexOpen ? "is-open" : ""}`}
        aria-hidden={!indexOpen}
        aria-labelledby="archive-index-title"
      >
        <header>
          <h2 id="archive-index-title">PROJECT INDEX</h2>
          <button
            ref={indexCloseRef}
            type="button"
            tabIndex={indexOpen ? 0 : -1}
            onClick={() => setIndexOpen(false)}
          >
            CLOSE
          </button>
        </header>
        <div className="archive-index__preview" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PROJECTS[indexProject].image} alt="" />
          <span>{PROJECTS[indexProject].number}</span>
        </div>
        <ol>
          {PROJECTS.map((project, index) => (
            <li className={indexProject === index ? "is-active" : ""} key={project.number}>
              <button
                type="button"
                tabIndex={indexOpen ? 0 : -1}
                onMouseEnter={() => setIndexProject(index)}
                onFocus={() => setIndexProject(index)}
                onClick={() => jumpToProject(index)}
              >
                <span>{project.number}</span>
                <strong>{project.title}</strong>
                <small>{project.category}</small>
                <time>{project.year}</time>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <div className="scene-overlay">
        <section
          id="hero"
          className={`corridor-scene hero-scene ${
            activeScene === 0 ? "is-active" : ""
          }`}
          aria-labelledby="hero-title"
        >
          <p className="hero-role">PRODUCT BUILDER / DEVELOPER</p>
          <h1 id="hero-title">
            <span className="hero-title__front">AYUSH</span>
            <span className="hero-title__back">JHA</span>
          </h1>
          <div className="hero-projection-mask" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PROJECTS[0].image} alt="" />
          </div>
          <p className="hero-scroll">SCROLL TO EXPLORE</p>
        </section>

        {PROJECTS.map((project, index) => {
          const scene = projectScene(index);
          const active = activeScene === scene;
          return (
            <section
              className={`corridor-scene project-chapter project-chapter-${project.number} ${
                active ? "is-active" : ""
              }`}
              key={project.number}
              aria-labelledby={`project-${project.number}-title`}
            >
              <div className="project-chapter__meta">
                <span>{project.number}</span>
                <h2 id={`project-${project.number}-title`}>{project.title}</h2>
                <p>{project.category}</p>
                <time>{project.year}</time>
                <a
                  href={`/project/${project.number}`}
                  tabIndex={active ? 0 : -1}
                  onClick={(event) => openProject(index, event)}
                >
                  VIEW PROJECT
                </a>
              </div>
              <div className="chapter-motif" aria-hidden="true">
                {project.number === "01" ? (
                  <>
                    <i />
                    <i />
                    <i />
                    <i />
                  </>
                ) : null}
                {project.number === "02" ? (
                  <>
                    <b />
                    <b />
                    <b />
                  </>
                ) : null}
                {project.number === "03" ? (
                  <>
                    <em />
                    <em />
                    <em />
                    <em />
                  </>
                ) : null}
                {project.number === "04" ? (
                  <>
                    <span />
                    <span />
                    <span />
                    <span />
                  </>
                ) : null}
              </div>
              <a
                className="project-dom-equivalent"
                href={`/project/${project.number}`}
                tabIndex={-1}
                aria-hidden="true"
                onClick={(event) => openProject(index, event)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={project.image} alt="" />
              </a>
            </section>
          );
        })}

        <section
          className={`corridor-scene about-scene ${
            activeScene === 5 ? "is-active" : ""
          }`}
          aria-labelledby="about-title"
        >
          <p>ABOUT</p>
          <h2 id="about-title">
            I build products that make complex systems easier to understand and
            control.
          </h2>
          <ul>
            <li>PRODUCT ENGINEERING</li>
            <li>AI SYSTEMS</li>
            <li>INTERACTIVE FRONTEND</li>
          </ul>
          <span aria-label="Résumé available on request">RÉSUMÉ</span>
        </section>

        <section
          id="contact"
          className={`corridor-scene contact-scene ${
            activeScene === 6 ? "is-active" : ""
          }`}
          aria-labelledby="contact-title"
        >
          <h2 id="contact-title">LET’S BUILD SOMETHING.</h2>
          <div>
            <a href="mailto:ayushwork2401@gmail.com">EMAIL</a>
            <a
              href="https://github.com/AJCoder01"
              target="_blank"
              rel="noreferrer"
            >
              GITHUB
            </a>
            <span>LINKEDIN</span>
          </div>
        </section>
      </div>

      <div className="scroll-corridor" aria-hidden="true">
        {Array.from({ length: LAST_SCENE + 1 }, (_, index) => (
          <div
            id={
              index >= 1 && index <= 4
                ? `project-${PROJECTS[index - 1].number}`
                : index === 5
                  ? "about"
                  : index === 6
                    ? "contact-scroll-point"
                    : "hero-scroll-point"
            }
            className="scroll-corridor__chapter"
            key={index}
          />
        ))}
      </div>

      {openingProject !== null ? (
        <div className="route-proxy" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PROJECTS[openingProject].image}
            alt=""
            style={
              {
                viewTransitionName: `project-${PROJECTS[openingProject].number}`,
              } as CSSProperties
            }
          />
        </div>
      ) : null}
    </main>
  );
}
