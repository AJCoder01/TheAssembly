"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SoundControls } from "../src/audio/SoundControls";

export function NavigationShell() {
  const pathname = usePathname();
  const workRoute = pathname.startsWith("/work");
  const archiveRoute = pathname.startsWith("/archive");
  const projectRoute =
    pathname.startsWith("/work/") || pathname.startsWith("/project/");

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {projectRoute ? (
        <nav className="route-nav" aria-label="Project navigation">
          <Link href="/">AYUSH JHA</Link>
          <div>
            <Link href="/work">WORK INDEX</Link>
            <span>PROJECT {pathname.split("/").at(-1)?.toUpperCase()}</span>
          </div>
        </nav>
      ) : workRoute ? (
        <nav className="route-nav" aria-label="Work navigation">
          <Link href="/">← Ayush Jha</Link>
          <span>Selected work</span>
        </nav>
      ) : archiveRoute ? (
        <nav className="route-nav" aria-label="Archive navigation">
          <Link href="/">← Ayush Jha</Link>
          <span>Archive / Early studies</span>
        </nav>
      ) : null}
      <SoundControls />
    </>
  );
}
