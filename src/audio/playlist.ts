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
] as const satisfies readonly MusicTrack[];

export const EFFECTS = {
  projectorStart: "",
  filmThread: "",
  frameStop: "",
  focus: "",
  projectEnter: "",
  projectExit: "",
  shutdown: "",
} as const;

export type EffectName = keyof typeof EFFECTS;
