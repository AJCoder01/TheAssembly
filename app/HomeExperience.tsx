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
  } = useAudio();
  const [activeScene, setActiveScene] = useState(0);
  const [fontReady, setFontReady] = useState(false);
  const [heroImageReady, setHeroImageReady] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  const [stageFailed, setStageFailed] = useState(false);
  const [phase, setPhase] = useState<EntryPhase>(
    entered ? "entered" : "loading",
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [debugProgress, setDebugProgress] = useState<number | null>(null);
  const [openingProject, setOpeningProject] = useState<number | null>(null);
  const restoredRef = useRef(false);
  const openingTimerRef = useRef<number | null>(null);
  const activeSceneRef = useRef(0);

  const criticalReady = useMemo(
    () => [audioReady, fontReady, heroImageReady, stageReady || stageFailed],
    [audioReady, fontReady, heroImageReady, stageFailed, stageReady],
  );
  const naturalProgress =
    criticalReady.filter(Boolean).length / criticalReady.length;
  const loadProgress = debugProgress ?? naturalProgress;
  const entryReady = loadProgress >= 1;
  const percentage = Math.round(loadProgress * 100);

  useEffect(() => {
    CORRIDOR_MOTION.routeTransition = 0;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      const forcedReducedMotion =
        window.location.hostname === "localhost" &&
        new URLSearchParams(window.location.search).get("motion") === "reduce";
      const nextReducedMotion = forcedReducedMotion || motionQuery.matches;
      setReducedMotion(nextReducedMotion);
      CORRIDOR_MOTION.reducedMotion = nextReducedMotion;
      if (nextReducedMotion) setStageReady(true);
    };
    updateMotion();
    motionQuery.addEventListener("change", updateMotion);

    const localReviewParams = new URLSearchParams(window.location.search);
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
    return () => motionQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    if (phase !== "loading" || !entryReady) return;
    const frame = window.requestAnimationFrame(() => setPhase("ready"));
    return () => window.cancelAnimationFrame(frame);
  }, [entryReady, phase]);

  useEffect(() => {
    const locked = phase !== "entered";
    document.documentElement.classList.toggle("entry-locked", locked);
    document.documentElement.classList.toggle(
      "entry-transitioning",
      phase === "opening",
    );
    return () => {
      document.documentElement.classList.remove("entry-locked");
      document.documentElement.classList.remove("entry-transitioning");
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "entered") return;
    CORRIDOR_MOTION.routeTransition = 0;
    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.lagSmoothing(0);
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const mobile = window.innerWidth < 768;
    const useNative = mobile || !finePointer || reducedMotion;
    CORRIDOR_MOTION.mobile = mobile;
    CORRIDOR_MOTION.reducedMotion = reducedMotion;

    const updateMotion = (scrollTop: number, velocity = 0) => {
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = clamp((scrollTop / maxScroll) * LAST_SCENE, 0, LAST_SCENE);
      CORRIDOR_MOTION.progress = progress;
      CORRIDOR_MOTION.velocity = velocity;
      const nextScene = Math.round(progress);
      if (nextScene !== activeSceneRef.current) {
        activeSceneRef.current = nextScene;
        setActiveScene(nextScene);
        if (nextScene >= 1 && nextScene <= 4) void playEffect("focus");
        if (nextScene === LAST_SCENE) void playEffect("contact");
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
        lerp: 0.085,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.9,
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
      if (useNative) return;
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
  }, [phase, playEffect, reducedMotion]);

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
        void playEffect("enter");
        void playEffect("aperture");
      }
      openingTimerRef.current = window.setTimeout(() => {
        setPhase("entered");
        openingTimerRef.current = null;
      }, reducedMotion ? 180 : 1120);
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

  const apertureStyle = {
    "--load-progress": loadProgress.toFixed(4),
    "--load-percent": `${percentage}%`,
  } as CSSProperties;

  return (
    <main
      id="main-content"
      className={`experience memory-experience phase-${phase}`}
      style={apertureStyle}
    >
      {!reducedMotion && !stageFailed ? (
        <WebGLStage
          onFailure={() => {
            setStageFailed(true);
            setStageReady(true);
          }}
          onReady={() => setStageReady(true)}
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

      <div className="loader" aria-hidden={phase === "entered"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="loader__background"
          src={PROJECTS[0].image}
          alt=""
          onLoad={() => setHeroImageReady(true)}
        />
        <div className="loader__veil" aria-hidden="true" />
        <div className="loader__aperture" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PROJECTS[0].image} alt="" />
        </div>
        <div className="loader__fragments" aria-hidden="true">
          {PROJECTS.slice(1).map((project, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={project.number}
              src={project.image}
              alt=""
              style={{ "--fragment-index": index } as CSSProperties}
            />
          ))}
        </div>
        <div className="loader__identity">
          <span>AYUSH JHA</span>
          <span>PORTFOLIO / 2026</span>
        </div>
        <span className="loader__status">
          {entryReady ? "EXPERIENCE READY" : "LOADING EXPERIENCE"}
        </span>
        <output className="loader__progress" aria-label="Loading progress">
          {String(percentage).padStart(2, "0")}
        </output>
        <div
          className="loader__entry"
          aria-hidden={!entryReady}
        >
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
      </div>

      <nav
        className={`corridor-nav ${activeScene >= 1 ? "is-visible" : ""}`}
        aria-label="Portfolio"
      >
        <a href="#hero-scroll-point">AYUSH JHA</a>
        <span>{String(activeScene).padStart(2, "0")} / 06</span>
        <a href="#contact-scroll-point">CONTACT</a>
      </nav>

      <div className="scene-overlay">
        <section
          id="hero"
          className={`corridor-scene hero-scene ${
            activeScene === 0 ? "is-active" : ""
          }`}
          aria-labelledby="hero-title"
        >
          <p className="hero-role">Developer / Product Builder</p>
          <h1 id="hero-title">
            <span>AYUSH</span>
            <span>JHA</span>
          </h1>
          <p className="hero-scroll">SCROLL TO ENTER</p>
        </section>

        {PROJECTS.map((project, index) => {
          const scene = projectScene(index);
          const active = activeScene === scene;
          return (
            <section
              className={`corridor-scene project-scene project-scene-${project.number} ${
                active ? "is-active" : ""
              }`}
              key={project.number}
              aria-labelledby={`project-${project.number}-title`}
            >
              <div className="project-scene__copy">
                <span className="project-scene__number">{project.number}</span>
                <h2 id={`project-${project.number}-title`}>
                  {project.title}
                </h2>
                <p>{project.category}</p>
                <div>
                  <span>{project.year}</span>
                  <a
                    href={`/project/${project.number}`}
                    tabIndex={active ? 0 : -1}
                    onClick={(event) => openProject(index, event)}
                  >
                    OPEN PROJECT
                  </a>
                </div>
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
            I build products that make complex systems clearer.
          </h2>
          <ul>
            <li>PRODUCT ENGINEERING</li>
            <li>AI SYSTEMS</li>
            <li>INTERACTIVE FRONTEND</li>
          </ul>
          <span>RÉSUMÉ</span>
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
