import { writeFile } from "node:fs/promises";

const outputPath =
  process.argv[2] ?? "/private/tmp/ayush-nocturne-original.wav";
const sampleRate = 44_100;
const tempo = 54;
const beatSeconds = 60 / tempo;
const beatsPerBar = 3;
const barSeconds = beatSeconds * beatsPerBar;
const barCount = 16;
const duration = barSeconds * barCount;
const frameCount = Math.round(duration * sampleRate);
const left = new Float64Array(frameCount);
const right = new Float64Array(frameCount);

const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

function addSample(time, leftValue, rightValue) {
  const index = Math.floor(time * sampleRate) % frameCount;
  const wrapped = index < 0 ? index + frameCount : index;
  left[wrapped] += leftValue;
  right[wrapped] += rightValue;
}

function stereoWeights(pan) {
  const normalized = (Math.max(-1, Math.min(1, pan)) + 1) * 0.25 * Math.PI;
  return [Math.cos(normalized), Math.sin(normalized)];
}

function addPiano(midi, startBeat, noteBeats, velocity, pan = 0) {
  const frequency = midiToFrequency(midi);
  const start = startBeat * beatSeconds;
  const held = noteBeats * beatSeconds;
  const rendered = held + 2.6;
  const [leftWeight, rightWeight] = stereoWeights(pan);
  const harmonics = [
    [1, 1],
    [2, 0.31],
    [3, 0.13],
    [4, 0.055],
    [5, 0.024],
  ];

  for (let offset = 0; offset < rendered; offset += 1 / sampleRate) {
    const attack = Math.min(1, offset / 0.012);
    const body = Math.exp(-offset / (0.78 + held * 0.36));
    const release =
      offset <= held ? 1 : Math.exp(-(offset - held) / 0.34);
    const felt = 1 - Math.exp(-offset / 0.004);
    const envelope = attack * body * release * felt * velocity;
    if (envelope < 0.000015) continue;

    let sample = 0;
    for (const [multiple, weight] of harmonics) {
      const inharmonicity = 1 + multiple * multiple * 0.00016;
      sample +=
        Math.sin(
          Math.PI * 2 * frequency * multiple * inharmonicity * offset +
            midi * 0.071 * multiple,
        ) * weight;
    }
    sample *= envelope * 0.19;
    addSample(start + offset, sample * leftWeight, sample * rightWeight);
  }
}

function addCello(midi, startBar, bars, velocity, pan = 0) {
  const frequency = midiToFrequency(midi);
  const start = startBar * barSeconds;
  const held = bars * barSeconds;
  const rendered = held + 3.4;
  const [leftWeight, rightWeight] = stereoWeights(pan);
  const harmonics = [
    [1, 1],
    [2, 0.25],
    [3, 0.11],
    [4, 0.045],
  ];

  for (let offset = 0; offset < rendered; offset += 1 / sampleRate) {
    const attack = Math.min(1, offset / 1.15);
    const release =
      offset <= held ? 1 : Math.exp(-(offset - held) / 1.7);
    const envelope = attack * release * velocity;
    if (envelope < 0.000015) continue;

    const vibrato = Math.sin(Math.PI * 2 * 4.7 * offset) * 0.006;
    let sample = 0;
    for (const [multiple, weight] of harmonics) {
      sample +=
        Math.sin(
          Math.PI * 2 * frequency * multiple * offset +
            vibrato * multiple +
            midi * 0.037,
        ) * weight;
    }
    sample *= envelope * 0.075;
    addSample(start + offset, sample * leftWeight, sample * rightWeight);
  }
}

const chords = [
  [50, 57, 62, 65],
  [46, 53, 58, 62],
  [43, 50, 55, 58],
  [45, 52, 57, 61],
  [50, 57, 62, 65],
  [41, 48, 53, 57],
  [48, 55, 60, 64],
  [45, 52, 57, 61],
  [46, 53, 58, 62],
  [45, 50, 57, 62],
  [43, 50, 55, 58],
  [45, 52, 57, 61],
  [50, 57, 62, 65],
  [52, 55, 60, 64],
  [46, 53, 58, 62],
  [45, 52, 57, 61],
];

