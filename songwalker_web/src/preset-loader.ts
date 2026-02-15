/**
 * Preset loading system — fetches, decodes, and caches preset descriptors.
 *
 * Usage:
 *   const loader = new PresetLoader('https://cdn.example.com/songwalker-library');
 *   await loader.loadIndex();
 *   const preset = await loader.loadPreset('Acoustic Grand Piano');
 */

import type {
    PresetDescriptor,
    LibraryIndex,
    CatalogEntry,
    SamplerConfig,
    SampleZone,
    AudioReference,
    PresetCategory,
} from './preset-types.js';

// ── Types ────────────────────────────────────────────────

export interface DecodedSample {
    buffer: AudioBuffer;
    sampleRate: number;
}

export interface SearchOptions {
    name?: string;
    category?: PresetCategory;
    tags?: string[];
    gmProgram?: number;
}

// ── LRU Cache ────────────────────────────────────────────

class LRUCache<K, V> {
    private map = new Map<K, V>();
    constructor(private capacity: number) { }

    get(key: K): V | undefined {
        const val = this.map.get(key);
        if (val !== undefined) {
            // Move to end (most recently used)
            this.map.delete(key);
            this.map.set(key, val);
        }
        return val;
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.capacity) {
            // Evict oldest
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined) {
                this.map.delete(oldest);
            }
        }
        this.map.set(key, value);
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    clear(): void {
        this.map.clear();
    }

    get size(): number {
        return this.map.size;
    }
}

// ── Preset Loader ────────────────────────────────────────

export class PresetLoader {
    private baseUrl: string;
    private index: LibraryIndex | null = null;
    private presetCache: LRUCache<string, PresetDescriptor>;
    private audioCache: LRUCache<string, AudioBuffer>;
    private audioContext: AudioContext | null = null;

