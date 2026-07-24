import { notFound, redirect } from "next/navigation";
import { findProject, PROJECTS } from "../../projectData";

type LegacyProjectPageProps = {
  params: Promise<{ number: string }>;
};

export function generateStaticParams() {
  return PROJECTS.map((project) => ({ number: project.number }));
}

export default async function LegacyProjectPage({
  params,
}: LegacyProjectPageProps) {
  const { number } = await params;
  const project = findProject(number);
  if (!project) notFound();
  redirect(`/work/${project.slug}`);
}
