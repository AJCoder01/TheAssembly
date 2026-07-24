import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoScriptFallback } from "../../NoScriptFallback";
import { ProjectCaseStudy } from "../../ProjectCaseStudy";
import { findProject, nextProject, PROJECTS } from "../../projectData";

type WorkPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: WorkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} — Ayush Jha`,
    description: project.summary,
  };
}

export default async function ProjectPage({ params }: WorkPageProps) {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) notFound();

  return (
    <>
      <ProjectCaseStudy project={project} next={nextProject(slug)} />
      <NoScriptFallback projectSlug={slug} />
    </>
  );
}
