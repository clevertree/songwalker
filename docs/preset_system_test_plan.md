# Test Plan: Generic Preset System

## 1. Overview

Design a unified preset system for SongWalker that supports synths, samples, modular instruments, and effects — with fast search, runtime loading during playback, and a UI for browsing/editing presets in the code editor.

### Primary Library Source

All presets are hosted and managed in a dedicated GitHub repository:

**https://github.com/clevertree/songwalker-library**

This repo serves as the canonical source for all preset data. The SongWalker editor and engine fetch presets from this repo (via GitHub raw URLs or a CDN mirror). The repo structure, index generation, and tagging system are detailed in Section 3.6.

### Goals
- Unified preset format covering oscillators, samplers, effects, and composite instruments
- Song-level tuning variable (A4 default 440 Hz, configurable to 432 Hz etc.)
- High-performance preset search and loading (presets load during song playback like function calls)
- Compatibility with existing WebAudioFont/surikov sample libraries
- Base frequency synchronization so samples render at correct pitch
- Preset editor UI for inserting/editing presets inline in the code
- UI-based sample tuner for verifying and adjusting individual sample and preset pitch
- Efficient tag system for classifying presets (percussion vs melodic, instrument family, etc.)
- Multi-sampler presets: instruments with multiple samples create composite presets with per-zone sampler children
- Sample songs demonstrating piano, drums, synths, and other presets for front-page testing

---

## 2. Tuning System

### 2.1 Song-Level Tuning Variable

Add a song-level `track.tuningPitch` (or `track.a4Frequency`) property defaulting to 440 Hz.

```javascript
track.tuningPitch = 432;  // A4 = 432 Hz (concert pitch alternative)
```

All frequency calculations become:
```
frequency = tuningPitch * 2^((midiNote - 69) / 12)
```

Currently `note_to_frequency()` in `songwalker_core/src/dsp/engine.rs` hardcodes `440.0`. This must become parameterized.

### 2.2 Test Cases: Tuning

| ID | Test | Expected |
|----|------|----------|
| T-1 | Default tuning, A4 note | 440.0 Hz |
| T-2 | `tuningPitch = 432`, A4 note | 432.0 Hz |
| T-3 | `tuningPitch = 432`, C4 note (MIDI 60) | `432 * 2^((60-69)/12)` = ~256.87 Hz |
| T-4 | `tuningPitch = 440`, all 128 MIDI notes | Match standard 12-TET table |
| T-5 | Tuning change mid-song (between tracks) | New tracks use new pitch; in-progress notes unaffected |
| T-6 | Sample playback rate adjusts for tuning | A sample with `rootNote=69` at `tuningPitch=432` plays at rate `432/440` relative to standard |
| T-7 | Tuning applies consistently across oscillator and sampler presets | Same note on both produces same perceived pitch |

---

## 3. Sample Library Analysis

### 3.1 Source Libraries Surveyed

| Library | Location | Format | Size | Count |
|---------|----------|--------|------|-------|
| surikov-samples | `/home/ari/dev/samples/surikov-samples` | JS global vars with base64 audio in zones | ~290 MB | 5,226 files (1,395 instruments + 3,831 percussion) |
| webaudiofont | `/home/ari/dev/samples/webaudiofont` | JS runtime player + script injection loader | Player only | — |
| webaudiofontdata | `/home/ari/dev/samples/webaudiofontdata` | JSON converted from surikov-samples JS | ~367 MB | 1,395 instruments + 3,831 percussion + 82 drum sets |

### 3.2 Current Zone Schema (Shared Across All Three)

```typescript
interface WaveZone {
  keyRangeLow: number;       // MIDI note (0-127)
  keyRangeHigh: number;      // MIDI note (0-127)
  originalPitch: number;     // Centitones (MIDI × 100), e.g., 6000 = C4
  coarseTune?: number;       // Centitones offset
  fineTune?: number;         // Cents offset
  sampleRate: number;        // Native sample rate
  loopStart?: number;        // Sample offset
  loopEnd?: number;          // Sample offset
  delay?: number;            // Start delay
  ahdsr?: AHDSRPoint[];      // Envelope [{t, v}, ...]
  midi?: number;             // 128 = percussion sentinel
  // Audio data (mutually exclusive):
  sample?: string;           // Base64 raw 16-bit PCM (14% of files)
  file?: string;             // Base64 compressed audio/MP3 (86% of files)
}
```

### 3.3 Pitch Reference Details

The playback rate formula from the webaudiofont player:
```
baseDetune = originalPitch - 100 * coarseTune - fineTune
playbackRate = 2^((100 * targetMidiNote - baseDetune) / 1200)
```

**Key issues for the unified format:**
- `originalPitch` is in centitones (MIDI × 100), not Hz
- `coarseTune` is also centitones but represents an offset
- `fineTune` is in cents (1/100 of a semitone)
- Default `originalPitch` when missing: 6000 (Middle C)

### 3.4 Percussion Organization

- Each percussion zone covers exactly one MIDI note (`keyRangeLow == keyRangeHigh`)
- Sentinel value `midi: 128` flags percussion
- MIDI notes 35–81 cover standard GM percussion (47 sounds)
- Multiple drum set variants per library (Standard, Jazz, Room, Power, etc.)

### 3.5 Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Instrument file | `{XXXX}_{Library}_{sf2}.js/json` | `0000_FluidR3_GM_sf2_file.json` |
| Variable name | `_tone_{XXXX}_{Library}` | `_tone_0000_Aspirin_sf2_file` |
| Percussion file | `{NN}_{X}_{Library}.js/json` | `35_0_FluidR3_GM_sf2_file.json` |
| Drum set file | `{Library}_{SetName}.json` | `FluidR3_GM_Standard.json` |
| Program number | `XXXX / 10` = GM program, `XXXX % 10` = variant | `0042` = Program 4, variant 2 |
### 3.6 Preset Library Repository

**Repo:** https://github.com/clevertree/songwalker-library

#### 3.6.1 Repository Structure

