/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FEATURED_PROJECTS, findProjectIndex, PROJECTS } from "./projectData";

type NoScriptFallbackProps = {
  projectSlug?: string;
};

export function NoScriptFallback({
  projectSlug,
}: NoScriptFallbackProps) {
  const projectIndex = findProjectIndex(projectSlug);

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
            {FEATURED_PROJECTS.map((project) => (
              <Link href={`/work/${project.slug}`} key={project.number}>
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
          <Link href="/archive">Archive / Early studies</Link>
        </main>
      )}
    </noscript>
  );
}
