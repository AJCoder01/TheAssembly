export type PortfolioProject = {
  number: string;
  title: string;
  shortTitle: string;
  category: string;
  year: string;
  image: string;
  alt: string;
  accent: string;
  repository: string;
  summary: string;
  overview: string;
  role: string;
  stack: readonly string[];
  highlights: readonly string[];
};

export const PROJECTS = [
  {
    number: "01",
    title: "TOC Oracle",
    shortTitle: "Oracle",
    category: "Interactive learning / formal languages",
    year: "2026",
    image: "/media/project-oracle.png",
    alt: "TOC Oracle interface showing its cinematic machine-learning experience",
    accent: "#b86b51",
    repository: "https://github.com/AJCoder01/project-oracle",
    summary:
      "A cinematic Theory of Computation lab for testing formal-language patterns and replaying each machine step.",
    overview:
      "TOC Oracle turns abstract automata into a readable interaction. Visitors choose a supported language, switch alphabets, test a string, and replay the tape and stack state with a synchronized explanation log.",
    role: "Product design, frontend engineering, interaction architecture",
    stack: ["Next.js", "TypeScript", "GSAP", "Lenis", "Framer Motion"],
    highlights: [
      "Alphabet-aware language presets and validation",
      "Tape, stack, playback, and explanation views",
      "Cinematic introduction that settles into a practical lab",
    ],
  },
  {
    number: "02",
    title: "Rewind",
    shortTitle: "Rewind",
    category: "AI workflow safety / product engineering",
    year: "2026",
    image: "/media/rewind.png",
    alt: "Rewind product interface explaining recorded assumptions and reviewed repair",
    accent: "#4b755f",
    repository: "https://github.com/AJCoder01/Rewind",
    summary:
      "A human-reviewed recovery system for AI actions whose assumptions become invalid after execution.",
    overview:
      "Rewind records the assumption and dependency lineage behind an approved task. When context changes, it proposes the smallest valid repair: restoring reversible state, correcting communication, preserving still-valid work, and applying the approved change.",
    role: "Product architecture, safety model, full-stack implementation",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "MCP", "Google APIs"],
    highlights: [
      "Immutable approval and recovery plans",
      "Dependency-aware repair instead of chronological undo",
      "Recipient allowlisting, idempotency, and conflict detection",
    ],
  },
  {
    number: "03",
    title: "ASIM Tracker",
    shortTitle: "ASIM",
    category: "Quantitative systems / NLP",
    year: "2026",
    image: "/media/asim-tracker.png",
    alt: "ASIM Tracker repository system view with sentiment and market-state signals",
    accent: "#6b9c83",
    repository: "https://github.com/AJCoder01/asim-tracker",
    summary:
      "A quantitative framework for aligning sentiment shocks with Indian cash-equity market structure.",
    overview:
      "ASIM Tracker combines alternative-news sentiment, order-book imbalance, wavelet-filtered price structure, and a Hawkes-process intensity model. Its constrained execution model is designed around a small retail budget and explicit friction controls.",
    role: "Quantitative research, systems architecture, Python implementation",
    stack: ["Python", "NumPy", "ONNX", "FinBERT", "Redis"],
    highlights: [
      "Text and market streams joined through cross-attention",
      "One-position cardinality and explicit friction gates",
      "Event-driven backtesting without look-ahead shortcuts",
    ],
  },
  {
    number: "04",
    title: "VS Code Clone",
    shortTitle: "Code Study",
    category: "Frontend study / interface reconstruction",
    year: "2024",
    image: "/media/vscode-clone.png",
    alt: "VS Code Clone source study with HTML editor and responsive landing preview",
    accent: "#547b9e",
    repository: "https://github.com/AJCoder01/VSCodeClone",
    summary:
      "An early hand-built interface study focused on product hierarchy, navigation, and responsive CSS.",
    overview:
      "This compact frontend study reconstructs the structure of a developer-tool landing page using plain HTML and CSS. It documents the transition from foundational layout work toward richer product and interaction systems.",
    role: "Frontend implementation",
    stack: ["HTML", "CSS", "Responsive layout"],
    highlights: [
      "Navigation and product-hero reconstruction",
      "Responsive content and feature hierarchy",
      "A clear record of early frontend craft",
    ],
  },
] as const satisfies readonly PortfolioProject[];

export function findProjectIndex(value: string | null | undefined) {
  return PROJECTS.findIndex((project) => project.number === value);
}

export function findProject(value: string | null | undefined) {
  const index = findProjectIndex(value);
  return index >= 0 ? PROJECTS[index] : null;
}

export function nextProject(value: string) {
  const index = findProjectIndex(value);
  return PROJECTS[(Math.max(0, index) + 1) % PROJECTS.length];
}