```
songwalker-library/
├── index.json                          # Root index (auto-generated)
├── .husky/
│   └── pre-commit                      # Runs index generation script
├── scripts/
│   └── generate-index.js               # Scans all presets, builds index.json
├── instruments/
│   ├── piano/
│   │   ├── FluidR3_GM_Acoustic_Grand_Piano/
│   │   │   ├── preset.json             # PresetDescriptor (references sample files)
│   │   │   ├── zone_C2.wav             # Sample for C2 zone
│   │   │   ├── zone_E2.wav             # Sample for E2 zone
│   │   │   ├── zone_Ab2.wav
│   │   │   └── ...                     # One sample file per zone
│   │   ├── Aspirin_Acoustic_Grand_Piano/
│   │   │   ├── preset.json
│   │   │   └── ...samples...
│   │   └── GeneralUserGS_Acoustic_Grand_Piano/
│   │       ├── preset.json
│   │       └── ...samples...
│   ├── guitar/
│   │   ├── FluidR3_GM_Nylon_Guitar/
│   │   │   ├── preset.json
│   │   │   └── ...samples...
│   │   └── FluidR3_GM_Steel_Guitar/
│   │       ├── preset.json
│   │       └── ...samples...
│   ├── organ/
│   ├── strings/
│   ├── brass/
│   ├── reed/
│   ├── pipe/
│   ├── synth-lead/
│   ├── synth-pad/
│   ├── synth-effects/
│   ├── ethnic/
│   ├── chromatic-percussion/
│   ├── sound-effects/
│   └── bass/
├── percussion/
│   ├── drum-kits/
│   │   ├── FluidR3_GM_Standard/
│   │   │   ├── preset.json             # Composite preset with 47 sampler children
│   │   │   ├── kick.wav                # MIDI 35-36
│   │   │   ├── snare.wav               # MIDI 38-40
│   │   │   ├── hihat_closed.wav        # MIDI 42
│   │   │   └── ...                     # One sample per percussion sound
│   │   ├── FluidR3_GM_Jazz/
│   │   ├── FluidR3_GM_Room/
│   │   └── ...
│   └── individual/                     # Single percussion sounds (optional use)
│       ├── kick/
│       ├── snare/
│       ├── hihat/
│       └── ...
├── effects/
│   ├── reverb/
│   │   └── preset.json
│   ├── delay/
│   │   └── preset.json
│   └── chorus/
│       └── preset.json
└── synths/
    ├── oscillator/
    │   └── preset.json                 # Basic oscillator preset template
    ├── square-lead/
    │   └── preset.json
    └── pad/
        └── preset.json
```

#### 3.6.2 Folder Organization Principles

- **Top level** divides by function: `instruments/`, `percussion/`, `effects/`, `synths/`
- **Second level** (under `instruments/`) groups by **GM category**: piano, guitar, organ, strings, etc.
- **Third level** is the individual preset folder: `{Library}_{InstrumentName}/`
- **Each preset folder is self-contained**: `preset.json` + all referenced sample files in the same directory
- **Sample files** are named descriptively: `zone_{NoteName}.wav` (e.g., `zone_C4.wav`), or by percussion sound name (e.g., `kick.wav`, `hihat_closed.wav`)
- **No deep nesting** beyond 3 levels — keeps paths short for URL fetching

#### 3.6.3 Root Index (Auto-Generated)

The `index.json` at the repo root is the preset catalog/manifest. It is **auto-generated on every commit** via a pre-commit hook.

```json
{
  "version": 1,
  "generatedAt": "2026-02-15T00:00:00Z",
  "presets": [
    {
      "id": "fluidr3-gm-acoustic-grand-piano",
      "name": "Acoustic Grand Piano",
      "path": "instruments/piano/FluidR3_GM_Acoustic_Grand_Piano/preset.json",
      "category": "sampler",
      "tags": ["melodic", "piano", "acoustic", "gm:0", "library:FluidR3_GM"],
      "gmProgram": 0,
      "sourceLibrary": "FluidR3_GM",
      "zoneCount": 22,
      "keyRange": { "low": 0, "high": 127 },
      "tuningVerified": true
    },
    {
      "id": "fluidr3-gm-standard-kit",
      "name": "Standard Drum Kit",
      "path": "percussion/drum-kits/FluidR3_GM_Standard/preset.json",
      "category": "composite",
      "tags": ["percussion", "drum-kit", "standard", "gm-drums:0", "library:FluidR3_GM"],
      "gmProgram": null,
      "sourceLibrary": "FluidR3_GM",
      "zoneCount": 47,
      "keyRange": { "low": 35, "high": 81 },
      "tuningVerified": false
    }
  ]
}
```

**Generation script (`scripts/generate-index.js`):**
1. Recursively scan all `preset.json` files in the repo
2. Read each preset's metadata, tags, zone info
3. Collect into a single sorted array
4. Write `index.json` to repo root
5. Runs via `.husky/pre-commit` hook so the index is always in sync

#### 3.6.4 Preset File Format (preset.json)

Each `preset.json` contains the full `PresetDescriptor` and references sample files **by relative path** within the same directory:

```json
{
  "id": "fluidr3-gm-acoustic-grand-piano",
  "name": "Acoustic Grand Piano",
  "category": "sampler",
  "tags": ["melodic", "piano", "acoustic", "gm:0", "library:FluidR3_GM"],
  "metadata": {
    "gmProgram": 0,
    "gmCategory": "Piano",
    "sourceLibrary": "FluidR3_GM",
    "variant": 0,
    "license": "MIT"
  },
  "graph": {
    "type": "sampler",
    "config": {
      "isDrumKit": false,
      "zones": [
        {
          "keyRange": { "low": 0, "high": 30 },
          "pitch": { "rootNote": 28, "fineTuneCents": 0 },
          "sampleRate": 28000,
          "loop": { "start": 51639, "end": 56404 },
          "audio": { "type": "external", "url": "zone_E1.wav", "codec": "wav" }
        },
        {
          "keyRange": { "low": 31, "high": 38 },
          "pitch": { "rootNote": 38, "fineTuneCents": 0 },
          "sampleRate": 32000,
          "audio": { "type": "external", "url": "zone_D2.wav", "codec": "wav" }
        }
      ]
    }
  }
}
```

**Key rule:** Audio URLs in `preset.json` are **relative to the preset directory**. At runtime they resolve to:
`https://raw.githubusercontent.com/clevertree/songwalker-library/main/instruments/piano/FluidR3_GM_Acoustic_Grand_Piano/zone_E1.wav`

#### 3.6.5 Multi-Sample Instruments as Composite Presets

An instrument with multiple samples (zones) covering different note ranges is represented as a **composite preset** in `"split"` mode, where each child is a sampler with a single sample file matched to its note range:

```json
{
  "id": "fluidr3-gm-acoustic-grand-piano",
  "name": "Acoustic Grand Piano",
  "category": "composite",
  "tags": ["melodic", "piano", "acoustic", "gm:0"],
  "graph": {
    "type": "composite",
    "mode": "split",
    "children": [
      {
        "type": "sampler",
        "config": {
          "isDrumKit": false,
          "zones": [{
            "keyRange": { "low": 0, "high": 30 },
            "pitch": { "rootNote": 28, "fineTuneCents": 0 },
            "sampleRate": 28000,
            "audio": { "type": "external", "url": "zone_E1.wav", "codec": "wav" }
          }]
        }
      },
      {
        "type": "sampler",
        "config": {
          "isDrumKit": false,
          "zones": [{
            "keyRange": { "low": 31, "high": 38 },
            "pitch": { "rootNote": 38, "fineTuneCents": 0 },
            "sampleRate": 32000,
            "audio": { "type": "external", "url": "zone_D2.wav", "codec": "wav" }
          }]
        }
      }
    ]
  }
}
```

