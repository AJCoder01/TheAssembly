import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/instrument-sans";
import "@fontsource/ibm-plex-mono/400.css";
import { AudioProvider } from "../src/audio/AudioProvider";
import { NavigationShell } from "./NavigationShell";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "the-assembly-rust.vercel.app";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  let metadataBase: URL;
  try {
    metadataBase = new URL(`${protocol}://${host}`);
  } catch {
    metadataBase = new URL("https://the-assembly-rust.vercel.app");
  }
  const socialImage = new URL("/og.png", metadataBase).toString();

  return {
    title: "Ayush Jha — Product Builder & Developer",
    description:
      "Selected product engineering, AI systems, and interactive frontend work by Ayush Jha.",
    metadataBase,
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "Ayush Jha — Product Builder & Developer",
      description:
        "Product engineering, interactive frontend, and AI systems in a cinematic editorial portfolio.",
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1729,
          height: 910,
          alt: "Abstract three-panel editorial artwork for Ayush Jha’s portfolio",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Ayush Jha — Product Builder & Developer",
      description:
        "Product engineering, interactive frontend, and AI systems in a cinematic editorial portfolio.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: "#050504",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AudioProvider>
          <NavigationShell />
          {children}
        </AudioProvider>
      </body>
    </html>
  );
}
