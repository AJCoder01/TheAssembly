export type ProjectMedia = {
  src: string;
  alt: string;
  desktopPosition: string;
  mobilePosition: string;
  aspectRatio: string;
  treatment: "full" | "detail" | "wide";
};

export type PortfolioProject = {
  number: string;
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  year: string;
  image: string;
  alt: string;
  accent: string;
  background: string;
  foreground: string;
  repository: string;
  summary: string;
  overview: string;
  problem: string;
  decision: string;
  result: string;
  technical: string;
  role: string;
  stack: readonly string[];
  highlights: readonly string[];
  gallery: readonly ProjectMedia[];
};

export const PROJECTS = [
  {
    number: "01",
    slug: "toc-oracle",
    title: "TOC Oracle",
    shortTitle: "Oracle",
    category: "Interactive learning / formal languages",
    year: "2026",
    image: "/media/project-oracle.png",
    alt: "TOC Oracle interface showing the formal-language machine lab",
    accent: "#de785a",
    background: "#160f0d",
    foreground: "#f1e8dc",
    repository: "https://github.com/AJCoder01/project-oracle",
    summary:
      "A cinematic Theory of Computation lab that makes every machine decision visible.",
    overview:
      "TOC Oracle turns abstract automata into a readable interaction. Visitors choose a supported language, switch alphabets, test a string, and replay the tape and stack state with a synchronized explanation log.",
    problem:
      "Formal-language exercises are difficult to reason about when the machine state is hidden behind a final accepted or rejected result.",
    decision:
      "Expose the tape, stack, active transition, and explanation as one synchronized sequence instead of four disconnected tools.",
    result:
      "A learner can test a language, replay the machine step by step, and see why each transition happened.",
    technical:
      "Language presets, alphabet validation, playback state, and machine visualization share one typed interaction model.",
    role: "Product design, frontend engineering, interaction architecture",
    stack: ["Next.js", "TypeScript", "GSAP", "Finite-state interaction"],
    highlights: [
      "Alphabet-aware presets and validation",
      "Synchronized tape, stack, playback, and explanation",
      "A practical lab underneath the cinematic introduction",
    ],
    gallery: [
      {
        src: "/media/project-oracle.png",
        alt: "TOC Oracle full interface",
        desktopPosition: "50% 47%",
        mobilePosition: "56% 50%",
        aspectRatio: "16 / 10",
        treatment: "full",
      },
      {
        src: "/media/crops/toc-oracle-detail.jpg",
        alt: "TOC Oracle machine activation detail",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "31 / 34",
        treatment: "detail",
      },
      {
        src: "/media/crops/toc-oracle-wide.jpg",
        alt: "TOC Oracle horizontal machine interface crop",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "50 / 21",
        treatment: "wide",
      },
    ],
  },
  {
    number: "02",
    slug: "rewind",
    title: "Rewind",
    shortTitle: "Rewind",
    category: "AI workflow safety / product engineering",
    year: "2026",
    image: "/media/rewind.png",
    alt: "Rewind interface explaining reviewed recovery for AI actions",
    accent: "#86a68c",
    background: "#101812",
    foreground: "#eef0e6",
    repository: "https://github.com/AJCoder01/Rewind",
    summary:
      "A human-reviewed recovery system for AI actions whose assumptions become invalid.",
    overview:
      "Rewind records the assumption and dependency lineage behind an approved task. When context changes, it proposes the smallest valid repair while preserving work that still matters.",
    problem:
      "Chronological undo is unsafe when an AI action has already created messages, records, or downstream work.",
    decision:
      "Model approvals, assumptions, and dependencies explicitly, then generate the smallest human-reviewed repair instead of erasing history.",
    result:
      "Changed context produces a focused recovery plan that preserves valid work and makes every corrective action inspectable.",
    technical:
      "Immutable plans, recipient allowlists, idempotency keys, and conflict checks keep recovery bounded across database and Google API effects.",
    role: "Product architecture, safety model, full-stack implementation",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "MCP", "Google APIs"],
    highlights: [
      "Immutable approval and recovery plans",
      "Dependency-aware repair instead of chronological undo",
      "Recipient allowlisting, idempotency, and conflict detection",
    ],
    gallery: [
      {
        src: "/media/rewind.png",
        alt: "Rewind full recovery interface",
        desktopPosition: "50% 49%",
        mobilePosition: "52% 50%",
        aspectRatio: "16 / 10",
        treatment: "full",
      },
      {
        src: "/media/crops/rewind-detail.jpg",
        alt: "Rewind assumption lineage detail",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "7 / 8",
        treatment: "detail",
      },
      {
        src: "/media/crops/rewind-wide.jpg",
        alt: "Rewind recovery plan horizontal crop",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "38 / 21",
        treatment: "wide",
      },
    ],
  },
  {
    number: "03",
    slug: "asim-tracker",
    title: "ASIM Tracker",
    shortTitle: "ASIM",
    category: "Quantitative systems / NLP",
    year: "2026",
    image: "/media/asim-tracker.png",
    alt: "ASIM Tracker interface with sentiment and market-state signals",
    accent: "#95b69f",
    background: "#0b1510",
    foreground: "#e8eee5",
    repository: "https://github.com/AJCoder01/asim-tracker",
    summary:
      "A quantitative framework aligning sentiment shocks with Indian cash-equity structure.",
    overview:
      "ASIM Tracker combines alternative-news sentiment, order-book imbalance, wavelet-filtered price structure, and a Hawkes-process intensity model under explicit retail constraints.",
    problem:
      "News sentiment and market microstructure arrive at different speeds, making naive signal alignment noisy and vulnerable to look-ahead bias.",
    decision:
      "Join text and market states through constrained cross-attention while keeping position count, friction, and timing gates explicit.",
    result:
      "The framework produces inspectable event-driven signals and backtests them under realistic retail constraints.",
    technical:
      "FinBERT embeddings, order-book imbalance, wavelet filtering, Hawkes intensity, and ONNX inference feed a one-position execution model.",
    role: "Quantitative research, systems architecture, Python implementation",
    stack: ["Python", "NumPy", "ONNX", "FinBERT", "Redis"],
    highlights: [
      "Text and market streams joined through cross-attention",
      "One-position cardinality and explicit friction gates",
      "Event-driven backtesting without look-ahead shortcuts",
    ],
    gallery: [
      {
        src: "/media/asim-tracker.png",
        alt: "ASIM Tracker full system interface",
        desktopPosition: "50% 48%",
        mobilePosition: "51% 50%",
        aspectRatio: "16 / 10",
        treatment: "full",
      },
      {
        src: "/media/crops/asim-detail.jpg",
        alt: "ASIM sentiment and market-state detail",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "30 / 31",
        treatment: "detail",
      },
      {
        src: "/media/crops/asim-wide.jpg",
        alt: "ASIM signal pipeline horizontal crop",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "2 / 1",
        treatment: "wide",
      },
    ],
  },
  {
    number: "04",
    slug: "vscode-clone",
    title: "VS Code Clone",
    shortTitle: "Code Study",
    category: "Frontend study / interface reconstruction",
    year: "2024",
    image: "/media/vscode-clone.png",
    alt: "VS Code Clone interface study and responsive landing preview",
    accent: "#7ba6ca",
    background: "#10161e",
    foreground: "#ebeff2",
    repository: "https://github.com/AJCoder01/VSCodeClone",
    summary:
      "An early hand-built interface study in product hierarchy and responsive CSS.",
    overview:
      "This compact frontend study reconstructs a developer-tool landing page using plain HTML and CSS. It records the move from foundational layout work toward richer product systems.",
    problem:
      "A complex developer-tool landing page depends on precise hierarchy and responsive behavior even before a component framework is introduced.",
    decision:
      "Reconstruct the page from first principles with semantic HTML, CSS layout, and breakpoint-specific composition.",
    result:
      "The study captures the navigation, product hero, and feature hierarchy as a responsive static implementation.",
    technical:
      "Plain HTML and CSS isolate foundational layout, spacing, and responsive decisions.",
    role: "Frontend implementation",
    stack: ["HTML", "CSS", "Responsive layout"],
    highlights: [
      "Navigation and product-hero reconstruction",
      "Responsive content and feature hierarchy",
      "A clear record of early frontend craft",
    ],
    gallery: [
      {
        src: "/media/vscode-clone.png",
        alt: "VS Code Clone full interface study",
        desktopPosition: "50% 47%",
        mobilePosition: "52% 50%",
        aspectRatio: "16 / 10",
        treatment: "full",
      },
      {
        src: "/media/crops/vscode-detail.jpg",
        alt: "VS Code Clone navigation and code detail",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "30 / 31",
        treatment: "detail",
      },
      {
        src: "/media/crops/vscode-wide.jpg",
        alt: "VS Code Clone horizontal product crop",
        desktopPosition: "50% 50%",
        mobilePosition: "50% 50%",
        aspectRatio: "2 / 1",
        treatment: "wide",
      },
    ],
  },
] as const satisfies readonly PortfolioProject[];

export function findProjectIndex(value: string | null | undefined) {
  return PROJECTS.findIndex(
    (project) => project.number === value || project.slug === value,
  );
}

export function findProject(value: string | null | undefined) {
  const index = findProjectIndex(value);
  return index >= 0 ? PROJECTS[index] : null;
}

export function nextProject(value: string) {
  const index = findProjectIndex(value);
  return PROJECTS[(Math.max(0, index) + 1) % PROJECTS.length];
}