This approach means:
- Each sampler child handles exactly one note range with one sample file
- The composite `split` mode routes notes to the correct child by key range
- Individual samples can be tuned, replaced, or previewed independently
- The zone viewer UI can show each child as a discrete segment

#### 3.6.6 Test Cases: Library Repository

| ID | Test | Expected |
|----|------|----------|
| L-1 | Pre-commit hook runs `generate-index.js` | `index.json` updated with all presets |
| L-2 | Add a new preset folder, commit | New entry appears in `index.json` |
| L-3 | Remove a preset folder, commit | Entry removed from `index.json` |
| L-4 | `index.json` lists correct `path` for each preset | All paths resolve to valid `preset.json` |
| L-5 | All sample files referenced in `preset.json` exist | No broken relative paths |
| L-6 | Fetch preset from GitHub raw URL | Returns valid JSON with correct structure |
| L-7 | Fetch sample file from GitHub raw URL | Returns valid audio file |
| L-8 | Folder hierarchy follows GM category grouping | All instruments in correct category folder |
| L-9 | Drum kits in `percussion/drum-kits/` | Each has composite preset with per-note sampler children |
| L-10 | Index file < 200 KB for full library | Efficient for network fetch at startup |
---

## 4. Unified Preset Format

### 4.1 Proposed Schema

```typescript
// Top-level preset descriptor
interface PresetDescriptor {
  id: string;                          // Unique identifier
  name: string;                        // Human-readable name
  category: PresetCategory;            // "synth" | "sampler" | "effect" | "composite"
  tags: string[];                      // Searchable tags: ["melodic", "piano", "gm:0"]
  metadata?: PresetMetadata;
  tuning?: TuningInfo;                 // Tuner analysis results (see Section 8.5)
  graph: PresetNode;                   // The actual instrument/effect graph
}

interface PresetMetadata {
  gmProgram?: number;                  // 0-127 GM program number
  gmCategory?: string;                 // "Piano", "Organ", etc.
  sourceLibrary?: string;              // "FluidR3_GM", "Aspirin", etc.
  variant?: number;                    // Variant index within library
  author?: string;
  license?: string;
}

// Tuning analysis stored per-preset (populated by tuner, Section 8.5)
interface TuningInfo {
  verified: boolean;                   // Has a human/tool verified the tuning?
  isMelodic: boolean;                  // Does pitch detection find a clear fundamental?
  detectedPitchHz?: number;            // Measured fundamental frequency (if melodic)
  expectedPitchHz?: number;            // Expected frequency from rootNote at A4=440
  deviationCents?: number;             // Difference in cents (detected vs expected)
  needsAdjustment: boolean;            // |deviationCents| > threshold (e.g., > 10 cents)
}

type PresetCategory = "synth" | "sampler" | "effect" | "composite";

// --- Tag System ---
// Tags are lowercase strings stored in the `tags` array of each PresetDescriptor.
// They enable efficient filtering and classification.
//
// Reserved tag prefixes:
//   "melodic"          - Preset produces pitched/tonal audio
//   "percussion"       - Preset produces unpitched/percussive audio
//   "drum-kit"         - Assembled drum kit (composite of percussion samples)
//   "gm:{N}"           - GM program number (e.g., "gm:0" = Acoustic Grand Piano)
//   "gm-drums:{N}"     - GM drum set number
//   "library:{name}"   - Source SF2 library (e.g., "library:FluidR3_GM")
//   "family:{name}"    - Instrument family (e.g., "family:keyboard", "family:string")
//   "tuning:verified"  - Tuning has been verified by the tuner tool
//   "tuning:needs-adj" - Sample is out of tune, needs adjustment
//   "tuning:no-pitch"  - Sample is non-melodic (no detectable fundamental)
//
// Heuristic tag assignment during conversion:
//   - midi == 128 → "percussion"
//   - midi != 128 → "melodic"
//   - GM program 0-7 → "piano"
//   - GM program 8-15 → "chromatic-percussion" (check if melodic or percussion per sample)
//   - GM program 24-31 → "guitar"
//   - GM program 32-39 → "bass"
//   - GM program 40-47 → "strings"
//   - etc. (full GM category mapping)
//   - Instruments with loopStart/loopEnd → "sustained", "looped"
//   - Instruments with short samples, no loop → "one-shot"
//   - Source library name → "library:{name}" tag

// Node in the preset graph (modular)
type PresetNode =
  | OscillatorNode
  | SamplerNode
  | EffectNode
  | CompositeNode;

interface OscillatorNode {
  type: "oscillator";
  config: {
    waveform: "sine" | "square" | "sawtooth" | "triangle" | "custom";
    detune?: number;          // Cents
    envelope?: ADSRConfig;
    mixer?: number;           // 0.0 - 1.0
  };
}

interface SamplerNode {
  type: "sampler";
  config: {
    zones: SampleZone[];
    isDrumKit: boolean;
    envelope?: ADSRConfig;
  };
}

interface SampleZone {
  keyRange: { low: number; high: number };      // MIDI note range
  velocityRange?: { low: number; high: number }; // Future: velocity layers
  pitch: {
    rootNote: number;          // MIDI note (integer 0-127)
    fineTuneCents: number;     // Cents offset (-100 to +100)
  };
  sampleRate: number;
  loop?: { start: number; end: number };         // Sample offsets
  audio: AudioReference;
}

// Audio data can be inline or external
type AudioReference =
  | { type: "inline-pcm"; data: string; bitsPerSample: 16 }
  | { type: "inline-file"; data: string; codec: "mp3" | "wav" | "ogg" }
  | { type: "external"; url: string; codec: string; sha256?: string }
  | { type: "content-addressed"; hash: string; codec: string };

interface EffectNode {
  type: "effect";
  effectType: "reverb" | "delay" | "chorus" | "eq" | "compressor" | "filter";
  config: Record<string, number | string | boolean>;
}

// Composite: an instrument + effects chain, or layered instruments
interface CompositeNode {
  type: "composite";
  mode: "layer" | "split" | "chain";
  children: PresetNode[];
  config?: {
    splitPoints?: number[];     // For key-split mode: MIDI note boundaries
    mixLevels?: number[];       // Per-child mix levels for layer mode
  };
}

interface ADSRConfig {
  attack: number;   // Seconds
  decay: number;    // Seconds
  sustain: number;  // 0.0 - 1.0
  release: number;  // Seconds
}
```

### 4.2 Composite Preset Examples

