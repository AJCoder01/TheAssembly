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
            width="2400"
            height="1600"
            alt=""
          />
          <h1>PROJECT NAME</h1>
          <div className="noscript-meta">
            <span>CATEGORY</span>
            <span>YEAR</span>
            <span>VIEW</span>
          </div>
        </main>
      ) : (
        <main className="noscript-page noscript-archive">
          <header>
            <h1>AYUSH</h1>
            <p>Developer / Product Builder</p>
          </header>
          <div className="noscript-list">
            {PROJECTS.map((project) => (
              <Link href={`/project/${project.number}`} key={project.number}>
                <img
                  src={project.image}
                  width="2400"
                  height="1600"
                  alt=""
                />
                <span>{project.number}</span>
                <strong>PROJECT NAME</strong>
              </Link>
            ))}
          </div>
        </main>
      )}
    </noscript>
  );
}