    constructor(baseUrl: string, options?: { presetCacheSize?: number; audioCacheSize?: number }) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.presetCache = new LRUCache(options?.presetCacheSize ?? 256);
        this.audioCache = new LRUCache(options?.audioCacheSize ?? 128);
    }

    /** Set the AudioContext used for decoding audio data. */
    setAudioContext(ctx: AudioContext): void {
        this.audioContext = ctx;
    }

    // ── Index ────────────────────────────────────────────

    /** Fetch and cache the library index. */
    async loadIndex(): Promise<LibraryIndex> {
        if (this.index) return this.index;

        const url = `${this.baseUrl}/index.json`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch library index: ${resp.status} ${resp.statusText}`);
        }
        this.index = await resp.json() as LibraryIndex;
        return this.index;
    }

    /** Get the loaded index (throws if not yet loaded). */
    getIndex(): LibraryIndex {
        if (!this.index) {
            throw new Error('Index not loaded. Call loadIndex() first.');
        }
        return this.index;
    }

    // ── Search ───────────────────────────────────────────

    /** Search the catalog for entries matching the given criteria. */
    search(options: SearchOptions): CatalogEntry[] {
        const idx = this.getIndex();
        let results = idx.entries;

        if (options.category) {
            results = results.filter(e => e.category === options.category);
        }
        if (options.gmProgram !== undefined) {
            results = results.filter(e => e.gmProgram === options.gmProgram);
        }
        if (options.tags && options.tags.length > 0) {
            const searchTags = new Set(options.tags.map(t => t.toLowerCase()));
            results = results.filter(e =>
                e.tags.some(t => searchTags.has(t.toLowerCase()))
            );
        }
        if (options.name) {
            const needle = options.name.toLowerCase();
            results = results.filter(e =>
                e.name.toLowerCase().includes(needle)
            );
        }

        return results;
    }

    /** Fuzzy search by name — returns results sorted by relevance. */
    fuzzySearch(query: string, limit = 20): CatalogEntry[] {
        const idx = this.getIndex();
        const needle = query.toLowerCase();

        const scored = idx.entries
            .map(entry => {
                const name = entry.name.toLowerCase();
                let score = 0;

                // Exact match
                if (name === needle) score = 100;
                // Starts with
                else if (name.startsWith(needle)) score = 80;
                // Contains
                else if (name.includes(needle)) score = 60;
                // Tags match
                else if (entry.tags.some(t => t.toLowerCase().includes(needle))) score = 40;
                // Individual words match
                else {
                    const words = needle.split(/\s+/);
                    const matchCount = words.filter(w =>
                        name.includes(w) || entry.tags.some(t => t.toLowerCase().includes(w))
                    ).length;
                    score = (matchCount / words.length) * 30;
                }

                return { entry, score };
            })
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.entry);

        return scored;
    }

    // ── Load Preset ──────────────────────────────────────

    /** Load a preset by name (first match from index). */
    async loadPreset(name: string): Promise<PresetDescriptor> {
        const results = this.search({ name });
        if (results.length === 0) {
            throw new Error(`Preset not found: "${name}"`);
        }
        return this.loadPresetByPath(results[0].path);
    }

    /** Load a preset by its catalog path. */
    async loadPresetByPath(path: string): Promise<PresetDescriptor> {
        if (this.presetCache.has(path)) {
            return this.presetCache.get(path)!;
        }

        const url = `${this.baseUrl}/${path}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch preset: ${resp.status} ${url}`);
        }
        const preset = await resp.json() as PresetDescriptor;
        this.presetCache.set(path, preset);
        return preset;
    }

    /** Load a preset by GM program number (0-127). */
    async loadPresetByProgram(program: number): Promise<PresetDescriptor> {
        const results = this.search({ gmProgram: program });
        if (results.length === 0) {
            throw new Error(`No preset found for GM program ${program}`);
        }
        return this.loadPresetByPath(results[0].path);
    }

    // ── Audio Decoding ───────────────────────────────────

    /**
     * Decode an audio reference to an AudioBuffer.
     * Requires an AudioContext to be set via setAudioContext().
     */
    async decodeAudio(ref_: AudioReference, presetPath?: string): Promise<AudioBuffer> {
        const ctx = this.audioContext;
        if (!ctx) {
            throw new Error('AudioContext not set. Call setAudioContext() first.');
        }

        let cacheKey: string;
        let arrayBuffer: ArrayBuffer;

        switch (ref_.type) {
            case 'external': {
                const sampleUrl = presetPath
                    ? `${this.baseUrl}/${presetPath.replace(/\/[^/]+$/, '')}/${ref_.path}`
                    : `${this.baseUrl}/${ref_.path}`;
                cacheKey = ref_.sha256 ?? sampleUrl;

                if (this.audioCache.has(cacheKey)) {
                    return this.audioCache.get(cacheKey)!;
                }

                const resp = await fetch(sampleUrl);
                if (!resp.ok) throw new Error(`Failed to fetch sample: ${resp.status} ${sampleUrl}`);
                arrayBuffer = await resp.arrayBuffer();
                break;
            }

            case 'contentAddressed': {
                cacheKey = ref_.sha256;
                if (this.audioCache.has(cacheKey)) {
                    return this.audioCache.get(cacheKey)!;
                }
                const shaUrl = `${this.baseUrl}/samples/${ref_.sha256}.${ref_.codec}`;
                const resp = await fetch(shaUrl);
                if (!resp.ok) throw new Error(`Failed to fetch sample: ${resp.status} ${shaUrl}`);
                arrayBuffer = await resp.arrayBuffer();
                break;
            }

            case 'inlineFile': {
                cacheKey = `inline:${ref_.data.slice(0, 32)}`;
                if (this.audioCache.has(cacheKey)) {
                    return this.audioCache.get(cacheKey)!;
                }
                const binary = atob(ref_.data);
                arrayBuffer = new ArrayBuffer(binary.length);
                const view = new Uint8Array(arrayBuffer);
                for (let i = 0; i < binary.length; i++) {
                    view[i] = binary.charCodeAt(i);
                }
                break;
            }

            case 'inlinePcm': {
                cacheKey = `pcm:${ref_.data.slice(0, 32)}`;
                if (this.audioCache.has(cacheKey)) {
                    return this.audioCache.get(cacheKey)!;
                }
                // Decode base64 → Float32Array PCM
                const pcmBinary = atob(ref_.data);
                const pcmBytes = new Uint8Array(pcmBinary.length);
                for (let i = 0; i < pcmBinary.length; i++) {
                    pcmBytes[i] = pcmBinary.charCodeAt(i);
                }
                const pcmFloat = new Float32Array(pcmBytes.buffer);
                const pcmBuffer = ctx.createBuffer(1, pcmFloat.length, ref_.sampleRate);
                pcmBuffer.copyToChannel(pcmFloat, 0);
                this.audioCache.set(cacheKey, pcmBuffer);
                return pcmBuffer;
            }
        }

        const decoded = await ctx.decodeAudioData(arrayBuffer);
        this.audioCache.set(cacheKey, decoded);
        return decoded;
    }

    /**
     * Decode all sample zones in a sampler preset, returning AudioBuffers.
     */
    async decodeSamplerZones(
        config: SamplerConfig,
        presetPath?: string,
    ): Promise<Map<SampleZone, AudioBuffer>> {
        const result = new Map<SampleZone, AudioBuffer>();

        const promises = config.zones.map(async (zone) => {
            const buffer = await this.decodeAudio(zone.audio, presetPath);
            result.set(zone, buffer);
        });

        await Promise.all(promises);
        return result;
    }

    // ── Cache Management ─────────────────────────────────

    clearCaches(): void {
        this.presetCache.clear();
        this.audioCache.clear();
    }

    get presetCacheSize(): number {
        return this.presetCache.size;
    }

    get audioCacheSize(): number {
        return this.audioCache.size;
    }

    // ── Preloading ───────────────────────────────────────

    /**
     * Preload all referenced presets (and their sample data) before playback.
     * Call with the preset names extracted at compile time via extract_preset_refs().
     *
     * Usage:
     *   const refs = wasm.extract_preset_refs(songSource);
     *   await loader.preloadAll(refs);
     *   // Now playback can start without blocking on network fetches.
     */
    async preloadAll(presetNames: string[]): Promise<void> {
        // Ensure index is loaded first
        await this.loadIndex();

        const promises = presetNames.map(async (name) => {
            try {
                const preset = await this.loadPreset(name);
                // Pre-decode sampler zones if the preset has a sampler config
                if (preset.node?.type === 'sampler' && preset.node.config) {
                    const entry = this.search({ name })[0];
                    if (entry) {
                        await this.decodeSamplerZones(
                            preset.node.config as SamplerConfig,
                            entry.path,
                        );
                    }
                }
            } catch (err) {
                console.warn(`[PresetLoader] Failed to preload "${name}":`, err);
            }
        });

        await Promise.all(promises);
    }
}
