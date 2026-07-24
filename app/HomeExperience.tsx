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

type ExperienceState =
  | "booting"
  | "ready"
  | "entering"
  | "hero"
  | "exploring";

type ExperienceEvent =
  | { type: "READY" }
  | { type: "ENTER" }
  | { type: "HERO" }
  | { type: "EXPLORE" }
  | { type: "RETURN_TO_HERO" }
  | { type: "RESTORE" };

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const HERO_POSTER = FEATURED_PROJECTS[0].image;
const ENTRY_DURATION_MS = 1080;

function experienceReducer(
  state: ExperienceState,
  event: ExperienceEvent,
): ExperienceState {
  if (event.type === "RESTORE") return "hero";
  if (state === "booting" && event.type === "READY") return "ready";
  if (state === "ready" && event.type === "ENTER") return "entering";
  if (state === "entering" && event.type === "HERO") return "hero";
  if (state === "hero" && event.type === "EXPLORE") return "exploring";
  if (state === "exploring" && event.type === "RETURN_TO_HERO") return "hero";
  return state;
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
      <span>RISK 1 — SPARSE</span>
      <span>NIFTY 50</span>
      <span>ONNX / LIVE</span>
    </div>
  );
}

export function HomeExperience() {
  const router = useRouter();
  const { duckForProject, enter, entered, playEffect, setMusicAtmosphere } =
    useAudio();
  const [experienceState, dispatch] = useReducer(
    experienceReducer,
    "booting",
  );
  const [progress, setProgress] = useState(0);
  const [activeProject, setActiveProject] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const experienceRef = useRef<HTMLDivElement>(null);
  const prologueRef = useRef<HTMLElement>(null);
  const contactStripRef = useRef<HTMLDivElement>(null);
  const enteredOnceRef = useRef(false);
  const restoredRef = useRef(false);
  const stateRef = useRef<ExperienceState>(experienceState);
  const previousProjectRef = useRef(0);

  const experienceEntered =
    experienceState === "hero" || experienceState === "exploring";
  const mainLocked =
    experienceState === "booting" || experienceState === "ready";
  const progressLabel = String(Math.round(progress * 100)).padStart(2, "0");
  const active = FEATURED_PROJECTS[activeProject];

  useEffect(() => {
    stateRef.current = experienceState;
    document.documentElement.dataset.experienceState = experienceState;
    const entryLocked =
      experienceState === "booting" ||
      experienceState === "ready" ||
      experienceState === "entering";
    document.documentElement.classList.toggle("entry-locked", entryLocked);

    return () => {
      document.documentElement.classList.remove("entry-locked");
      delete document.documentElement.dataset.experienceState;
    };
  }, [experienceState]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const params = new URLSearchParams(window.location.search);
    const forcedReduced =
      window.location.hostname === "localhost" &&
      params.get("motion") === "reduce";
    const updateMotion = () =>
      setReducedMotion(forcedReduced || query.matches);
    updateMotion();
    query.addEventListener("change", updateMotion);

    const silentReview =
      window.location.hostname === "localhost" &&
      params.get("entry") === "silent";
    const requestedLoader =
      window.location.hostname === "localhost"
        ? Number(params.get("loader"))
        : Number.NaN;
    const savedEntry =
      entered || window.sessionStorage.getItem("ayush:entered") === "true";

    if (Number.isFinite(requestedLoader) && params.has("loader")) {
      const debugProgress = Math.max(
        0,
        Math.min(1, requestedLoader / 100),
      );
      window.queueMicrotask(() => {
        setProgress(debugProgress);
        if (debugProgress === 1) dispatch({ type: "READY" });
      });
      return () => query.removeEventListener("change", updateMotion);
    }

    if (silentReview || savedEntry) {
      window.queueMicrotask(() => {
        setProgress(1);
        dispatch({ type: "RESTORE" });
      });
      return () => query.removeEventListener("change", updateMotion);
    }

    let cancelled = false;
    let completed = 0;
    const markComplete = () => {
      if (cancelled) return;
      completed += 1;
      const nextProgress = completed / 3;
      setProgress(nextProgress);
      if (nextProgress === 1) dispatch({ type: "READY" });
    };

    void document.fonts.ready.then(markComplete);
    const poster = new Image();
    poster.onload = poster.onerror = markComplete;
    poster.src = HERO_POSTER;
    window.queueMicrotask(markComplete);

    return () => {
      cancelled = true;
      query.removeEventListener("change", updateMotion);
    };
  }, [entered]);

  useLayoutEffect(() => {
    if (!experienceEntered || !prologueRef.current || reducedMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: prologueRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.42,
            onUpdate: ({ progress: scrollProgress }) => {
              if (
                scrollProgress >= 0.55 &&
                stateRef.current === "hero"
              ) {
                dispatch({ type: "EXPLORE" });
              } else if (
                scrollProgress < 0.28 &&
                stateRef.current === "exploring"
              ) {
                dispatch({ type: "RETURN_TO_HERO" });
              }
            },
          },
        })
        .to(
          ".editorial-media",
          { scale: 1.05, xPercent: -4, duration: 0.25 },
          0.25,
        )
        .to(
          ".prologue-count",
          { autoAlpha: 1, y: 0, duration: 0.16 },
          0.34,
        )
        .to(
          ".split-stage__black",
          { xPercent: -20, duration: 0.25 },
          0.5,
        )
        .to(
          ".editorial-media",
          { scale: 1.09, xPercent: -12, duration: 0.25 },
          0.5,
        )
        .to(
          ".hero-name",
          {
            autoAlpha: 0,
            scale: 0.94,
            transformOrigin: "left center",
            duration: 0.16,
          },
          0.52,
        )
        .to(
          ".hero-role, .hero-scroll",
          { autoAlpha: 0, y: -8, duration: 0.18 },
          0.52,
        )
        .to(
          ".prologue-handoff",
          { autoAlpha: 1, y: 0, duration: 0.18 },
          0.77,
        )
        .to(
          ".editorial-media",
          { scale: 1.13, xPercent: -16, duration: 0.18 },
          0.78,
        );
    }, experienceRef);

    return () => context.revert();
  }, [experienceEntered, reducedMotion]);

  useEffect(() => {
    if (!experienceEntered || !reducedMotion) return;
    const updateReducedState = () => {
      if (window.scrollY > 32 && stateRef.current === "hero") {
        dispatch({ type: "EXPLORE" });
      } else if (
        window.scrollY <= 12 &&
        stateRef.current === "exploring"
      ) {
        dispatch({ type: "RETURN_TO_HERO" });
      }
    };
    window.addEventListener("scroll", updateReducedState, { passive: true });
    updateReducedState();
    return () => window.removeEventListener("scroll", updateReducedState);
  }, [experienceEntered, reducedMotion]);

  useEffect(() => {
    if (
      !experienceEntered ||
      window.location.hostname !== "localhost" ||
      !prologueRef.current
    ) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const requestedY = Number(params.get("y"));
    const requestedScroll = Number(params.get("scroll"));
    if (Number.isFinite(requestedY) && requestedY > 0) {
      const frame = requestAnimationFrame(() => window.scrollTo(0, requestedY));
      return () => cancelAnimationFrame(frame);
    }
    if (!Number.isFinite(requestedScroll) || requestedScroll <= 0) return;
    const progress = Math.max(0, Math.min(1, requestedScroll / 100));
    const frame = requestAnimationFrame(() => {
      if (!prologueRef.current) return;
      const distance =
        prologueRef.current.offsetHeight - window.innerHeight;
      window.scrollTo(0, Math.max(0, distance * progress));
    });
    return () => cancelAnimationFrame(frame);
  }, [experienceEntered]);

  useEffect(() => {
    if (!experienceEntered) return;
    const chapters = Array.from(
      document.querySelectorAll<HTMLElement>("[data-project-chapter]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - window.innerHeight * 0.58) -
              Math.abs(b.boundingClientRect.top - window.innerHeight * 0.58),
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
      { rootMargin: "-28% 0px -34% 0px", threshold: 0.08 },
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
  }, [experienceEntered, playEffect]);

  useEffect(() => {
    if (!experienceEntered) return;
    setMusicAtmosphere(active.slug === "rewind" ? "distant" : "normal");
  }, [active.slug, experienceEntered, setMusicAtmosphere]);

  const phase = experienceEntered ? "COMPLETE" : experienceState;

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
      if (experienceState !== "ready" || enteredOnceRef.current) return;
      enteredOnceRef.current = true;
      dispatch({ type: "ENTER" });

      const transition = new Promise<void>((resolve) => {
        window.setTimeout(
          resolve,
          reducedMotion ? 40 : ENTRY_DURATION_MS,
        );
      });
      await Promise.all([enter(withSound), transition]);
      if (withSound) void playEffect("filmThread");
      window.sessionStorage.setItem("ayush:entered", "true");
      dispatch({ type: "HERO" });
    },
    [enter, experienceState, playEffect, reducedMotion],
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
      className="experience"
      data-experience-state={experienceState}
      style={
        {
          "--loader-reveal": `${Math.max(0, 94 - progress * 94)}%`,
          "--loader-blur": `${Math.max(0, 7 - progress * 7)}px`,
        } as CSSProperties
      }
    >
      {experienceState === "exploring" ? (
        <nav className="site-nav site-nav--visible" aria-label="Primary navigation">
          <a href="#top">Ayush Jha</a>
          <div>
            <a href="#selected-work">Work</a>
            <Link href="/archive">Archive</Link>
            <a href="#about">About</a>
            <a href="mailto:ayushwork2401@gmail.com">Email</a>
          </div>
        </nav>
      ) : null}

      {experienceState !== "hero" && experienceState !== "exploring" ? (
        <aside
          className="entry-shell"
          aria-label="Portfolio entry"
          aria-hidden={experienceState === "entering"}
        >
          <div className="entry-identity">
            <p>Ayush Jha</p>
            <p>Product builder and developer</p>
          </div>
          <div className="entry-actions">
            <button
              type="button"
              disabled={experienceState !== "ready"}
              onClick={() => void chooseEntry(true)}
            >
              Enter with sound
            </button>
            <button
              type="button"
              disabled={experienceState !== "ready"}
              onClick={() => void chooseEntry(false)}
            >
              Enter silent
            </button>
          </div>
          <p className="entry-progress" aria-label="Loading progress">
            <span>{experienceState === "ready" ? "Ready" : "Loading"}</span>
            <span>{progressLabel}</span>
          </p>
        </aside>
      ) : null}

      <main
        id="main-content"
        inert={mainLocked ? true : undefined}
        aria-hidden={mainLocked}
      >
        <section
          id="top"
          ref={prologueRef}
          className="hero-prologue"
          aria-label="Introduction"
        >
          <div className="editorial-stage">
            <div className="split-stage" aria-hidden="true">
              <div className="split-stage__ivory" />
              <div className="split-stage__black" />
            </div>

            <div className="hero-copy">
              <h1 className="hero-name">
                <span>Ayush</span>
                <span>Jha</span>
              </h1>
              <p className="hero-role">Product builder and developer</p>
              <p className="hero-scroll">Scroll to explore</p>
            </div>

            <figure className="editorial-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_POSTER}
                alt="Rewind interface explaining reviewed recovery for AI actions"
                style={{ viewTransitionName: "project-rewind" }}
              />
            </figure>

            <p className="prologue-count">Selected work / 03</p>
            <div className="prologue-handoff">
              <span>01 / AI workflow safety</span>
              <strong>Rewind</strong>
              <span>Product engineering / 2026</span>
            </div>
          </div>
        </section>

        <section
          id="selected-work"
          className={`work-sequence work-sequence--${active.slug}`}
          style={
            {
              "--project-bg": active.background,
              "--project-fg": active.foreground,
              "--project-accent": active.accent,
            } as CSSProperties
          }
        >
          <div className="work-stage" aria-live="polite">
            <div
              key={active.slug}
              className={`stage-project stage-project--${active.slug}`}
              data-stage-project={activeProject}
            >
              <div className="work-sequence__label">
                <span>Selected work</span>
                <span>{active.number} / 03</span>
              </div>
              <div className="stage-project__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.image}
                  alt=""
                  style={{
                    viewTransitionName: `project-${active.slug}`,
                    objectPosition: active.gallery[0].desktopPosition,
                  }}
                />
              </div>
              <StageVisual slug={active.slug} />
            </div>
          </div>

          <div className="work-track">
            {FEATURED_PROJECTS.map((project, index) => (
              <article
                key={project.slug}
                className={`work-chapter work-chapter--${project.slug}`}
                data-project-chapter
                data-project={index}
              >
                <div className="work-chapter__mobile-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.image}
                    alt={project.alt}
                    style={{ objectPosition: project.gallery[0].mobilePosition }}
                  />
                </div>
                <div className="work-chapter__motif">
                  <StageVisual slug={project.slug} />
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