**Layered piano + pad:**
```json
{
  "id": "layered-piano-pad",
  "name": "Warm Piano Pad",
  "category": "composite",
  "tags": ["piano", "pad", "layered"],
  "graph": {
    "type": "composite",
    "mode": "layer",
    "children": [
      {
        "type": "sampler",
        "config": { "zones": ["..."], "isDrumKit": false }
      },
      {
        "type": "oscillator",
        "config": { "waveform": "triangle", "mixer": 0.3, "envelope": { "attack": 0.5, "decay": 0.2, "sustain": 0.6, "release": 1.0 } }
      }
    ],
    "config": { "mixLevels": [0.7, 0.3] }
  }
}
```

**Instrument with effects chain:**
```json
{
  "id": "guitar-with-reverb",
  "name": "Reverb Guitar",
  "category": "composite",
  "tags": ["guitar", "reverb"],
  "graph": {
    "type": "composite",
    "mode": "chain",
    "children": [
      { "type": "sampler", "config": { "zones": ["..."], "isDrumKit": false } },
      { "type": "effect", "effectType": "reverb", "config": { "wet": 0.4, "roomSize": 0.7 } },
      { "type": "effect", "effectType": "delay", "config": { "time": 0.25, "feedback": 0.3, "wet": 0.2 } }
    ]
  }
}
```

### 4.3 Song Format Integration

```javascript
// Direct constructor (preferred new syntax)
const synth = Oscillator({ type: 'triangle', attack: 0.01 });

// Preset lookup
const lead = loadPreset(/FluidR3.*Guitar/i);
const lead = loadPreset("FluidR3_GM/Acoustic Guitar");

// Composite in song code
const layered = Composite({
  mode: 'layer',
  children: [lead, Oscillator({ type: 'sine', mixer: 0.2 })],
  effects: [Reverb({ wet: 0.3 })]
});

// Tuning
track.tuningPitch = 432;
```

---

## 5. Preset Index & Search Performance

### 5.1 Current Performance Problems

1. **O(n) linear scan**: `findPreset()` iterates an async generator sequentially until a regex/string match is found
2. **Network-dependent enumeration**: WebAudioFont library fetches JSON catalogs from CDN on every generator iteration
3. **No caching**: Each `loadPreset()` call re-scans from scratch
4. **No pre-indexing**: Preset metadata is embedded in large audio data files — must load the entire file to discover zone ranges

### 5.2 Proposed Index Architecture

The index is built from `index.json` fetched from https://github.com/clevertree/songwalker-library (raw URL).

```
PresetIndex (in-memory, built at startup from songwalker-library/index.json)
├── CatalogEntries[]
│   ├── id: string
│   ├── name: string
│   ├── path: string                                    // Relative path in repo
│   ├── category: PresetCategory
│   ├── tags: string[]
│   ├── gmProgram?: number
│   ├── sourceLibrary?: string
│   ├── tuningVerified: boolean
│   └── dataUrl: string (resolved GitHub raw URL to preset.json)
├── SearchIndex
│   ├── byName: HashMap<string, CatalogEntry[]>       // name → entries
│   ├── byTag: HashMap<string, CatalogEntry[]>         // tag → entries
│   ├── byGMProgram: HashMap<number, CatalogEntry[]>   // program → entries
│   ├── byLibrary: HashMap<string, CatalogEntry[]>     // library → entries
│   └── byTagPrefix: HashMap<string, CatalogEntry[]>   // e.g., "melodic" → all melodic
└── Cache
    ├── loadedPresets: HashMap<string, PresetDescriptor>  // id → full preset
    └── decodedBuffers: HashMap<string, AudioBuffer>      // audio hash → decoded buffer
```

### 5.3 Search Strategy

1. **Manifest file**: `index.json` from `songwalker-library` repo (~50-200 KB) listing all preset metadata without audio data
2. **In-memory index**: Built from `index.json` at startup, supports:
   - Exact name match: O(1) HashMap lookup
   - Regex match: O(n) over name index only (not audio data)
   - Tag search: O(1) per tag (e.g., all `"melodic"` or all `"percussion"` presets)
   - GM program lookup: O(1)
   - Fuzzy match: Levenshtein distance over name index
   - Tag prefix search: O(1) for `"library:FluidR3_GM"`, `"family:keyboard"`, etc.
3. **Lazy audio loading**: Only fetch/decode audio data when a preset is actually used
4. **LRU cache**: Keep recently used presets in memory, evict least-recently-used when memory pressure
5. **Tag-based filtering**: Tags like `"melodic"` vs `"percussion"` enable fast category filtering without parsing preset contents

### 5.4 Loading Pipeline (Runtime)

Since presets load during song playback (like function calls), the pipeline must be fast:

```
loadPreset("FluidR3_GM/Acoustic Guitar")
  ├─ 1. Index lookup in songwalker-library/index.json (< 1ms) → CatalogEntry
  ├─ 2. Cache check → hit? Return cached preset
  ├─ 3. Fetch preset.json from GitHub raw URL (~10-200ms)
  ├─ 4. Parse & validate → PresetDescriptor
  ├─ 5. Fetch & decode sample files (async, per-zone):
  │     ├─ Content-addressed cache check → skip if already decoded
  │     ├─ Fetch zone_XX.wav from same directory as preset.json
  │     ├─ Codec decode (WAV: ~5ms, MP3: async ~50ms)
  │     └─ Store decoded buffer in cache
  └─ 6. Build InstrumentInstance → ready for note playback
```

### 5.5 Prefetch / Ahead-of-Time Strategy

The compiler can statically analyze `loadPreset()` calls from song source code to prefetch:

```
Compile phase:
  1. Parse .sw source
  2. Extract all loadPreset() calls and their arguments
  3. Resolve to CatalogEntries where possible (exact string matches)
  4. Begin fetching preset data in parallel before playback starts

Runtime phase:
  5. When loadPreset() executes, check prefetch cache first
  6. Fall back to runtime fetch if not prefetched (regex matches, dynamic args)
```

### 5.6 Test Cases: Search & Loading Performance

| ID | Test | Target |
|----|------|--------|
| P-1 | Index build from manifest (1,395 instruments + 3,831 percussion) | < 50ms |
| P-2 | Exact name lookup | < 1ms |
| P-3 | Regex search across all preset names | < 10ms |
| P-4 | Tag-based filter (e.g., all "piano" presets) | < 1ms |
| P-5 | GM program lookup | < 1ms |
| P-6 | Full preset load (fetch + parse + decode) cold | < 500ms |
| P-7 | Cached preset reload | < 1ms |
| P-8 | Concurrent loading of 5 presets (song startup) | < 1s total |
| P-9 | Prefetch analysis from `.sw` source | < 10ms |
| P-10 | LRU eviction under memory pressure | Maintains < 100 MB cache |
| P-11 | Content-addressed dedup: same sample across libraries | Decoded only once |

---

## 6. Sample Frequency Synchronization

### 6.1 Problem

Samples have a recorded pitch (`originalPitch`) that may differ from the note being played. The playback rate must be adjusted so the sample sounds at the correct pitch. Additionally, non-standard tuning (e.g., 432 Hz) must be applied on top.

