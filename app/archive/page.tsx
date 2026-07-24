import type { Metadata } from "next";
import Link from "next/link";
import { ARCHIVE_PROJECTS } from "../projectData";

export const metadata: Metadata = {
  title: "Archive — Ayush Jha",
  description: "Early interface studies by Ayush Jha.",
};

export default function ArchivePage() {
  return (
    <main id="main-content" className="archive-page">
      <header className="archive-page__header">
        <p>Archive / Early studies</p>
        <h1>Foundations before systems.</h1>
      </header>
      <ol className="archive-list">
        {ARCHIVE_PROJECTS.map((project) => (
          <li key={project.slug}>
            <Link href={`/work/${project.slug}`}>
              <div>
                <span>{project.number}</span>
                <span>{project.archiveLabel}</span>
                <time>{project.year}</time>
              </div>
              <h2>{project.title}</h2>
              <p>{project.category}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.image} alt={project.alt} />
            </Link>
          </li>
        ))}
      </ol>
      <footer className="archive-page__footer">
        <Link href="/work">View selected work</Link>
        <a href="mailto:ayushwork2401@gmail.com">Email</a>
      </footer>
    </main>
  );
}
