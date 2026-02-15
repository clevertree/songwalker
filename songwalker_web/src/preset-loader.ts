/**
 * Preset loading system — fetches, decodes, and caches preset descriptors.
 *
 * Supports the generic index format: a single format that can contain
 * preset entries and/or links to sub-indexes. The root index is tiny
 * (< 2 KB) and links to per-library sub-indexes which are fetched lazily.
 *
 * Usage:
 *   const loader = new PresetLoader('https://clevertree.github.io/songwalker-library');
 *   await loader.loadRootIndex();
 *   await loader.enableLibrary('FluidR3_GM');
 *   const preset = await loader.loadPreset('Acoustic Grand Piano');
 */

import type {
    PresetDescriptor,
    PresetIndex,
    IndexEntry,
    PresetEntry,
    SubIndexEntry,
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
    library?: string;
}

/** Info about a loadable library (from root index sub-index entries) */
export interface LibraryInfo {
    name: string;
    path: string;
    description?: string;
    presetCount?: number;
    loaded: boolean;
    enabled: boolean;
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

// ── Helpers ──────────────────────────────────────────────

/** Resolve a relative path against a parent URL directory. */
function resolveUrl(base: string, relativePath: string): string {
    // Strip trailing filename from base to get directory
    const baseDir = base.replace(/\/[^/]*$/, '');
    return `${baseDir}/${relativePath}`;
}

/** Extract directory from a URL path. */
function dirOf(url: string): string {
    return url.replace(/\/[^/]*$/, '');
}

// ── Preset Loader ────────────────────────────────────────

export class PresetLoader {
    private baseUrl: string;
    private rootIndex: PresetIndex | null = null;

    /** Loaded library indexes keyed by library name */
    private loadedLibraries = new Map<string, { index: PresetIndex; baseUrl: string }>();

    /** Which libraries are enabled for search */
    private enabledLibraries = new Set<string>();

    /** In-flight library loads (dedup concurrent requests) */
    private loadingLibraries = new Map<string, Promise<PresetIndex>>();

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

    // ── Root Index ───────────────────────────────────────