### 6.2 Playback Rate Calculation

```
// Given:
//   targetMidiNote: the note being played (0-127)
//   zone.pitch.rootNote: the MIDI note the sample was recorded at
//   zone.pitch.fineTuneCents: fine tune offset in cents
//   tuningPitch: song-level A4 frequency (default 440)

// Standard rate (ignoring tuning):
baseRate = 2^((targetMidiNote - zone.pitch.rootNote - zone.pitch.fineTuneCents/100) / 12)

// Tuning adjustment:
tuningRatio = tuningPitch / 440.0
finalRate = baseRate * tuningRatio
```

### 6.3 Test Cases: Sample Pitch Sync

| ID | Test | Expected |
|----|------|----------|
| S-1 | Play root note of sample (target == rootNote), 440 Hz tuning | Rate = 1.0 |
| S-2 | Play one octave above root | Rate = 2.0 |
| S-3 | Play one octave below root | Rate = 0.5 |
| S-4 | Sample with fineTune = -6 cents, play root note | Rate = 2^(6/1200) ≈ 1.00347 |
| S-5 | Play root note at 432 Hz tuning | Rate = 432/440 ≈ 0.98182 |
| S-6 | Play C4 on sample with rootNote=60, tuning 440 | Rate = 1.0 |
| S-7 | Play C4 on sample with rootNote=48, tuning 440 | Rate = 2.0 (one octave) |
| S-8 | Convert legacy `originalPitch: 2800` → rootNote=28, fineTuneCents=0 | Correct |
| S-9 | Convert legacy `originalPitch: 6012, coarseTune: 0, fineTune: -6` | rootNote=60, fineTuneCents=6 |
| S-10 | Drum kit zone (isDrumKit=true), play mapped note | Rate matches zone's original pitch regardless of tuning |

---

## 7. Preset Conversion Pipeline

### 7.1 Converting Existing Libraries → Unified Format

```
Source (surikov-samples / webaudiofontdata)
  │
  ├─ 1. Parse JS/JSON zone data
  ├─ 2. Normalize pitch: originalPitch/100 → rootNote, fineTune → fineTuneCents
  ├─ 3. Extract audio data:
  │     ├─ Inline base64 → decode → write to content-addressed file store
  │     ├─ SHA256 dedup (gen.js approach — many zones share identical audio)
  │     └─ Choose codec: keep MP3 for file-based, convert PCM to WAV/FLAC
  ├─ 4. Build SampleZone[] from zone array
  ├─ 5. Detect isDrumKit from midi==128 sentinel
  ├─ 6. Map instrument name from XxXx_Library pattern → GM name + library + variant
  ├─ 7. Generate tags from GM category, library, instrument name
  └─ 8. Write PresetDescriptor JSON + manifest entry
```

### 7.2 Test Cases: Conversion

| ID | Test | Expected |
|----|------|----------|
| C-1 | Convert FluidR3_GM Piano (program 0) | All 22 zones preserved with correct key ranges |
| C-2 | Convert percussion file (single zone, midi=128) | isDrumKit=true, keyRange matches single note |
| C-3 | Convert assembled drum set (47 zones) | All 47 zones with correct MIDI note mapping |
| C-4 | Pitch normalization: originalPitch 6000, coarseTune 0, fineTune 0 | rootNote=60, fineTuneCents=0 |
| C-5 | Pitch normalization: originalPitch 2800, coarseTune 0, fineTune -6 | rootNote=28, fineTuneCents=6 |
| C-6 | Audio dedup: same sample across Aspirin and FluidR3 | Single audio file, two references |
| C-7 | Roundtrip: convert → load → play note → compare to original player | Identical pitch and timing |
| C-8 | Convert all 1,395 instruments without errors | 100% success rate |
| C-9 | Convert all 3,831 percussion files without errors | 100% success rate |
| C-10 | Manifest file generated with correct metadata | All entries searchable |

---

## 8. Preset UI

### 8.1 Context

The preset UI appears in the web editor (Monaco-based) when a user wants to insert or edit a `loadPreset()` call or direct constructor. It should allow browsing, previewing, and configuring presets in a structured hierarchy.

### 8.2 UI Components

#### 8.2.1 Preset Browser (Triggered on Insert/Edit)

```
┌──────────────────────────────────────────────────────┐
│ Preset Browser                              [×]      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🔍 Search: [acoustic guitar________] [▾ All]    │ │
│ │   Filter: [Synth] [Sampler] [Effect] [Composite] │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ Results ────────────────────┬─ Preview ─────────┐ │
│ │ ▸ Piano (12 variants)       │                    │ │
│ │   ├ FluidR3_GM: Grand Piano │ Name: Nylon Guitar │ │
│ │   ├ Aspirin: Grand Piano    │ Library: FluidR3   │ │
│ │   └ GeneralUser: Grand ...  │ GM#: 24            │ │
│ │ ▸ Guitar (8 variants)       │ Zones: 14          │ │
│ │   ├ FluidR3_GM: Nylon ◄──  │ Range: E2 - G#5    │ │
│ │   ├ FluidR3_GM: Steel      │                    │ │
│ │   └ ...                     │ [▶ Preview C4]     │ │
│ │ ▸ Drum Kits (7)            │                    │ │
│ │ ▸ Effects (5)               │ ┌─ Keyboard ─────┐ │ │
│ │ ▸ Synths (4)                │ │ ░░█░░█░░░█░░█░ │ │ │
│ │                             │ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │ │
│ │                             │ └────────────────┘ │ │
│ └─────────────────────────────┴────────────────────┘ │
│                                                      │
│ [Insert as loadPreset()]  [Insert as Constructor]    │
└──────────────────────────────────────────────────────┘
```

**Trigger points:**
- Typing `loadPreset(` → autocomplete opens browser
- Clicking a gutter icon next to an existing `loadPreset()` line
- Command palette: "Insert Preset"
- Right-click context menu on an existing preset reference

**Search features:**
- Real-time fuzzy search over preset names, tags, GM categories
- Filter toggles by category (synth/sampler/effect/composite)
- Library filter dropdown
- GM program number search (e.g., "gm:24" for Nylon Guitar)

#### 8.2.2 Preset Editor (Hierarchy View)

When a selected preset is a composite or the user wants to customize, show an editable tree:

