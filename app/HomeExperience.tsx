"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
import { FEATURED_PROJECTS } from "./projectData";

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

const CRITICAL_ASSETS = FEATURED_PROJECTS.map((project) => project.image);

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

function StageVisual({ slug }: { slug: string }) {
  if (slug === "rewind") {
    return (
      <div className="stage-motif stage-motif--rewind" aria-hidden="true">
        <span>ASSUMPTION CHANGED</span>
        <div className="rewind-line">
          <i />
          <i />
          <i />
          <i />
        </div>
        <strong>REPAIR / 04</strong>
        <span>HUMAN REVIEW REQUIRED</span>
      </div>
    );
  }
  if (slug === "toc-oracle") {
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
  return (
    <div className="stage-motif stage-motif--asim" aria-hidden="true">
      <span>FinBERT +0.78</span>
      <span>OBI 0.42</span>
      <span>RISK 1—SPARSE</span>
      <span>NIFTY 50</span>
      <span>ONNX / LIVE</span>
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
  const [criticalReady, setCriticalReady] = useState<boolean[]>(
    Array.from({ length: CRITICAL_ASSETS.length + 2 }, () => false),
  );
  const [debugProgress, setDebugProgress] = useState<number | null>(null);
  const [activeProject, setActiveProject] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const experienceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const workStageRef = useRef<HTMLDivElement>(null);
  const loaderTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const previousProjectRef = useRef(0);
  const enteredOnceRef = useRef(false);
  const initiallyEnteredRef = useRef(entered);
  const restoredRef = useRef(false);
  const contactStripRef = useRef<HTMLDivElement>(null);

  const progress =
    debugProgress ??
    criticalReady.filter(Boolean).length / criticalReady.length;
  const progressLabel = String(Math.round(progress * 100)).padStart(2, "0");
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
        setCriticalReady((current) => {
          const next = [...current];
          next[0] = true;
          return next;
        });
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
    window.queueMicrotask(() => {
      if (!cancelled) {
        setCriticalReady((current) => {
          const next = [...current];
          next[next.length - 1] = true;
          return next;
        });
      }
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
    if (!stageRef.current) return;
    const loaderEntry = stageRef.current.querySelector<HTMLElement>(
      ".loader-entry",
    );
    const loaderMeta = stageRef.current.querySelector<HTMLElement>(
      ".loader-meta",
    );
    const context = gsap.context(() => {
      const timeline = gsap
        .timeline({ paused: true, defaults: { ease: "power3.inOut" } })
        .to(".reel-panel", {
          clipPath: "inset(0% 0% 0% 0%)",
          filter: "brightness(0.78) saturate(0.72) blur(0px)",
          duration: 0.72,
          stagger: 0.035,
        })
        .to(
          ".reel-panel--center",
          {
            filter: "brightness(0.94) saturate(0.82) blur(0px)",
            scale: 1,
            duration: 0.72,
          },
          0,
        )
        .addLabel("loaded", 0.79);
      if (loaderEntry) {
        timeline.to(
          loaderEntry,
          { autoAlpha: 1, y: 0, duration: 0.32 },
          "loaded+=0.03",
        );
      }
      timeline.addLabel("waiting", 1.14);
      if (loaderMeta || loaderEntry) {
        timeline.to(
          [loaderMeta, loaderEntry].filter(Boolean),
          { autoAlpha: 0, duration: 0.24 },
          "waiting+=0.01",
        );
      }
      timeline
        .to(
          ".reel-panel--left",
          { xPercent: -38, opacity: 0.42, scale: 0.9, duration: 0.96 },
          "waiting+=0.06",
        )
        .to(
          ".reel-panel--right",
          { xPercent: 38, opacity: 0.42, scale: 0.9, duration: 0.96 },
          "waiting+=0.06",
        )
        .to(
          ".reel-panel--center",
          { width: "58vw", left: "21vw", duration: 1.02 },
          "waiting+=0.06",
        )
        .fromTo(
          ".hero-identity, .hero-scroll",
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.68, stagger: 0.05 },
          "waiting+=0.48",
        )
        .addLabel("complete", 2.24);
      loaderTimelineRef.current = timeline;
    }, stageRef);
    return () => {
      loaderTimelineRef.current = null;
      context.revert();
    };
  }, []);

  useEffect(() => {
    const timeline = loaderTimelineRef.current;
    if (!timeline) return;
    if (phase === "LOADING" && !reducedMotion) {
      timeline.tweenTo(progress * 0.79, {
        duration: 0.24,
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
    if (phase === "COMPLETE" && timeline.time() < timeline.labels.complete) {
      timeline.seek("complete").pause();
    }
  }, [phase, progress, reducedMotion]);

  useEffect(() => {
    const locked = phase !== "COMPLETE";
    document.documentElement.classList.toggle("entry-locked", locked);
    return () => document.documentElement.classList.remove("entry-locked");
  }, [phase]);

  useLayoutEffect(() => {
    if (
      phase !== "COMPLETE" ||
      !experienceRef.current ||
      reducedMotion
    ) {
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add("(min-width: 801px)", () => {
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: ".hero-prologue",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.42,
            },
          })
          .to(
            ".hero-identity",
            { yPercent: -15, opacity: 0.62, duration: 0.25 },
            0.2,
          )
          .to(
            ".reel-panel--center",
            { scale: 0.92, filter: "brightness(0.72) saturate(0.68)", duration: 0.3 },
            0.2,
          )
          .to(
            ".reel-panel--left",
            { xPercent: -10, opacity: 0.68, duration: 0.3 },
            0.22,
          )
          .to(
            ".reel-panel--right",
            { xPercent: 10, opacity: 0.68, duration: 0.3 },
            0.22,
          )
          .to(
            ".prologue-index",
            { autoAlpha: 1, y: 0, stagger: 0.035, duration: 0.2 },
            0.44,
          )
          .to(
            ".prologue-threshold",
            { autoAlpha: 1, y: 0, duration: 0.18 },
            0.7,
          )
          .to(
            ".reel-panel--left, .reel-panel--right",
            { opacity: 0.12, duration: 0.12 },
            0.86,
          )
          .to(
            ".reel-panel--center",
            {
              scale: 1,
              filter: "brightness(0.94) saturate(0.82)",
              duration: 0.14,
            },
            0.86,
          )
          .to(
            ".hero-identity, .hero-scroll",
            { autoAlpha: 0, duration: 0.12 },
            0.88,
          );
      });
      media.add("(max-width: 800px)", () => {
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: ".hero-prologue",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.3,
            },
          })
          .to(".hero-identity", { opacity: 0.55, yPercent: -8 }, 0.28)
          .to(
            ".prologue-index",
            { autoAlpha: 1, y: 0, stagger: 0.025 },
            0.48,
          )
          .to(
            ".prologue-threshold",
            { autoAlpha: 1, y: 0 },
            0.75,
          );
      });
      return () => media.revert();
    }, experienceRef);
    return () => context.revert();
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "COMPLETE") return;
    const revealNavigation = () => {
      if (window.scrollY > 32) {
        setNavVisible(true);
        window.removeEventListener("scroll", revealNavigation);
      }
    };
    revealNavigation();
    window.addEventListener("scroll", revealNavigation, { passive: true });
    return () => window.removeEventListener("scroll", revealNavigation);
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
      { rootMargin: "-20% 0px -48% 0px", threshold: 0.08 },
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
    if (phase !== "COMPLETE" || !workStageRef.current) return;
    const current = workStageRef.current.querySelector<HTMLElement>(
      `[data-stage-project="${activeProject}"]`,
    );
    const previous = workStageRef.current.querySelector<HTMLElement>(
      `[data-stage-project="${previousProjectRef.current}"]`,
    );
    const project = FEATURED_PROJECTS[activeProject];
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
            scale: project.slug === "rewind" ? 1.04 : 0.94,
            xPercent: project.slug === "asim-tracker" ? -3 : 0,
            duration: 0.4,
          },
          0,
        );
      }
      timeline
        .fromTo(
          current,
          {
            autoAlpha: 0,
            scale: project.slug === "rewind" ? 1.055 : 0.96,
            xPercent: project.slug === "asim-tracker" ? 5 : 0,
          },
          {
            autoAlpha: 1,
            scale: 1,
            xPercent: 0,
            pointerEvents: "auto",
            duration: 0.76,
          },
          0.06,
        )
        .fromTo(
          current?.querySelectorAll(".stage-motif > *") ?? [],
          {
            opacity: 0,
            x: project.slug === "asim-tracker" ? 26 : 0,
          },
          { opacity: 1, x: 0, stagger: 0.055, duration: 0.4 },
          0.16,
        );
    }, workStageRef);
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
            { xPercent: -14, duration: 3.4, ease: "power3.out" },
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

      if (reducedMotion || !stageRef.current) {
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
      const project = FEATURED_PROJECTS[index];
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
    <div
      ref={experienceRef}
      className={`experience experience--${phase.toLowerCase()}`}
      data-loader-phase={phase}
    >
      <nav
        className={`site-nav ${navVisible ? "site-nav--visible" : ""}`}
        aria-label="Primary navigation"
      >
        <a href="#top">Ayush Jha</a>
        <div>
          <Link href="/work">Work</Link>
          <Link href="/archive">Archive</Link>
          <a href="#about">About</a>
          <a href="mailto:ayushwork2401@gmail.com">Email</a>
        </div>
      </nav>

      <main id="main-content">
        <section id="top" className="hero-prologue" aria-label="Introduction">
          <div ref={stageRef} className="reel-stage">
            <div className="reel-panels">
              <figure className="reel-panel reel-panel--left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={FEATURED_PROJECTS[1].image}
                  alt=""
                  aria-hidden="true"
                />
                <figcaption>02 / TOC Oracle</figcaption>
              </figure>
              <figure className="reel-panel reel-panel--center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={FEATURED_PROJECTS[0].image}
                  alt={FEATURED_PROJECTS[0].alt}
                  style={{
                    viewTransitionName: `project-${FEATURED_PROJECTS[0].slug}`,
                  }}
                />
                <figcaption>01 / Rewind</figcaption>
              </figure>
              <figure className="reel-panel reel-panel--right">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={FEATURED_PROJECTS[2].image}
                  alt=""
                  aria-hidden="true"
                />
                <figcaption>03 / ASIM Tracker</figcaption>
              </figure>
            </div>

            <div className="hero-identity">
              <h1>Ayush Jha</h1>
              <p>Product builder / developer</p>
            </div>
            <a className="hero-scroll" href="#selected-work">
              Scroll to begin
            </a>

            <ol className="prologue-indices" aria-label="Featured projects">
              {FEATURED_PROJECTS.map((project) => (
                <li className="prologue-index" key={project.slug}>
                  <span>{project.number}</span>
                  <span>{project.title}</span>
                </li>
              ))}
            </ol>
            <div className="prologue-threshold">
              <span>Selected work</span>
              <span>03 projects</span>
            </div>

            {phase !== "COMPLETE" ? (
              <div className="loader-ui" aria-label="Portfolio entry">
                <div className="loader-meta">
                  <p>
                    AYUSH JHA
                    <br />
                    PORTFOLIO / 2026
                  </p>
                  <p className="loader-progress" aria-label="Loading progress">
                    {phase === "WAITING_FOR_ENTRY" ? "READY" : "LOADING"}
                    <span>{progressLabel}</span>
                  </p>
                </div>
                <div className="loader-entry" aria-live="polite">
                  <p>{entryReady ? "THE REEL IS READY" : "LOADING"}</p>
                  <div>
                    <button
                      type="button"
                      disabled={phase !== "WAITING_FOR_ENTRY"}
                      onClick={() => void chooseEntry(true)}
                    >
                      Enter with sound
                    </button>
                    <button
                      type="button"
                      disabled={phase !== "WAITING_FOR_ENTRY"}
                      onClick={() => void chooseEntry(false)}
                    >
                      Enter silent
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section id="selected-work" className="work-sequence">
          <header className="work-sequence__label">
            <span>Selected work</span>
            <span>01—03</span>
          </header>
          <div ref={workStageRef} className="work-stage">
            {FEATURED_PROJECTS.map((project, index) => (
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
                <StageVisual slug={project.slug} />
              </div>
            ))}
          </div>
          <div className="work-track">
            {FEATURED_PROJECTS.map((project, index) => (
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
                <div className="work-chapter__mobile-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.image}
                    alt={project.alt}
                    style={{ objectPosition: project.gallery[0].mobilePosition }}
                  />
                </div>
                <div className="work-chapter__copy">
                  <div className="work-chapter__meta">
                    <span>{project.number}</span>
                    <p>{project.category}</p>
                    <time>{project.year}</time>
                  </div>
                  <h2>{project.title}</h2>
                  <Link
                    href={`/work/${project.slug}`}
                    onClick={(event) => openProject(index, event)}
                  >
                    View project
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="about-intermission">
          <p>About</p>
          <h2>
            I build products that make complex systems easier to understand and
            control.
          </h2>
          <ul>
            <li>Product engineering</li>
            <li>AI systems</li>
            <li>Interactive frontend</li>
          </ul>
          <p className="about-intermission__resume">
            Résumé available on request
          </p>
        </section>

        <section className="contact-ending" aria-labelledby="contact-title">
          <div className="contact-ending__upper">
            <p>Available for select collaborations</p>
            <h2 id="contact-title">Let’s build something.</h2>
          </div>
          <div className="contact-ending__lower">
            <div ref={contactStripRef} className="contact-strip">
              {[...FEATURED_PROJECTS, ...FEATURED_PROJECTS].map(
                (project, index) => (
                <span key={`${project.slug}-${index}`}>
                  {project.number} / {project.title}
                </span>
                ),
              )}
            </div>
            <div className="contact-links">
              <a href="mailto:ayushwork2401@gmail.com">Email</a>
              <a
                href="https://github.com/AJCoder01"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <Link href="/archive">Archive</Link>
              <span>India / 2026</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