const melody = [
  [[0, 74, 1.35, 0.58], [1.55, 69, 0.5, 0.38], [2.15, 65, 0.7, 0.34]],
  [[0.15, 70, 1.1, 0.48], [1.5, 69, 0.55, 0.33], [2.12, 65, 0.72, 0.34]],
  [[0, 67, 1.4, 0.48], [1.7, 70, 0.45, 0.34], [2.22, 69, 0.64, 0.31]],
  [[0.2, 73, 1.15, 0.5], [1.62, 69, 0.42, 0.31], [2.15, 64, 0.7, 0.28]],
  [[0, 74, 1.72, 0.56], [2.02, 77, 0.7, 0.36]],
  [[0.18, 72, 1.1, 0.46], [1.52, 69, 0.52, 0.34], [2.18, 65, 0.62, 0.3]],
  [[0, 67, 1.22, 0.43], [1.48, 72, 0.5, 0.37], [2.08, 76, 0.74, 0.35]],
  [[0.12, 73, 1.08, 0.48], [1.46, 72, 0.45, 0.31], [2.05, 69, 0.8, 0.33]],
  [[0, 70, 1.38, 0.5], [1.62, 74, 0.5, 0.36], [2.18, 77, 0.67, 0.33]],
  [[0.15, 69, 1.2, 0.43], [1.62, 65, 0.45, 0.29], [2.14, 62, 0.72, 0.3]],
  [[0, 67, 1.5, 0.48], [1.72, 65, 0.48, 0.3], [2.26, 70, 0.6, 0.34]],
  [[0.18, 73, 1.1, 0.49], [1.52, 76, 0.46, 0.34], [2.1, 69, 0.78, 0.31]],
  [[0, 74, 1.85, 0.56], [2.14, 69, 0.7, 0.34]],
  [[0.15, 72, 1.18, 0.43], [1.62, 67, 0.48, 0.31], [2.18, 64, 0.65, 0.29]],
  [[0, 70, 1.35, 0.48], [1.58, 69, 0.52, 0.33], [2.17, 65, 0.68, 0.31]],
  [[0.12, 73, 1.28, 0.5], [1.63, 69, 0.52, 0.32], [2.2, 64, 0.72, 0.29]],
];

chords.forEach((chord, bar) => {
  const barBeat = bar * beatsPerBar;
  const arpeggio = [0, 1, 2, 1, 3, 1];
  arpeggio.forEach((chordIndex, step) => {
    addPiano(
      chord[chordIndex],
      barBeat + step * 0.5,
      step === 5 ? 0.82 : 0.44,
      step % 2 === 0 ? 0.29 : 0.23,
      step % 2 === 0 ? -0.32 : 0.22,
    );
  });

  melody[bar].forEach(([beat, midi, length, velocity], phraseIndex) => {
    addPiano(
      midi,
      barBeat + beat,
      length,
      velocity,
      phraseIndex % 2 === 0 ? 0.18 : 0.38,
    );
  });

  addCello(chord[0] - 12, bar, 1, 0.42, -0.2);
});

const reverbTaps = [
  [0.071, 0.13],
  [0.127, 0.095],
  [0.211, 0.068],
  [0.347, 0.045],
  [0.521, 0.028],
];
const dryLeft = left.slice();
const dryRight = right.slice();

for (const [delay, gain] of reverbTaps) {
  const offset = Math.round(delay * sampleRate);
  for (let index = 0; index < frameCount; index += 1) {
    const target = (index + offset) % frameCount;
    left[target] += dryRight[index] * gain;
    right[target] += dryLeft[index] * gain;
  }
}

let peak = 0;
for (let index = 0; index < frameCount; index += 1) {
  peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
}
const normalization = peak > 0 ? 0.62 / peak : 1;
const wave = Buffer.allocUnsafe(44 + frameCount * 4);

wave.write("RIFF", 0);
wave.writeUInt32LE(36 + frameCount * 4, 4);
wave.write("WAVE", 8);
wave.write("fmt ", 12);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(2, 22);
wave.writeUInt32LE(sampleRate, 24);
wave.writeUInt32LE(sampleRate * 4, 28);
wave.writeUInt16LE(4, 32);
wave.writeUInt16LE(16, 34);
wave.write("data", 36);
wave.writeUInt32LE(frameCount * 4, 40);

for (let index = 0; index < frameCount; index += 1) {
  const leftSample = Math.max(-1, Math.min(1, left[index] * normalization));
  const rightSample = Math.max(-1, Math.min(1, right[index] * normalization));
  wave.writeInt16LE(Math.round(leftSample * 32767), 44 + index * 4);
  wave.writeInt16LE(Math.round(rightSample * 32767), 46 + index * 4);
}

await writeFile(outputPath, wave);
console.log(
  `Wrote ${duration.toFixed(2)} seconds of original audio to ${outputPath}`,
);