```
┌──────────────────────────────────────────────────────┐
│ Preset Editor: "My Custom Guitar"                    │
│                                                      │
│ ▾ Composite (chain)                                  │
│   ├─ ▾ Sampler: "Nylon Guitar"                       │
│   │    ├─ Zones: 14 (E2–G#5) [View Zones]           │
│   │    ├─ Envelope                                   │
│   │    │   Attack:  [0.01_] s                        │
│   │    │   Decay:   [0.10_] s                        │
│   │    │   Sustain: [0.70_]                          │
│   │    │   Release: [0.30_] s                        │
│   │    └─ isDrumKit: ☐                               │
│   ├─ ▾ Oscillator: "Sub Bass Layer"                  │
│   │    ├─ Waveform: [▾ sine     ]                    │
│   │    ├─ Mixer:    [0.20_]                          │
│   │    ├─ Detune:   [0___] cents                     │
│   │    └─ Envelope                                   │
│   │        Attack:  [0.05_] s                        │
│   │        Decay:   [0.20_] s                        │
│   │        Sustain: [0.60_]                          │
│   │        Release: [1.00_] s                        │
│   ├─ ▾ Effect: Reverb                                │
│   │    ├─ Wet:      [0.40_]                          │
│   │    └─ RoomSize: [0.70_]                          │
│   └─ ▾ Effect: Delay                                 │
│        ├─ Time:     [0.25_] s                        │
│        ├─ Feedback: [0.30_]                          │
│        └─ Wet:      [0.20_]                          │
│                                                      │
│ [+ Add Layer] [+ Add Effect] [Remove Selected]       │
│                                                      │
│ [Save as Preset]  [Insert into Song]  [Cancel]       │
└──────────────────────────────────────────────────────┘
```

**Features:**
- Tree view of the preset graph (composite nodes expandable)
- Inline parameter editing with sliders/number inputs
- Add/remove layers, effects, sub-instruments
- Drag-and-drop reordering of effects chain
- "Save as Preset" to create a reusable custom preset
- "Insert into Song" generates the appropriate `.sw` code

#### 8.2.3 Zone Viewer (for Sampler Presets)

```
┌──────────────────────────────────────────────────────┐
│ Zone Map: "Nylon Guitar" (14 zones)                  │
│                                                      │
│ MIDI: 0    24   36   48   60   72   84   96  127     │
│       ├────┼────┼────┼────┼────┼────┼────┼────┤     │
│       │ Z1 │ Z2 │ Z3 │ Z4 │ Z5 │ Z6 │ Z7 │ Z8 │     │
│       │ C1 │ C2 │ E2 │ C3 │ C4 │ E4 │ C5 │ C6 │     │
│       └────┴────┴────┴────┴────┴────┴────┴────┘     │
│                    ▲ rootNote marker                  │
│                                                      │
│ Selected: Zone 5 (C4)                                │
│   Key Range: 55–65  |  Root: 60 (C4)                 │
│   Fine Tune: 0 cents  |  Sample Rate: 44100          │
│   Loop: 12345–56789  |  Audio: MP3, 12.4 KB          │
│   [▶ Play Zone]  [▶ Play at C4]  [▶ Play at A4]     │
└──────────────────────────────────────────────────────┘
```

#### 8.2.4 Sample Tuner UI

A dedicated tuning tool for verifying and adjusting the pitch of individual samples and entire presets. This UI helps ensure samples play at the correct pitch and flags issues.

```
┌──────────────────────────────────────────────────────┐
│ Sample Tuner                                [×]      │
│                                                      │
│ Preset: "FluidR3_GM Acoustic Grand Piano"            │
│ Overall Status: ⚠ 2 of 22 zones need adjustment     │
│                                                      │
│ ┌─ Zone List ──────────────────────────────────────┐ │
│ │ Zone │ Root  │ Expected  │ Detected  │ Deviation │ │
│ │──────│───────│───────────│───────────│───────────│ │
│ │  1   │ E1    │  41.20 Hz │  41.18 Hz │  -0.8¢ ✓ │ │
│ │  2   │ D2    │  73.42 Hz │  73.40 Hz │  -0.5¢ ✓ │ │
│ │  3   │ Ab2   │ 103.83 Hz │ 103.80 Hz │  -0.5¢ ✓ │ │
│ │  4   │ C3    │ 130.81 Hz │ 128.50 Hz │ -30.8¢ ⚠ │ │
│ │  5   │ C4    │ 261.63 Hz │   —       │  N/A  ⊘  │ │
│ │  ...                                             │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Legend:  ✓ In tune (< 10¢)                           │
│          ⚠ Needs adjustment (≥ 10¢ deviation)        │
│          ⊘ No pitch detected (non-melodic sample)    │
│                                                      │
│ ┌─ Selected Zone: 4 (C3) ─────────────────────────┐ │
│ │                                                  │ │
│ │ ┌─ Pitch Visualization ───────────────────────┐  │ │
│ │ │        ▼ expected (130.81 Hz)                │  │ │
│ │ │   ─────┼─────────────────────                │  │ │
│ │ │     ▲ detected (128.50 Hz)                   │  │ │
│ │ │                                              │  │ │
│ │ │   Deviation: -30.8 cents                     │  │ │
│ │ └──────────────────────────────────────────────┘  │ │
│ │                                                  │ │
│ │ Root Note: [C3 ▾]     Fine Tune: [-30.8] cents   │ │
│ │                                                  │ │
│ │ [▶ Play Original] [▶ Play Corrected] [▶ Play A4] │ │
│ │                                                  │ │
│ │ [Auto-Correct Fine Tune]  [Mark as Non-Melodic]  │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ [Auto-Tune All Zones]  [Save Changes]  [Cancel]      │
└──────────────────────────────────────────────────────┘
```

**Tuner Features:**

1. **Pitch Detection (per zone)**:
   - Analyze sample audio using autocorrelation or FFT to detect fundamental frequency
   - Compare detected pitch to expected pitch (from `rootNote` at A4=440 Hz)
   - Report deviation in cents
   - Flag zones exceeding a threshold (e.g., > 10 cents)

2. **Non-Melodic Detection**:
   - If pitch detection finds no clear fundamental (noise, percussion, complex transient), flag as "non-melodic"
   - Inform the user: "This sample does not appear to be melodic (no detectable pitch)"
   - Offer to tag the preset as `"percussion"` or `"tuning:no-pitch"`
   - Non-melodic samples skip tuning adjustment

3. **Correction Actions**:
   - **Auto-Correct Fine Tune**: Set `fineTuneCents` to compensate for detected deviation
   - **Change Root Note**: If the deviation is > 50 cents, suggest changing `rootNote` instead
   - **Mark as Non-Melodic**: Tag sample/preset and skip future tuning checks
   - **Play Original vs Corrected**: A/B comparison so the user can hear the difference

4. **Batch Operations**:
   - **Auto-Tune All Zones**: Run pitch detection on all zones, apply corrections
   - **Scan Entire Library**: Queue all presets for tuning verification (background task)
   - Results stored in `preset.json` as the `tuning` field (see `TuningInfo` type)

5. **Integration with Preset Tags**:
   - After tuning, auto-update tags: `"tuning:verified"`, `"tuning:needs-adj"`, `"tuning:no-pitch"`
   - The `index.json` generation script picks up `tuningVerified` from the preset

#### 8.2.5 Test Cases: Sample Tuner

