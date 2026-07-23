import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/instrument-sans";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/ibm-plex-mono/400.css";
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
    title: "Ayush — Developer / Product Builder",
    description:
      "Ayush builds thoughtful digital products across product engineering, interactive frontend, and AI systems.",
    metadataBase,
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
    openGraph: {
      title: "Ayush — Developer / Product Builder",
      description:
        "Product engineering, interactive frontend, and AI systems.",
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1729,
          height: 910,
          alt: "Ayush Jha — Product Builder / Developer",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Ayush — Developer / Product Builder",
      description:
        "Product engineering, interactive frontend, and AI systems.",
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#050504",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
