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
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
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
        const returnProject = window.sessionStorage.getItem(
          "ayush:return-project",
        );
        if (returnProject === project.number && window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
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
    }, 260);
  };

  return (
    <main
      id="main-content"
      className={`project-page ${leaving ? "is-leaving" : ""}`}
    >
      <header className="project-page__hero">
        <button
          type="button"
          className="project-page__back"
          onClick={(event) => navigate("/", event, true)}
          aria-label="Back to project journey"
        >
          ← BACK
        </button>
        <div className="project-page__identity">
          <span>{project.number}</span>
          <span>{project.category}</span>
          <span>{project.year}</span>
        </div>
        <h1 ref={headingRef} tabIndex={-1}>
          {project.title}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.image}
          alt={project.alt}
          style={
            {
              viewTransitionName: `project-${project.number}`,
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

        <div className="case-visual-grid">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.image} alt={project.alt} />
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.image}
              alt={`${project.title} interface detail, upper-right crop`}
            />
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.image}
              alt={`${project.title} interface detail, lower-left crop`}
            />
          </figure>
        </div>

        <ul className="project-page__decisions">
          {[
            ["PROBLEM", project.problem],
            ["KEY DECISION", project.decision],
            ["RESULT", project.result],
            ["TECHNICAL DETAIL", project.technical],
          ].map(([label, detail]) => (
            <li key={label}>
              <span>{label}</span>
              <p>{detail}</p>
            </li>
          ))}
        </ul>
      </article>

      <footer className="project-page__next">
        <span>NEXT PROJECT / {next.number}</span>
        <Link
          href={`/project/${next.number}`}
          onClick={(event) => navigate(`/project/${next.number}`, event)}
        >
          {next.title}
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={next.image} alt={next.alt} />
      </footer>
    </main>
  );
}
