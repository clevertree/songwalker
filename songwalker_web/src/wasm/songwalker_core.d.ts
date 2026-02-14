/* tslint:disable */
/* eslint-disable */

/**
 * WASM-exposed: compile `.sw` source into a JSON event list (strict/editor mode).
 * Errors if a note plays before track.instrument is set.
 */
export function compile_song(source: string): any;

/**
 * WASM-exposed: compile and render `.sw` source to mono f32 samples.
 * Returns the raw audio buffer for AudioWorklet playback.
 */
export function render_song_samples(source: string, sample_rate: number): Float32Array;

/**
 * WASM-exposed: compile and render `.sw` source to a WAV byte array.
 */
export function render_song_wav(source: string, sample_rate: number): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compile_song: (a: number, b: number) => [number, number, number];
    readonly render_song_samples: (a: number, b: number, c: number) => [number, number, number, number];
    readonly render_song_wav: (a: number, b: number, c: number) => [number, number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
