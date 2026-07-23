import { notFound } from "next/navigation";
import { NoScriptFallback } from "../../NoScriptFallback";
import { ProjectCaseStudy } from "../../ProjectCaseStudy";
import {
  findProject,
  nextProject,
  PROJECTS,
} from "../../projectData";

type ProjectPageProps = {
  params: Promise<{ number: string }>;
};

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ number: project.number }));
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { number } = await params;
  const project = findProject(number);
  if (!project) notFound();

  return (
    <>
      <ProjectCaseStudy project={project} next={nextProject(number)} />
      <NoScriptFallback projectNumber={number} />
    </>
  );
}
