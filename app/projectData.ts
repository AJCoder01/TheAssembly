export const PROJECTS = [
  {
    number: "01",
    image: "/media/ayush-project-01-placeholder.webp",
  },
  {
    number: "02",
    image: "/media/ayush-project-02-placeholder.webp",
  },
  {
    number: "03",
    image: "/media/ayush-project-03-placeholder.webp",
  },
  {
    number: "04",
    image: "/media/ayush-project-04-placeholder.webp",
  },
] as const;

export function findProjectIndex(value: string | null | undefined) {
  return PROJECTS.findIndex((project) => project.number === value);
}
