"use client";

import gsap from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useAudio } from "../src/audio/AudioProvider";
import { PROJECTS } from "./projectData";

type LoaderPhase =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "WAITING_FOR_ENTRY"
  | "ENTERING"
  | "COMPLETE";

type LoaderEvent =
  | { type: "BEGIN" }
  | { type: "ASSETS_READY" }
  | { type: "REVEAL_ENTRY" }
  | { type: "ENTER" }
  | { type: "FINISH" }
  | { type: "RESTORE" }
  | { type: "DEBUG_LOADING" };

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const FRAME_TOTAL = 124;
const CRITICAL_ASSETS = [
  PROJECTS[0].image,
  PROJECTS[1].image,
] as const;

const CONTACT_FRAMES = [
  { project: 0, media: 0, kind: "dominant" },
  { project: 1, media: 1, kind: "medium" },
  { project: 2, media: 2, kind: "wide" },
  { project: 3, media: 1, kind: "narrow" },
  { project: 2, media: 0, kind: "medium" },
  { project: 0, media: 1, kind: "narrow" },
  { project: 3, media: 2, kind: "wide" },
  { project: 1, media: 0, kind: "medium" },
  { project: 0, media: 2, kind: "wide" },
  { project: 2, media: 1, kind: "medium" },
  { project: 1, media: 2, kind: "narrow" },
  { project: 3, media: 0, kind: "medium" },
  { project: 0, media: 0, kind: "dark" },
  { project: 2, media: 0, kind: "dark" },
  { project: 1, media: 1, kind: "medium" },
  { project: 3, media: 1, kind: "narrow" },
] as const;

function loaderReducer(phase: LoaderPhase, event: LoaderEvent): LoaderPhase {
  if (event.type === "RESTORE") return "COMPLETE";
  if (event.type === "DEBUG_LOADING") return "LOADING";
  if (phase === "IDLE" && event.type === "BEGIN") return "LOADING";
  if (phase === "LOADING" && event.type === "ASSETS_READY") return "READY";
  if (phase === "READY" && event.type === "REVEAL_ENTRY") {
    return "WAITING_FOR_ENTRY";
  }
  if (phase === "WAITING_FOR_ENTRY" && event.type === "ENTER") {
    return "ENTERING";
  }
  if (phase === "ENTERING" && event.type === "FINISH") return "COMPLETE";
  return phase;
}

function StageVisual({ index }: { index: number }) {
  const project = PROJECTS[index];
  if (project.slug === "toc-oracle") {
    return (
      <div className="stage-motif stage-motif--oracle" aria-hidden="true">
        <span className="state-node state-node--a">q0</span>
        <span className="state-path state-path--a" />
        <span className="state-node state-node--b">q1</span>
        <span className="state-path state-path--b" />
        <span className="state-node state-node--c">q✓</span>
      </div>
    );
  }
  if (project.slug === "rewind") {
    return (
      <div className="stage-motif stage-motif--rewind" aria-hidden="true">
        <span>APPROVED</span>
        <i />
        <i />
        <i />
        <span>REPAIRED</span>
      </div>
    );
  }
  if (project.slug === "asim-tracker") {
    return (
      <div className="stage-motif stage-motif--asim" aria-hidden="true">
        <span>FinBERT +0.78</span>
        <span>OBI 0.42</span>
        <span>RISK 1-SPARSE</span>
        <span>NIFTY 50</span>
        <span>ONNX</span>
      </div>
    );
  }
  return (
    <div className="stage-motif stage-motif--vscode" aria-hidden="true">
      {project.gallery.slice(1).map((media) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={media.src} src={media.src} alt="" />
      ))}
      <span />
      <span />
    </div>
  );
}

