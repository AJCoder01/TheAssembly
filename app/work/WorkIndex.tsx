"use client";

import Link from "next/link";
import { useState } from "react";
import { PROJECTS } from "../projectData";

export function WorkIndex() {
  const [active, setActive] = useState(0);
  const project = PROJECTS[active];

  return (
    <main id="main-content" className="work-index">
      <header className="work-index__header">
        <p>AYUSH JHA / SELECTED WORK / 2024—2026</p>
        <h1>Work Index</h1>
      </header>
      <div className="work-index__body">
        <figure className="work-index__preview" aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={project.slug}
            src={project.gallery[1].src}
            alt={project.gallery[1].alt}
          />
          <span>{project.number} / 04</span>
        </figure>
        <ol className="work-index__list">
          {PROJECTS.map((item, index) => (
            <li className="work-index__item" key={item.slug}>
              <Link
                href={`/work/${item.slug}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => {
                  window.sessionStorage.setItem(
                    "ayush:return-project",
                    item.slug,
                  );
                  window.sessionStorage.setItem("ayush:return-route", "/work");
                }}
              >
                <span>{item.number}</span>
                <h2>{item.title}</h2>
                <p>{item.category}</p>
                <time>{item.year}</time>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