| ID | Test | Expected |
|----|------|----------|
| TU-1 | Analyze a correctly-tuned piano sample (A4 zone) | Detected ~440 Hz, deviation < 2 cents, status ✓ |
| TU-2 | Analyze an out-of-tune sample (30 cents flat) | Deviation reported as -30¢, status ⚠ |
| TU-3 | Analyze a percussion sample (kick drum) | No pitch detected, status ⊘, suggests "non-melodic" |
| TU-4 | Auto-correct fine tune on a +15¢ sharp sample | `fineTuneCents` adjusted by -15, re-analysis shows < 2¢ |
| TU-5 | Auto-correct when deviation > 50¢ | Suggests changing `rootNote` instead of `fineTuneCents` |
| TU-6 | Play Original vs Play Corrected | Audibly different pitches, corrected matches expected |
| TU-7 | Batch auto-tune all zones of a 22-zone piano | All zones analyzed, corrections applied, tags updated |
| TU-8 | Mark sample as non-melodic | Tag `"tuning:no-pitch"` added, `isMelodic: false` in tuning info |
| TU-9 | Tuner results saved to `preset.json` | `tuning` field populated with detection results |
| TU-10 | Scan entire library (background) | Progress bar, all presets get `tuningVerified` flag |
| TU-11 | `index.json` reflects tuning status after regeneration | `tuningVerified` field matches preset data |
| TU-12 | Tuner respects song-level `tuningPitch` | Expected frequency calculated using current tuning, not hardcoded 440 |

### 8.3 Code Generation

When inserting a preset from the UI, generate appropriate `.sw` code:

**Simple sampler:**
```javascript
const guitar = loadPreset("FluidR3_GM/Nylon Guitar")
```

**Oscillator with config:**
```javascript
const bass = Oscillator({ type: 'sine', mixer: 0.2, attack: 0.05, release: 1.0 })
```

**Composite:**
```javascript
const lead = Composite({
  mode: 'chain',
  children: [
    loadPreset("FluidR3_GM/Nylon Guitar"),
    Oscillator({ type: 'sine', mixer: 0.2 }),
  ],
  effects: [
    Reverb({ wet: 0.4, roomSize: 0.7 }),
    Delay({ time: 0.25, feedback: 0.3, wet: 0.2 })
  ]
})
```

**Editing existing:** When editing, the UI parses the existing code line, opens the editor with current values, and replaces the line with updated code on save.

### 8.4 Test Cases: Preset UI

| ID | Test | Expected |
|----|------|----------|
| U-1 | Open browser via `loadPreset(` autocomplete trigger | Browser appears with full catalog |
| U-2 | Search "piano" | Shows all piano variants grouped by GM program |
| U-3 | Filter by "sampler" category | Hides synths and effects |
| U-4 | Select a preset, click Preview | Plays a C4 note with that preset |
| U-5 | Click "Insert as loadPreset()" | Correct code inserted at cursor |
| U-6 | Click "Insert as Constructor" for oscillator | `Oscillator({...})` inserted |
| U-7 | Open editor on existing `loadPreset()` line | Parses current config, shows in editor |
| U-8 | Add effect to composite preset | Tree updates, code preview updates |
| U-9 | Edit ADSR values via sliders | Immediate audible preview feedback |
| U-10 | Keyboard preview: click notes | Plays sample at clicked pitch |
| U-11 | Zone viewer shows correct key ranges | Matches sample data |
| U-12 | Insert composite preset | Valid `.sw` code generated with all children/effects |
| U-13 | Save custom preset | Stored in user preset library, searchable |
| U-14 | Edit existing composite in code | Round-trip parse → edit → regenerate preserves config |

---

## 9. Sample Songs (Front Page Demos)

### 9.1 Purpose

Create a set of sample `.sw` songs that load on the front page to demonstrate different preset types and serve as integration tests. Each song should be short (8–32 bars), musically interesting, and exercise a specific preset category.

### 9.2 Planned Songs

#### Song 1: "Piano Ballad" (Piano + Reverb)
```javascript
const piano = loadPreset("FluidR3_GM/Acoustic Grand Piano")
const reverb = loadPreset("Reverb")
track.beatsPerMinute = 72;
track.tuningPitch = 440;

melody(piano); chords(piano); 

track melody(inst) {
    track.instrument = inst;
    track.effects = [reverb];
    track.duration = 1/4;
    // Simple melodic line: C major scale passages, arpeggios
    E4 /2  G4 /2  A4 /2  G4 /2
    C5 /1
    // ... 16-32 bars
}

track chords(inst) {
    track.instrument = inst;
    track.duration = 1;
    // Whole-note chords
    [C3, E3, G3] /1
    [F3, A3, C4] /1
    // ...
}
```
**Tests:** Sampler preset loading, multi-zone key splits, reverb effect, polyphony.

#### Song 2: "Rock Beat" (Drum Kit + Bass + Guitar)
```javascript
const drums = loadPreset("FluidR3_GM/Standard")
const bass = loadPreset("FluidR3_GM/Fingered Bass")
const guitar = loadPreset("FluidR3_GM/Overdriven Guitar")
track.beatsPerMinute = 120;

beat(drums); bassline(bass); riff(guitar);

track beat(kit) {
    track.instrument = kit;
    track.velocityDivisor = 8;
    // Standard rock pattern
    abd     chh     /2
    chh     as      /2
    abd     chh     /2
    chh     as      /2
    // ... 16 bars
}

track bassline(inst) {
    track.instrument = inst;
    track.duration = 1/4;
    E2 /2  E2 /4  G2 /4
    A2 /2  A2 /4  B2 /4
    // ...
}
```
**Tests:** Drum kit composite preset (percussion tags), bass (melodic tag), multi-track playback, concurrent preset loading.

#### Song 3: "Synth Waves" (Oscillator Presets)
```javascript
const lead = Oscillator({ type: 'sawtooth', attack: 0.05, release: 0.3 })
const pad = Oscillator({ type: 'triangle', mixer: 0.3, attack: 0.5, release: 1.0 })
const sub = Oscillator({ type: 'sine', mixer: 0.5 })
track.beatsPerMinute = 128;

synth_lead(lead); synth_pad(pad); sub_bass(sub);

track synth_lead(inst) {
    track.instrument = inst;
    track.duration = 1/8;
    C4 D4 Eb4 F4 G4 F4 Eb4 D4
    // ... arpeggiated patterns
}
```
**Tests:** Oscillator presets (no samples), multiple waveforms, envelope parameters, layering.

#### Song 4: "432 Hz Meditation" (Alternate Tuning)
```javascript
const pad = Oscillator({ type: 'sine', attack: 1.0, sustain: 0.8, release: 2.0 })
const bowl = loadPreset("FluidR3_GM/Pad 2 (warm)")
track.beatsPerMinute = 60;
track.tuningPitch = 432;

drone(pad); texture(bowl);
```
**Tests:** Non-standard tuning (432 Hz), long envelopes, sampler + oscillator pitch consistency under alternate tuning.

