import { notFound } from "next/navigation";
import { NoScriptFallback } from "../../NoScriptFallback";
import { PortfolioExperience } from "../../PortfolioExperience";
import { findProjectIndex, PROJECTS } from "../../projectData";

type ProjectPageProps = {
  params: Promise<{ number: string }>;
};

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ number: project.number }));
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { number } = await params;
  if (findProjectIndex(number) < 0) notFound();

  return (
    <>
      <PortfolioExperience initialProjectNumber={number} />
      <NoScriptFallback projectNumber={number} />
    </>
  );
}
