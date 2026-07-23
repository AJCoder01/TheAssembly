export type MusicTrack = {
  id: string;
  composer: string;
  composition: string;
  performer: string;
  sourceLabel: string;
  sourceUrl: string;
  licence: string;
  sources: readonly string[];
};

export const PLAYLIST = [
  {
    id: "chopin-prelude-e-minor",
    composer: "Frédéric Chopin",
    composition: "Prelude in E minor, Op. 28, No. 4",
    performer: "Recording not yet supplied",
    sourceLabel: "Local permission-cleared recording required",
    sourceUrl: "",
    licence: "Awaiting Ayush’s local recording and permission note",
    sources: [
      "/audio/music/01-chopin-prelude-e-minor.ogg",
      "/audio/music/01-chopin-prelude-e-minor.mp3",
    ],
  },
  {
    id: "beethoven-moonlight-adagio",
    composer: "Ludwig van Beethoven",
    composition:
      "Piano Sonata No. 14, Op. 27 No. 2 — I. Adagio sostenuto",
    performer: "Paul Pitman",
    sourceLabel: "Musopen / Wikimedia Commons",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_sonata_no._14_in_c_sharp_minor_%27moonlight%27%2C_op._27_no._2_-_i._adagio_sostenuto.ogg",
    licence: "Public-domain dedication",
    sources: [
      "/audio/music/02-beethoven-moonlight-adagio.ogg",
      "/audio/music/02-beethoven-moonlight-adagio.mp3",
    ],
  },
  {
    id: "rachmaninoff-elegie",
    composer: "Sergei Rachmaninoff",
    composition: "Élégie in E-flat minor, Op. 3 No. 1",
    performer: "Recording not yet supplied",
    sourceLabel: "Local permission-cleared recording required",
    sourceUrl: "",
    licence: "Awaiting Ayush’s local recording and permission note",
    sources: [
      "/audio/music/03-rachmaninoff-elegie.ogg",
      "/audio/music/03-rachmaninoff-elegie.mp3",
    ],
  },
  {
    id: "chopin-nocturne-c-sharp-minor",
    composer: "Frédéric Chopin",
    composition: "Nocturne in C-sharp minor, B. 49",
    performer: "Recording not yet supplied",
    sourceLabel: "Local permission-cleared recording required",
    sourceUrl: "",
    licence: "Awaiting Ayush’s local recording and permission note",
    sources: [
      "/audio/music/04-chopin-nocturne-c-sharp-minor.ogg",
      "/audio/music/04-chopin-nocturne-c-sharp-minor.mp3",
    ],
  },
] as const satisfies readonly MusicTrack[];

export const EFFECTS = {
  projectorStart: "/audio/sfx/projector-start.mp3",
  filmThread: "/audio/sfx/film-thread.mp3",
  frameStop: "/audio/sfx/frame-stop.mp3",
  focus: "/audio/sfx/projection-focus.mp3",
  projectEnter: "/audio/sfx/project-enter.mp3",
  projectExit: "/audio/sfx/project-exit.mp3",
  shutdown: "/audio/sfx/projector-stop.mp3",
} as const;

export type EffectName = keyof typeof EFFECTS;
