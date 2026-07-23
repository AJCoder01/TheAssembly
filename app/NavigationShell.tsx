"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SoundControls } from "../src/audio/SoundControls";

export function NavigationShell() {
  const pathname = usePathname();
  const projectRoute = pathname.startsWith("/project/");

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {projectRoute ? (
        <nav className="route-nav" aria-label="Project navigation">
          <Link href="/">AYUSH JHA</Link>
          <span>PROJECT ARCHIVE</span>
        </nav>
      ) : null}
      <SoundControls />
    </>
  );
}
