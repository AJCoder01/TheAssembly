import type { Metadata } from "next";
import { WorkIndex } from "./WorkIndex";

export const metadata: Metadata = {
  title: "Selected Work — Ayush Jha",
  description:
    "Selected product engineering, AI systems, and interactive frontend work by Ayush Jha.",
};

export default function WorkPage() {
  return <WorkIndex />;
}