export function HomeExperience() {
  const router = useRouter();
  const { duckForProject, enter, entered, playEffect, setMusicAtmosphere } =
    useAudio();
  const [phase, dispatch] = useReducer(
    loaderReducer,
    entered ? "COMPLETE" : "IDLE",
  );
  const [criticalReady, setCriticalReady] = useState<boolean[]>([
    false,
    false,
    false,
  ]);
  const [debugProgress, setDebugProgress] = useState<number | null>(null);
  const [activeProject, setActiveProject] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previousProjectRef = useRef(0);
  const enteredOnceRef = useRef(false);
  const initiallyEnteredRef = useRef(entered);
  const restoredRef = useRef(false);
  const contactStripRef = useRef<HTMLDivElement>(null);

  const progress =
    debugProgress ??
    criticalReady.filter(Boolean).length / criticalReady.length;
  const frameNumber = Math.max(1, Math.round(progress * FRAME_TOTAL));
  const entryReady =
    phase === "WAITING_FOR_ENTRY" || phase === "ENTERING";

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const params = new URLSearchParams(window.location.search);
    const forcedReduced =
      window.location.hostname === "localhost" &&
      params.get("motion") === "reduce";
    const update = () => setReducedMotion(forcedReduced || query.matches);
    update();
    query.addEventListener("change", update);

    const silentReview =
      window.location.hostname === "localhost" &&
      params.get("entry") === "silent";
    const requestedLoader =
      window.location.hostname === "localhost"
        ? Number(params.get("loader"))
        : Number.NaN;
    const savedEntry =
      initiallyEnteredRef.current ||
      window.sessionStorage.getItem("ayush:entered") === "true";
    if (silentReview) {
      window.sessionStorage.removeItem("ayush:home-scroll");
      dispatch({ type: "RESTORE" });
    } else if (Number.isFinite(requestedLoader) && params.has("loader")) {
      window.queueMicrotask(() =>
        setDebugProgress(Math.max(0, Math.min(1, requestedLoader / 100))),
      );
      dispatch({ type: "DEBUG_LOADING" });
    } else if (savedEntry) {
      dispatch({ type: "RESTORE" });
    } else {
      dispatch({ type: "BEGIN" });
    }

    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        setCriticalReady((current) => [true, current[1], current[2]]);
      }
    });
    CRITICAL_ASSETS.forEach((src, index) => {
      const image = new Image();
      image.onload = image.onerror = () => {
        if (!cancelled) {
          setCriticalReady((current) => {
            const next = [...current];
            next[index + 1] = true;
            return next;
          });
        }
      };
      image.src = src;
    });
    return () => {
      cancelled = true;
      query.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (phase !== "LOADING" || progress < 1) return;
    dispatch({ type: "ASSETS_READY" });
  }, [phase, progress]);

  useLayoutEffect(() => {
    if (!loaderRef.current) return;
    const context = gsap.context(() => {
      loaderTimelineRef.current = gsap
        .timeline({ paused: true, defaults: { ease: "power3.inOut" } })
        .to(".contact-frame:not(.contact-frame--dominant)", {
          opacity: 0.62,
          yPercent: -2,
          duration: 0.45,
          stagger: 0.018,
        })
        .to(
          ".contact-frame--dominant img",
          { filter: "blur(0px)", scale: 1, duration: 0.72 },
          0,
        )
        .addLabel("loaded", 0.72)
        .to(
          ".contact-frame:not(.contact-frame--dominant)",
          { yPercent: 0, duration: 0.28 },
          "loaded",
        )
        .to(
          ".loader-entry",
          { autoAlpha: 1, y: 0, duration: 0.38 },
          "loaded+=0.04",
        )
        .addLabel("waiting", 1.14)
        .to(
          ".loader-meta, .loader-entry, .contact-frame:not(.contact-frame--dominant)",
          { autoAlpha: 0, duration: 0.32 },
          "waiting+=0.01",
        )
        .to(
          ".contact-frame--dominant",
          {
            inset: "8vh 20vw 9vh 23vw",
            borderRadius: "0px",
            duration: 1.05,
          },
          "waiting+=0.08",
        )
        .to(loaderRef.current, { autoAlpha: 0, duration: 0.2 })
        .addLabel("complete");
    }, loaderRef);
    return () => {
      loaderTimelineRef.current = null;
      context.revert();
    };
  }, []);

  useEffect(() => {
    const timeline = loaderTimelineRef.current;
    if (!timeline) return;
    if (phase === "LOADING" && !reducedMotion) {
      timeline.tweenTo(progress * 0.68, {
        duration: 0.28,
        ease: "power2.out",
      });
    }
    if (phase === "READY") {
      if (reducedMotion) {
        timeline.seek("waiting").pause();
        dispatch({ type: "REVEAL_ENTRY" });
      } else {
        timeline.tweenTo("waiting", {
          onComplete: () => dispatch({ type: "REVEAL_ENTRY" }),
        });
      }
    }
  }, [phase, progress, reducedMotion]);

  useEffect(() => {
    const locked = phase !== "COMPLETE";
    document.documentElement.classList.toggle("entry-locked", locked);
    return () => document.documentElement.classList.remove("entry-locked");
  }, [phase]);

  useEffect(() => {
    if (phase !== "COMPLETE") return;
    const chapters = Array.from(
      document.querySelectorAll<HTMLElement>("[data-project-chapter]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - window.innerHeight * 0.42) -
              Math.abs(b.boundingClientRect.top - window.innerHeight * 0.42),
          )[0];
        if (!visible) return;
        const next = Number((visible.target as HTMLElement).dataset.project);
        if (!Number.isFinite(next)) return;
        setActiveProject((current) => {
          if (current !== next) {
            previousProjectRef.current = current;
            void playEffect("focus");
          }
          return next;
        });
      },
      { rootMargin: "-22% 0px -46% 0px", threshold: 0.08 },
    );
    chapters.forEach((chapter) => observer.observe(chapter));

    const storedScroll = Number(
      window.sessionStorage.getItem("ayush:home-scroll"),
    );
    if (
      !restoredRef.current &&
      Number.isFinite(storedScroll) &&
      storedScroll > 0
    ) {
      restoredRef.current = true;
      requestAnimationFrame(() => window.scrollTo(0, storedScroll));
    }
    return () => observer.disconnect();
  }, [phase, playEffect]);

  useLayoutEffect(() => {
    if (phase !== "COMPLETE" || !stageRef.current) return;
    const current = stageRef.current.querySelector<HTMLElement>(
      `[data-stage-project="${activeProject}"]`,
    );
    const previous = stageRef.current.querySelector<HTMLElement>(
      `[data-stage-project="${previousProjectRef.current}"]`,
    );
    const project = PROJECTS[activeProject];
    const context = gsap.context(() => {
      if (reducedMotion) {
        gsap.set("[data-stage-project]", {
          autoAlpha: 0,
          pointerEvents: "none",
        });
        gsap.set(current, { autoAlpha: 1, pointerEvents: "auto" });
        return;
      }
      const timeline = gsap.timeline({ defaults: { ease: "expo.out" } });
      if (previous && previous !== current) {
        timeline.to(
          previous,
          {
            autoAlpha: 0,
            scale:
              project.slug === "rewind"
                ? 1.045
                : project.slug === "toc-oracle"
                  ? 0.88
                  : 0.97,
            xPercent: project.slug === "asim-tracker" ? -4 : 0,
            duration: 0.42,
          },
          0,
        );
      }
      timeline
        .fromTo(
          current,
          {
            autoAlpha: 0,
            scale: project.slug === "rewind" ? 1.06 : 0.96,
            xPercent: project.slug === "asim-tracker" ? 6 : 0,
          },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            pointerEvents: "auto",
            duration: 0.78,
          },
          0.08,
        )
        .fromTo(
          current?.querySelectorAll(".stage-motif > *") ?? [],
          {
            opacity: 0,
            x: project.slug === "asim-tracker" ? 28 : 0,
            y: project.slug === "vscode-clone" ? 22 : 0,
          },
          { opacity: 1, x: 0, y: 0, stagger: 0.06, duration: 0.42 },
          0.18,
        );
    }, stageRef);
    setMusicAtmosphere(project.slug === "rewind" ? "distant" : "normal");
    return () => context.revert();
  }, [activeProject, phase, reducedMotion, setMusicAtmosphere]);

  useEffect(() => {
    if (phase !== "COMPLETE" || !contactStripRef.current) return;
    const strip = contactStripRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || strip.dataset.played === "true") return;
        strip.dataset.played = "true";
        if (!reducedMotion) {
          gsap.fromTo(
            strip,
            { xPercent: 0 },
            { xPercent: -19, duration: 3.8, ease: "power3.out" },
          );
        }
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(strip);
    return () => observer.disconnect();
  }, [phase, reducedMotion]);

  const chooseEntry = useCallback(
    async (withSound: boolean) => {
      if (phase !== "WAITING_FOR_ENTRY" || enteredOnceRef.current) return;
      enteredOnceRef.current = true;
      dispatch({ type: "ENTER" });
      await enter(withSound);
      if (withSound) void playEffect("filmThread");

      if (reducedMotion || !loaderRef.current) {
        dispatch({ type: "FINISH" });
        return;
      }
      loaderTimelineRef.current?.tweenFromTo("waiting", "complete", {
        onComplete: () => dispatch({ type: "FINISH" }),
      });
    },
    [enter, phase, playEffect, reducedMotion],
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
      window.sessionStorage.setItem("ayush:home-scroll", String(window.scrollY));
      window.sessionStorage.setItem("ayush:return-project", project.slug);
      window.sessionStorage.setItem("ayush:return-route", "/");
      duckForProject();
      void playEffect("projectEnter");
      const navigate = () => router.push(`/work/${project.slug}`);
      const transitionDocument = document as ViewTransitionDocument;
      if (
        !reducedMotion &&
        typeof transitionDocument.startViewTransition === "function"
      ) {
        transitionDocument.startViewTransition(navigate);
      } else {
        navigate();
      }
    },
    [duckForProject, playEffect, reducedMotion, router],
  );

  return (
    <div className="experience">
      {phase !== "COMPLETE" ? (
        <div
          ref={loaderRef}
          className={`contact-loader contact-loader--${phase.toLowerCase()}`}
          data-loader-phase={phase}
          aria-label="Portfolio entry"
        >
          <div className="contact-sheet" aria-hidden="true">
            {CONTACT_FRAMES.map((frame, index) => {
              const media = PROJECTS[frame.project].gallery[frame.media];
              return (
                <figure
                  className={`contact-frame contact-frame--${frame.kind}`}
                  key={`${media.src}-${index}`}
                >
                  {frame.kind !== "dark" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.src} alt="" />
                  ) : null}
                  <figcaption>{String(index + 1).padStart(3, "0")}</figcaption>
                </figure>
              );
            })}
          </div>
          <div className="loader-meta">
            <p>
              AYUSH JHA
              <br />
              PORTFOLIO / 2026
            </p>
            <p aria-label="Loading progress">
              FRAME {String(frameNumber).padStart(3, "0")} / {FRAME_TOTAL}
            </p>
          </div>
          <div className="loader-entry" aria-live="polite">
            <p>{entryReady ? "CONTACT SHEET LOCKED" : "ASSEMBLING FRAMES"}</p>
            <div>
              <button
                type="button"
                disabled={phase !== "WAITING_FOR_ENTRY"}
                onClick={() => void chooseEntry(true)}
              >
                ENTER WITH SOUND
              </button>
              <button
                type="button"
                disabled={phase !== "WAITING_FOR_ENTRY"}
                onClick={() => void chooseEntry(false)}
              >
                ENTER SILENT
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#top">AYUSH JHA</a>
        <div>
          <Link href="/work">WORK</Link>
          <a href="#about">ABOUT</a>
          <a href="mailto:ayushwork2401@gmail.com">EMAIL</a>
        </div>
      </nav>

      <main id="main-content">
        <section id="top" ref={heroRef} className="contact-hero">
          <div className="hero-fragment hero-fragment--left" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PROJECTS[1].gallery[1].src} alt="" />
          </div>
          <div className="hero-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PROJECTS[0].image} alt={PROJECTS[0].alt} />
            <span>FRAME 001 / TOC ORACLE</span>
          </div>
          <div className="hero-fragment hero-fragment--right" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PROJECTS[2].gallery[2].src} alt="" />
          </div>
          <h1>
            <span>AYUSH</span>
            <span>JHA</span>
          </h1>
          <p className="hero-role">PRODUCT BUILDER / DEVELOPER</p>
          <a className="hero-scroll" href="#selected-work">
            SCROLL
          </a>
        </section>

        <section id="selected-work" className="work-sequence">
          <header className="work-sequence__label">
            <span>SELECTED WORK</span>
            <span>01—04</span>
          </header>
          <div ref={stageRef} className="work-stage">
            {PROJECTS.map((project, index) => (
              <div
                key={project.slug}
                className={`stage-project stage-project--${project.slug}`}
                data-stage-project={index}
                data-active={activeProject === index}
                style={
                  {
                    "--project-bg": project.background,
                    "--project-fg": project.foreground,
                    "--project-accent": project.accent,
                  } as CSSProperties
                }
              >
                <div className="stage-project__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.image}
                    alt=""
                    style={{
                      viewTransitionName: `project-${project.slug}`,
                      objectPosition: project.gallery[0].desktopPosition,
                    }}
                  />
                </div>
                <StageVisual index={index} />
              </div>
            ))}
          </div>
          <div className="work-track">
            {PROJECTS.map((project, index) => (
              <article
                key={project.slug}
                className={`work-chapter work-chapter--${project.slug}`}
                data-project-chapter
                data-project={index}
                style={
                  {
                    "--project-bg": project.background,
                    "--project-fg": project.foreground,
                    "--project-accent": project.accent,
                  } as CSSProperties
                }
              >
                <div>
                  <span>{project.number}</span>
                  <p>{project.category}</p>
                  <time>{project.year}</time>
                </div>
                <div className="work-chapter__mobile-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.image}
                    alt={project.alt}
                    style={{ objectPosition: project.gallery[0].mobilePosition }}
                  />
                </div>
                <h2>{project.title}</h2>
                <p className="work-chapter__line">{project.summary}</p>
                <Link
                  href={`/work/${project.slug}`}
                  onClick={(event) => openProject(index, event)}
                >
                  VIEW PROJECT ↗
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="about-intermission">
          <p>ABOUT</p>
          <h2>
            I build products that make complex systems easier to understand and
            control.
          </h2>
          <ul>
            <li>PRODUCT ENGINEERING</li>
            <li>AI SYSTEMS</li>
            <li>INTERACTIVE FRONTEND</li>
          </ul>
          <p className="about-intermission__resume">
            RÉSUMÉ AVAILABLE ON REQUEST
          </p>
        </section>

        <section className="contact-ending" aria-labelledby="contact-title">
          <div className="contact-ending__upper">
            <p>AVAILABLE FOR SELECT COLLABORATIONS</p>
            <h2 id="contact-title">LET’S BUILD SOMETHING.</h2>
          </div>
          <div className="contact-ending__lower">
            <div ref={contactStripRef} className="contact-strip">
              {[...PROJECTS, ...PROJECTS].map((project, index) => (
                <span key={`${project.slug}-${index}`}>
                  {project.number} / {project.title}
                </span>
              ))}
            </div>
            <div className="contact-links">
              <a href="mailto:ayushwork2401@gmail.com">EMAIL</a>
              <a
                href="https://github.com/AJCoder01"
                target="_blank"
                rel="noreferrer"
              >
                GITHUB
              </a>
              <span>INDIA / 2026</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
