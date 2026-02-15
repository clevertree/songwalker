/**
 * TypeScript types mirroring the Rust preset system.
 *
 * These types define the JSON schema for preset descriptors,
 * catalog entries, and the library index.
 */

// ── Preset Descriptor ────────────────────────────────────

export type PresetCategory = 'synth' | 'sampler' | 'effect' | 'composite';

export interface PresetDescriptor {
    format: string;            // "songwalker-preset"
    version: number;           // 1
    name: string;
    category: PresetCategory;
    tags: string[];
    metadata?: PresetMetadata;
    tuning?: TuningInfo;
    node: PresetNode;
}

export interface PresetMetadata {
    description?: string;
    author?: string;
    license?: string;
    gmProgram?: number;
    gmCategory?: string;
    source?: string;
    originalFile?: string;
}

export interface TuningInfo {
    a4Frequency: number;
    description?: string;
}

// ── Preset Nodes ─────────────────────────────────────────

export type PresetNode =
    | { type: 'oscillator'; config: OscillatorConfig }
    | { type: 'sampler'; config: SamplerConfig }
    | { type: 'effect'; effectType: string; params: Record<string, number> }
    | { type: 'composite'; mode: CompositeMode; children: PresetNode[]; mixLevels?: number[] };

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface OscillatorConfig {
    waveform: WaveformType;
    envelope?: ADSRConfig;
    detune?: number;
}

export type CompositeMode = 'layer' | 'split' | 'chain';

// ── Sampler Config ───────────────────────────────────────

export interface SamplerConfig {
    zones: SampleZone[];
    oneShot?: boolean;
    defaultEnvelope?: ADSRConfig;
}

export interface SampleZone {
    keyRange?: KeyRange;
    velocityRange?: VelocityRange;
    pitch: ZonePitch;
    audio: AudioReference;
    sampleRate: number;
    loopPoints?: LoopPoints;
}

export interface KeyRange {
    low: number;   // MIDI 0-127
    high: number;
}

export interface VelocityRange {
    low: number;
    high: number;
}

export interface ZonePitch {
    rootNote: number;     // MIDI 0-127
    fineTuneCents: number;
}

export interface LoopPoints {
    start: number;    // sample index
    end: number;
}

export type AudioReference =
    | { type: 'external'; path: string; sha256?: string }
    | { type: 'contentAddressed'; sha256: string; codec: AudioCodec }
    | { type: 'inlineFile'; data: string; codec: AudioCodec }       // base64
    | { type: 'inlinePcm'; data: string; sampleRate: number };      // base64

export type AudioCodec = 'wav' | 'mp3' | 'ogg' | 'flac';

// ── Envelope ─────────────────────────────────────────────

export interface ADSRConfig {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
}

// ── Library Index / Catalog ──────────────────────────────

export interface LibraryIndex {
    format: string;        // "songwalker-library-index"
    version: number;
    generatedAt: string;
    entries: CatalogEntry[];
}

export interface CatalogEntry {
    name: string;
    category: PresetCategory;
    tags: string[];
    path: string;          // relative path to preset.json
    gmProgram?: number;
    zoneCount?: number;
    keyRange?: KeyRange;
}
