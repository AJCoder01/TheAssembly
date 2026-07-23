/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { findProjectIndex, PROJECTS } from "./projectData";

type NoScriptFallbackProps = {
  projectNumber?: string;
};

export function NoScriptFallback({
  projectNumber,
}: NoScriptFallbackProps) {
  const projectIndex = findProjectIndex(projectNumber);

  return (
    <noscript>
      <style>{`.experience{display:none!important}`}</style>
      {projectIndex >= 0 ? (
        <main className="noscript-page noscript-project">
          <Link className="noscript-back" href="/" aria-label="Back to archive">
            ←
          </Link>
          <span className="noscript-number">
            {PROJECTS[projectIndex].number}
          </span>
          <img
            src={PROJECTS[projectIndex].image}
            width="1440"
            height="900"
            alt={PROJECTS[projectIndex].alt}
          />
          <h1>{PROJECTS[projectIndex].title}</h1>
          <div className="noscript-meta">
            <span>{PROJECTS[projectIndex].category}</span>
            <span>{PROJECTS[projectIndex].year}</span>
            <a href={PROJECTS[projectIndex].repository}>SOURCE</a>
          </div>
        </main>
      ) : (
        <main className="noscript-page noscript-archive">
          <header>
            <h1>AYUSH JHA</h1>
            <p>Product Builder / Developer</p>
          </header>
          <div className="noscript-list">
            {PROJECTS.map((project) => (
              <Link href={`/project/${project.number}`} key={project.number}>
                <img
                  src={project.image}
                  width="1440"
                  height="900"
                  alt={project.alt}
                />
                <span>{project.number}</span>
                <strong>{project.title}</strong>
              </Link>
            ))}
          </div>
        </main>
      )}
    </noscript>
  );
}