    /** Fetch and cache the root index. */
    async loadRootIndex(): Promise<PresetIndex> {
        if (this.rootIndex) return this.rootIndex;

        const url = `${this.baseUrl}/index.json`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch root index: ${resp.status} ${resp.statusText}`);
        }
        this.rootIndex = await resp.json() as PresetIndex;

        // Auto-enable any inline preset entries from root (e.g., shared presets)
        const presetEntries = this.rootIndex.entries.filter(
            (e): e is PresetEntry => e.type === 'preset'
        );
        if (presetEntries.length > 0) {
            // Store root presets as a synthetic library
            this.loadedLibraries.set('_root', {
                index: this.rootIndex,
                baseUrl: this.baseUrl,
            });
            this.enabledLibraries.add('_root');
        }

        return this.rootIndex;
    }

    /**
     * Load the root index. Alias for loadRootIndex() for compatibility.
     * @deprecated Use loadRootIndex() instead.
     */
    async loadIndex(): Promise<PresetIndex> {
        return this.loadRootIndex();
    }

    /** Get the loaded root index (throws if not yet loaded). */
    getRootIndex(): PresetIndex {
        if (!this.rootIndex) {
            throw new Error('Root index not loaded. Call loadRootIndex() first.');
        }
        return this.rootIndex;
    }

    /**
     * Get the loaded root index. Alias for getRootIndex() for compatibility.
     * @deprecated Use getRootIndex() instead.
     */
    getIndex(): PresetIndex {
        return this.getRootIndex();
    }

    // ── Library Management ───────────────────────────────

    /** Get info about all available libraries from the root index. */
    getAvailableLibraries(): LibraryInfo[] {
        const root = this.getRootIndex();
        return root.entries
            .filter((e): e is SubIndexEntry => e.type === 'index')
            .map(entry => ({
                name: entry.name,
                path: entry.path,
                description: entry.description,
                presetCount: entry.presetCount,
                loaded: this.loadedLibraries.has(entry.name),
                enabled: this.enabledLibraries.has(entry.name),
            }));
    }

    /** Fetch a library's sub-index and add it to the loaded set. */
    async loadLibrary(libraryName: string): Promise<PresetIndex> {
        // Already loaded?
        const existing = this.loadedLibraries.get(libraryName);
        if (existing) return existing.index;

        // Already in flight?
        const inflight = this.loadingLibraries.get(libraryName);
        if (inflight) return inflight;

        const root = this.getRootIndex();
        const entry = root.entries.find(
            (e): e is SubIndexEntry => e.type === 'index' && e.name === libraryName
        );
        if (!entry) {
            throw new Error(`Library not found in root index: "${libraryName}"`);
        }

        const promise = this._fetchIndex(entry.path, this.baseUrl).then(result => {
            this.loadedLibraries.set(libraryName, result);
            this.loadingLibraries.delete(libraryName);
            return result.index;
        });

        this.loadingLibraries.set(libraryName, promise);
        return promise;
    }

    /** Enable a library for searching. Loads it if not already loaded. */
    async enableLibrary(libraryName: string): Promise<void> {
        if (!this.loadedLibraries.has(libraryName)) {
            await this.loadLibrary(libraryName);
        }
        this.enabledLibraries.add(libraryName);
    }

    /** Disable a library from search results (keeps it cached). */
    disableLibrary(libraryName: string): void {
        this.enabledLibraries.delete(libraryName);
    }

    /** Check if a library is enabled. */
    isLibraryEnabled(libraryName: string): boolean {
        return this.enabledLibraries.has(libraryName);
    }

    /** Check if a library's index has been loaded. */
    isLibraryLoaded(libraryName: string): boolean {
        return this.loadedLibraries.has(libraryName);
    }

    /** Fetch and parse an index file relative to a base URL. */
    private async _fetchIndex(relativePath: string, parentBaseUrl: string): Promise<{ index: PresetIndex; baseUrl: string }> {
        const url = `${parentBaseUrl}/${relativePath}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch index: ${resp.status} ${url}`);
        }
        const index = await resp.json() as PresetIndex;
        return { index, baseUrl: dirOf(url) };
    }

    // ── Search ───────────────────────────────────────────

    /** Get all preset entries from enabled libraries. */
    private _getEnabledPresets(): Array<{ entry: PresetEntry; libraryName: string; libraryBaseUrl: string }> {
        const results: Array<{ entry: PresetEntry; libraryName: string; libraryBaseUrl: string }> = [];

        for (const [libraryName, { index, baseUrl }] of this.loadedLibraries) {
            if (!this.enabledLibraries.has(libraryName)) continue;

            for (const entry of index.entries) {
                if (entry.type === 'preset') {
                    results.push({ entry, libraryName, libraryBaseUrl: baseUrl });
                }
            }
        }

        return results;
    }

    /** Search all enabled libraries for entries matching the given criteria. */
    search(options: SearchOptions): PresetEntry[] {
        let results = this._getEnabledPresets();

        if (options.library) {
            results = results.filter(r => r.libraryName === options.library);
        }
        if (options.category) {
            results = results.filter(r => r.entry.category === options.category);
        }
        if (options.gmProgram !== undefined) {
            results = results.filter(r => r.entry.gmProgram === options.gmProgram);
        }
        if (options.tags && options.tags.length > 0) {
            const searchTags = new Set(options.tags.map(t => t.toLowerCase()));
            results = results.filter(r =>
                r.entry.tags.some(t => searchTags.has(t.toLowerCase()))
            );
        }
        if (options.name) {
            const needle = options.name.toLowerCase();
            results = results.filter(r =>
                r.entry.name.toLowerCase().includes(needle)
            );
        }

        return results.map(r => r.entry);
    }

    /** Fuzzy search by name across all enabled libraries — sorted by relevance. */
    fuzzySearch(query: string, limit = 20): PresetEntry[] {
        const needle = query.toLowerCase();
        const allPresets = this._getEnabledPresets();

        const scored = allPresets
            .map(({ entry }) => {
                const name = entry.name.toLowerCase();
                let score = 0;

                if (name === needle) score = 100;
                else if (name.startsWith(needle)) score = 80;
                else if (name.includes(needle)) score = 60;
                else if (entry.tags.some(t => t.toLowerCase().includes(needle))) score = 40;
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

    /**
     * Load a preset by name. Searches all enabled libraries.
     * If the name contains a '/' prefix (e.g., "FluidR3_GM/Acoustic Grand Piano"),
     * the library is loaded automatically if needed.
     */
    async loadPreset(name: string): Promise<PresetDescriptor> {
        // Check for library prefix: "LibraryName/PresetName"
        const slashIdx = name.indexOf('/');
        if (slashIdx > 0) {
            const libName = name.substring(0, slashIdx);
            const presetName = name.substring(slashIdx + 1);

            // Ensure library is loaded and enabled
            if (!this.enabledLibraries.has(libName)) {
                await this.enableLibrary(libName);
            }

            const results = this.search({ name: presetName, library: libName });
            if (results.length > 0) {
                return this._loadPresetEntry(results[0], libName);
            }
        }

        // Fall back to searching all enabled libraries
        const results = this.search({ name });
        if (results.length === 0) {
            throw new Error(`Preset not found: "${name}"`);
        }
        return this._loadPresetEntry(results[0]);
    }

    /** Load a preset by its catalog path, resolved relative to a library. */
    async loadPresetByPath(path: string, libraryName?: string): Promise<PresetDescriptor> {
        const fullUrl = this._resolvePresetUrl(path, libraryName);
        return this._fetchPreset(fullUrl, path);
    }

    /** Load a preset by GM program number (0-127). Searches enabled libraries. */
    async loadPresetByProgram(program: number): Promise<PresetDescriptor> {
        const results = this.search({ gmProgram: program });
        if (results.length === 0) {
            throw new Error(`No preset found for GM program ${program}`);
        }
        return this._loadPresetEntry(results[0]);
    }

    /** Internal: load a preset entry, resolving its URL from its source library. */
    private async _loadPresetEntry(entry: PresetEntry, libraryHint?: string): Promise<PresetDescriptor> {
        // Find which library this entry belongs to
        const libraryName = libraryHint ?? this._findLibraryForEntry(entry);
        const fullUrl = this._resolvePresetUrl(entry.path, libraryName);
        return this._fetchPreset(fullUrl, entry.path);
    }

    /** Find which loaded library contains a given entry. */
    private _findLibraryForEntry(entry: PresetEntry): string | undefined {
        for (const [libraryName, { index }] of this.loadedLibraries) {
            if (index.entries.some(e => e === entry)) {
                return libraryName;
            }
        }
        return undefined;
    }

    /** Resolve a preset path to a full URL using the library's base URL. */
    private _resolvePresetUrl(path: string, libraryName?: string): string {
        if (libraryName) {
            const lib = this.loadedLibraries.get(libraryName);
            if (lib) {
                return `${lib.baseUrl}/${path}`;
            }
        }
        return `${this.baseUrl}/${path}`;
    }

    /** Fetch and cache a preset descriptor. */
    private async _fetchPreset(url: string, cacheKey: string): Promise<PresetDescriptor> {
        if (this.presetCache.has(cacheKey)) {
            return this.presetCache.get(cacheKey)!;
        }

        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Failed to fetch preset: ${resp.status} ${url}`);
        }
        const preset = await resp.json() as PresetDescriptor;
        this.presetCache.set(cacheKey, preset);
        return preset;
    }

    // ── Audio Decoding ───────────────────────────────────

    /**
     * Decode an audio reference to an AudioBuffer.
     * Requires an AudioContext to be set via setAudioContext().
     */
    async decodeAudio(ref_: AudioReference, presetUrl?: string): Promise<AudioBuffer> {
        const ctx = this.audioContext;
        if (!ctx) {
            throw new Error('AudioContext not set. Call setAudioContext() first.');
        }

        let cacheKey: string;
        let arrayBuffer: ArrayBuffer;

        switch (ref_.type) {
            case 'external': {
                const sampleUrl = presetUrl
                    ? `${dirOf(presetUrl)}/${ref_.path}`
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
        presetUrl?: string,
    ): Promise<Map<SampleZone, AudioBuffer>> {
        const result = new Map<SampleZone, AudioBuffer>();

        const promises = config.zones.map(async (zone) => {
            const buffer = await this.decodeAudio(zone.audio, presetUrl);
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
        // Ensure root index is loaded first
        await this.loadRootIndex();

        // Determine which libraries need loading based on presetNames
        // Names of form "LibraryName/PresetName" tell us which libraries to fetch
        const librariesToLoad = new Set<string>();
        for (const name of presetNames) {
            const slashIdx = name.indexOf('/');
            if (slashIdx > 0) {
                librariesToLoad.add(name.substring(0, slashIdx));
            }
        }

        // Load required libraries in parallel
        await Promise.all(
            Array.from(librariesToLoad).map(lib => this.enableLibrary(lib))
        );

        // Now load each preset
        const promises = presetNames.map(async (name) => {
            try {
                const preset = await this.loadPreset(name);
                // Pre-decode sampler zones if the preset has a sampler config
                if (preset.node?.type === 'sampler' && preset.node.config) {
                    const entry = this.search({ name })[0];
                    if (entry) {
                        const libraryName = this._findLibraryForEntry(entry);
                        const presetUrl = this._resolvePresetUrl(entry.path, libraryName);
                        await this.decodeSamplerZones(
                            preset.node.config as SamplerConfig,
                            presetUrl,
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