#### Song 5: "Composite Demo" (Layered/Chain Presets)
```javascript
const piano = loadPreset("FluidR3_GM/Acoustic Grand Piano")
const strings = loadPreset("FluidR3_GM/String Ensemble 1")
const reverb = loadPreset("Reverb")
const delay = loadPreset("Delay")

const layered = Composite({
  mode: 'layer',
  children: [piano, strings],
  effects: [reverb, delay]
});

track.beatsPerMinute = 90;
main(layered);
```
**Tests:** Composite preset (layer mode), effects chain, multiple sampler presets loaded concurrently, voice management.

### 9.3 Test Cases: Sample Songs

| ID | Test | Expected |
|----|------|----------|
| SS-1 | "Piano Ballad" loads and plays without errors | All presets load, notes sound at correct pitch |
| SS-2 | "Rock Beat" drum kit plays correct percussion sounds | `abd`=kick, `chh`=closed hihat, `as`=snare |
| SS-3 | "Synth Waves" oscillators produce correct waveforms | Sawtooth/triangle/sine distinguishable |
| SS-4 | "432 Hz Meditation" tunes all notes to 432 reference | A4 measures at 432 Hz, not 440 Hz |
| SS-5 | "Composite Demo" layers piano + strings | Both audible simultaneously at correct mix |
| SS-6 | Front page loads song list, user can select and play | Song selector UI works, playback starts within 2s |
| SS-7 | Each song prefetches all presets before playback | No audible gaps from late-loading presets |
| SS-8 | Songs render correctly via CLI offline renderer | WAV output matches web playback |
| SS-9 | All sample songs parse without compiler errors | Valid `.sw` syntax |
| SS-10 | Song examples appear in editor autocomplete/templates | Users can insert them as starting points |

---

## 10. Implementation Phases

### Phase 1: Library Repository Setup
- [ ] Create `songwalker-library` repo at https://github.com/clevertree/songwalker-library
- [ ] Set up folder structure: `instruments/`, `percussion/`, `effects/`, `synths/`
- [ ] Build conversion script: webaudiofontdata JSON → unified preset format
- [ ] Extract sample audio files (base64 → WAV), deduplicate with SHA256
- [ ] Organize into GM category folders with descriptive names
- [ ] Generate `preset.json` for each instrument (with relative sample paths)
- [ ] Build `scripts/generate-index.js` for root `index.json` generation
- [ ] Set up Husky pre-commit hook for auto-index generation
- [ ] Assign tags using heuristics (melodic/percussion, GM category, library source)

### Phase 2: Foundation
- [ ] Add `tuningPitch` to track state (Rust engine + song format)
- [ ] Parameterize `note_to_frequency()` with tuning pitch
- [ ] Define `PresetDescriptor` and `SampleZone` types (Rust structs + TypeScript interfaces)
- [ ] Multi-sampler composite preset format for multi-zone instruments

### Phase 3: Preset Index & Search
- [ ] Fetch `index.json` from `songwalker-library` repo at startup
- [ ] Implement in-memory search index (HashMap-based) with tag support
- [ ] Implement `loadPreset()` with index lookup → lazy fetch → decode → cache
- [ ] LRU cache for decoded audio buffers
- [ ] Static analysis prefetching from `.sw` source
- [ ] Tag-based filtering (melodic vs percussion, instrument family, etc.)

### Phase 4: Sampler Engine (Rust DSP)
- [ ] Implement sampler/AudioBuffer player in Rust (pitch-shifting via resampling)
- [ ] Sample rate conversion for zones with non-standard rates
- [ ] Loop point handling (sample offsets → frame positions)
- [ ] Per-zone ADSR envelope
- [ ] Key range zone selection (composite split mode)
- [ ] Tuning-aware playback rate

### Phase 5: Composite Presets
- [ ] Implement `CompositeNode` with layer/split/chain modes
- [ ] Voice management across layers
- [ ] Effects chain processing in Rust DSP
- [ ] Composite preset serialization/deserialization

### Phase 6: Preset UI
- [ ] Preset browser panel in web editor
- [ ] Search with fuzzy match + tag filters
- [ ] Audio preview (play note with selected preset)
- [ ] Preset editor tree view (hierarchy editing)
- [ ] Code generation (insert/edit `.sw` lines)
- [ ] Zone viewer for sampler presets
- [ ] Custom preset save/load

### Phase 7: Sample Tuner
- [ ] Pitch detection engine (autocorrelation/FFT)
- [ ] Per-zone tuning analysis UI
- [ ] Non-melodic detection and flagging
- [ ] Auto-correct fine tune / root note
- [ ] Batch library-wide tuning scan
- [ ] Tag updates from tuning results (`tuning:verified`, `tuning:needs-adj`, `tuning:no-pitch`)

### Phase 8: Sample Songs & Front Page
- [ ] Write sample songs: Piano Ballad, Rock Beat, Synth Waves, 432 Hz Meditation, Composite Demo
- [ ] Add song selector to front page editor
- [ ] Verify all songs load presets from `songwalker-library` repo
- [ ] Verify offline rendering produces correct output
- [ ] Test each song exercises its target preset categories

---

## 11. Open Questions

1. **Audio format for Rust DSP**: Should the unified format store raw PCM (fast decode, large files) or compressed (small files, async decode)? The Rust engine needs raw samples — decode on first load and cache?
2. **Streaming vs. pre-render**: Current Rust engine pre-renders the entire song. Preset loading during playback requires either streaming render or a two-pass approach (analyze presets → prefetch → render).
3. **Voice stealing**: Current max 64 voices with silent drop. Composite/layered presets multiply voice count. Need a voice-stealing policy (oldest? quietest?).
4. **Velocity layers**: Current sample libraries have no velocity layers. Should the format support them for future sample sets?
5. **User preset storage**: Where should user-created composite presets be stored? LocalStorage? IndexedDB? File system? PR to `songwalker-library`?
6. **Sample licensing**: Different SF2 sources have different licenses. Should the manifest track license per-sample for legal clarity?
7. **GitHub raw URL rate limits**: For high-traffic front page, should we use a CDN or GitHub Pages for serving `songwalker-library` assets? Consider GitHub Pages (`clevertree.github.io/songwalker-library/`) or a dedicated CDN.
8. **Tuner accuracy threshold**: What cents threshold constitutes "needs adjustment"? Proposed: 10 cents. Should this be configurable?
9. **Large repo size**: With all sample WAVs, the repo could be several GB. Should we use Git LFS for audio files? Or keep only compressed formats (MP3/OGG) in the repo?
10. **Tag governance**: Who maintains the tag vocabulary? Should there be a schema file defining valid tags, or are they freeform?
