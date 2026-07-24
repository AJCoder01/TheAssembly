"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAudio } from "../src/audio/AudioProvider";
import type { PortfolioProject } from "./projectData";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

export function ProjectCaseStudy({
  project,
  next,
}: {
  project: PortfolioProject;
  next: PortfolioProject;
}) {
  const router = useRouter();
  const { duckForProject, playEffect } = useAudio();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const navigate = (
    href: string,
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    back = false,
  ) => {
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
    setLeaving(true);
    duckForProject();
    void playEffect(back ? "projectExit" : "projectEnter");
    const update = () => {
      if (back) {
        const returnRoute =
          window.sessionStorage.getItem("ayush:return-route") ?? "/";
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(returnRoute);
        }
      } else {
        router.push(href);
      }
    };
    const transitionDocument = document as ViewTransitionDocument;
    window.setTimeout(() => {
      if (typeof transitionDocument.startViewTransition === "function") {
        transitionDocument.startViewTransition(update);
      } else {
        update();
      }
    }, 180);
  };

  return (
    <main
      id="main-content"
      className={`project-page ${leaving ? "is-leaving" : ""}`}
      style={
        {
          "--project-bg": project.background,
          "--project-fg": project.foreground,
          "--project-accent": project.accent,
        } as CSSProperties
      }
    >
      <header className="project-page__hero">
        <button
          type="button"
          className="project-page__back"
          onClick={(event) => navigate("/", event, true)}
          aria-label="Back to selected work"
        >
          ← BACK
        </button>
        <div className="project-page__identity">
          <span>{project.number}</span>
          <span>{project.category}</span>
          <span>{project.year}</span>
        </div>
        <h1 ref={headingRef} tabIndex={-1}>
          {project.title.split(" ").map((word) => (
            <span key={word}>{word} </span>
          ))}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.gallery[0].src}
          alt={project.gallery[0].alt}
          style={
            {
              viewTransitionName: `project-${project.slug}`,
              objectPosition: project.gallery[0].desktopPosition,
            } as CSSProperties
          }
        />
      </header>

      <article className="project-page__body">
        <p className="project-page__summary">{project.summary}</p>
        <div className="project-page__facts">
          <div>
            <span>ROLE</span>
            <p>{project.role}</p>
          </div>
          <div>
            <span>STACK</span>
            <p>{project.stack.join(" / ")}</p>
          </div>
          <div>
            <span>SOURCE</span>
            <a href={project.repository} target="_blank" rel="noreferrer">
              GITHUB REPOSITORY ↗
            </a>
          </div>
        </div>

        <div className="case-evidence">
          <figure className="case-evidence__detail">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.gallery[1].src}
              alt={project.gallery[1].alt}
              style={{
                objectPosition: project.gallery[1].desktopPosition,
                aspectRatio: project.gallery[1].aspectRatio,
              }}
            />
            <figcaption>Interface detail / same captured state</figcaption>
          </figure>
          <div className={`case-system case-system--${project.slug}`}>
            <span>System / {project.number}</span>
            <ol>
              {project.highlights.map((highlight, index) => (
                <li key={highlight}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <p>{highlight}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <ul className="project-page__decisions">
          {[
            ["THE PROBLEM", project.problem],
            ["THE DECISION", project.decision],
            ["THE RESULT", project.result],
            ["TECHNICAL NOTE", project.technical],
          ].map(([label, detail]) => (
            <li key={label}>
              <span>{label}</span>
              <p>{detail}</p>
            </li>
          ))}
        </ul>
      </article>

      <footer className="project-page__next">
        <span>NEXT / {next.number}</span>
        <Link
          href={`/work/${next.slug}`}
          onClick={(event) => navigate(`/work/${next.slug}`, event)}
        >
          {next.title}
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={next.image} alt="" aria-hidden="true" />
      </footer>
    </main>
  );
}
