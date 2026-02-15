import init, { compile_song } from './wasm/songwalker_core.js';
import { SongPlayer } from './player.js';
import { PresetLoader } from './preset-loader.js';
import { PresetBrowser } from './preset-browser.js';
import * as monaco from 'monaco-editor';
import {
    LANGUAGE_ID,
    languageConfig,
    monarchTokens,
    editorTheme,
    completionItems,
} from './sw-language.js';

// ── Types ────────────────────────────────────────────────

interface NoteEvent {
    time: number;
    kind: {
        Note: {
            pitch: string;
            velocity: number;
            gate: number;
            source_start: number;
            source_end: number;
        };
    };
}

// ── Monaco worker setup ──────────────────────────────────

self.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
        if (label === 'json') {
            return new Worker(
                new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
                { type: 'module' },
            );
        }
        if (label === 'css' || label === 'scss' || label === 'less') {
            return new Worker(
                new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
                { type: 'module' },
            );
        }
        if (label === 'html' || label === 'handlebars' || label === 'razor') {
            return new Worker(
                new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
                { type: 'module' },
            );
        }
        if (label === 'typescript' || label === 'javascript') {
            return new Worker(
                new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
                { type: 'module' },
            );
        }
        return new Worker(
            new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
            { type: 'module' },
        );
    },
};

// ── Example song ─────────────────────────────────────────

const EXAMPLE_SONG = `// SongWalker Example — songwalker.net
const synth = Oscillator({type: 'triangle'});
track.beatsPerMinute = 140;

riff(synth);

track riff(inst) {
    track.instrument = inst;
    track.noteLength = 1/4;

    C4 /4
    E4 /4
    G4 /4
    C5 /2

    B4 /4
    G4 /4
    E4 /4
    C4 /2

    4
}
`;

// ── LocalStorage persistence ─────────────────────────────

const STORAGE_KEY = 'songwalker_source';

function loadSource(): string {
    return localStorage.getItem(STORAGE_KEY) || EXAMPLE_SONG;
}

function saveSource(source: string): void {
    localStorage.setItem(STORAGE_KEY, source);
}

// ── File API helpers ─────────────────────────────────────

function hasFileSystemAccess(): boolean {
    return 'showOpenFilePicker' in window;
}

async function openFile(): Promise<string | null> {
    if (hasFileSystemAccess()) {
        try {
            const [handle] = await (window as any).showOpenFilePicker({
                types: [{ description: 'SongWalker files', accept: { 'text/plain': ['.sw'] } }],
            });
            const file = await handle.getFile();
            return await file.text();
        } catch {
            return null;
        }
    } else {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.sw,.txt';
            input.onchange = async () => {
                const file = input.files?.[0];
                resolve(file ? await file.text() : null);
            };
            input.click();
        });
    }
}

async function saveFile(source: string): Promise<void> {
    if (hasFileSystemAccess()) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: 'song.sw',
                types: [{ description: 'SongWalker files', accept: { 'text/plain': ['.sw'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(source);
            await writable.close();
        } catch {
            // user cancelled
        }
    } else {
        const blob = new Blob([source], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'song.sw';
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ── Error location markers ───────────────────────────────

/** Parse `[start:end]` from an error message and underline the range in the editor. */
function showErrorLocation(editor: monaco.editor.IStandaloneCodeEditor, msg: string): void {
    const match = msg.match(/\[(\d+):(\d+)\]/);
    if (!match) return;

    const model = editor.getModel();
    if (!model) return;

    const startOffset = parseInt(match[1], 10);
    const endOffset = parseInt(match[2], 10);
    const startPos = model.getPositionAt(startOffset);
    const endPos = model.getPositionAt(endOffset);

    monaco.editor.setModelMarkers(model, 'songwalker', [
        {
            severity: monaco.MarkerSeverity.Error,
            message: msg.replace(/\s*\[\d+:\d+\]/, ''),
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
        },
    ]);

    // Reveal the error location
    editor.revealPositionInCenter(startPos);
}

/** Clear all error markers. */
function clearErrorMarkers(editor: monaco.editor.IStandaloneCodeEditor): void {
    const model = editor.getModel();
    if (model) {
        monaco.editor.setModelMarkers(model, 'songwalker', []);
    }
}

// ── Register SongWalker language ─────────────────────────

function registerLanguage() {
    monaco.languages.register({ id: LANGUAGE_ID, extensions: ['.sw'] });
    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, languageConfig);
    monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarchTokens);
    monaco.editor.defineTheme('songwalker-dark', editorTheme);

    monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
            };
            return {
                suggestions: completionItems.map((item) => ({ ...item, range })),
            };
        },
    });
}

// ── Visualiser helpers ───────────────────────────────────

class Visualiser {
    private peakBarL: HTMLElement;
    private peakBarR: HTMLElement;
    private peakValueEl: HTMLElement;
    private spectrumCanvas: HTMLCanvasElement;
    private waveformCanvas: HTMLCanvasElement;
    private spectrumCtx: CanvasRenderingContext2D;
    private waveformCtx: CanvasRenderingContext2D;
    private rafId: number | null = null;
    private player: SongPlayer;
    private freqData: Uint8Array | null = null;
    private timeData: Uint8Array | null = null;

    constructor(player: SongPlayer) {
        this.player = player;
        this.peakBarL = document.getElementById('peak-bar-l')!;
        this.peakBarR = document.getElementById('peak-bar-r')!;
        this.peakValueEl = document.getElementById('peak-value')!;
        this.spectrumCanvas = document.getElementById('spectrum-canvas') as HTMLCanvasElement;
        this.waveformCanvas = document.getElementById('waveform-canvas') as HTMLCanvasElement;
        this.spectrumCtx = this.spectrumCanvas.getContext('2d')!;
        this.waveformCtx = this.waveformCanvas.getContext('2d')!;
    }

    start(): void {
        if (this.rafId !== null) return;
        this.tick();
    }

    stop(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        // Reset peak display
        this.peakBarL.style.height = '1px';
        this.peakBarR.style.height = '1px';
        this.peakBarL.className = 'peak-bar';
        this.peakBarR.className = 'peak-bar';
        this.peakValueEl.textContent = '-∞ dB';
        // Clear canvases
        this.clearCanvas(this.spectrumCtx, this.spectrumCanvas);
        this.clearCanvas(this.waveformCtx, this.waveformCanvas);
    }

    /** Draw the static waveform overview (called once after render). */
    drawWaveformOverview(): void {
        const samples = this.player.renderedSamples;
        if (!samples || samples.length === 0) return;

        const canvas = this.waveformCanvas;
        const ctx = this.waveformCtx;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        ctx.fillStyle = '#11111b';
        ctx.fillRect(0, 0, w, h);

        // Draw waveform envelope
        const samplesPerPixel = Math.max(1, Math.floor(samples.length / w));
        ctx.beginPath();
        ctx.strokeStyle = '#89b4fa';
        ctx.lineWidth = 1;

        const mid = h / 2;
        for (let x = 0; x < w; x++) {
            const start = x * samplesPerPixel;
            let min = 0, max = 0;
            for (let j = start; j < start + samplesPerPixel && j < samples.length; j++) {
                const v = samples[j];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            ctx.moveTo(x, mid - max * mid);
            ctx.lineTo(x, mid - min * mid);
        }
        ctx.stroke();

        // Center line
        ctx.strokeStyle = '#313244';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
    }

    private tick = (): void => {
        this.rafId = requestAnimationFrame(this.tick);

        const analyser = this.player.getAnalyser();
        if (!analyser || !this.player.isPlaying) {
            return;
        }

        // Lazy-init data arrays
        if (!this.freqData || this.freqData.length !== analyser.frequencyBinCount) {
            this.freqData = new Uint8Array(analyser.frequencyBinCount);
            this.timeData = new Uint8Array(analyser.fftSize);
        }

        analyser.getByteFrequencyData(this.freqData);
        analyser.getByteTimeDomainData(this.timeData!);

        this.drawPeak(this.timeData!);
        this.drawSpectrum(this.freqData);
        this.drawPlayhead();
    };

    private drawPeak(timeData: Uint8Array): void {
        // Compute RMS from time-domain
        let sumSq = 0;
        let peak = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sumSq += v * v;
            const abs = Math.abs(v);
            if (abs > peak) peak = abs;
        }
        const rms = Math.sqrt(sumSq / timeData.length);

        // Map to percentage (0-100)
        const rmsPct = Math.min(rms * 3 * 100, 100); // scale up for visibility
        const peakPct = Math.min(peak * 100, 100);

        this.peakBarL.style.height = `${rmsPct}%`;
        this.peakBarR.style.height = `${peakPct}%`;

        // Colour coding
        const setBarClass = (el: HTMLElement, pct: number) => {
            el.className = pct > 95 ? 'peak-bar clip' : pct > 70 ? 'peak-bar hot' : 'peak-bar';
        };
        setBarClass(this.peakBarL, rmsPct);
        setBarClass(this.peakBarR, peakPct);

        // dB display
        const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
        this.peakValueEl.textContent = isFinite(db) ? `${db.toFixed(1)} dB` : '-∞ dB';
    }

    private drawSpectrum(freqData: Uint8Array): void {
        const canvas = this.spectrumCanvas;
        const ctx = this.spectrumCtx;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = rect.width;
        const h = rect.height;

        ctx.fillStyle = '#11111b';
        ctx.fillRect(0, 0, w, h);

        // Draw frequency bars (logarithmic scale, limited to useful range)
        const barCount = Math.min(64, freqData.length);
        const barWidth = w / barCount;

        for (let i = 0; i < barCount; i++) {
            // Map logarithmically
            const logIndex = Math.floor(Math.pow(freqData.length, i / barCount));
            const value = freqData[Math.min(logIndex, freqData.length - 1)] / 255;
            const barHeight = value * h;

            // Gradient colour from accent to peach
            const hue = 200 + (i / barCount) * 40; // blue to teal
            ctx.fillStyle = `hsl(${hue}, 70%, ${50 + value * 30}%)`;
            ctx.fillRect(
                i * barWidth + 0.5,
                h - barHeight,
                barWidth - 1,
                barHeight,
            );
        }
    }

    private drawPlayhead(): void {
        const samples = this.player.renderedSamples;
        if (!samples || samples.length === 0) return;

        const progress = this.player.getProgress();
        if (progress <= 0) return;

        const canvas = this.waveformCanvas;
        const ctx = this.waveformCtx;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        // Redraw waveform then overlay playhead
        this.drawWaveformOverview();

        // Semi-transparent overlay on played portion
        ctx.fillStyle = 'rgba(137, 180, 250, 0.08)';
        ctx.fillRect(0, 0, w * progress, h);

        // Playhead line
        const x = w * progress;
        ctx.strokeStyle = '#f5e0dc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    private clearCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#11111b';
        ctx.fillRect(0, 0, rect.width, rect.height);
    }
}

// ── Note highlighting ────────────────────────────────────

class NoteHighlighter {
    private editor: monaco.editor.IStandaloneCodeEditor;
    private decorations: string[] = [];
    private events: NoteEvent[] = [];
    private player: SongPlayer;
    private rafId: number | null = null;

    constructor(editor: monaco.editor.IStandaloneCodeEditor, player: SongPlayer) {
        this.editor = editor;
        this.player = player;
    }

    /** Set the compiled event list for the current source. */
    setEvents(eventList: any): void {
        this.events = (eventList?.events ?? []).filter(
            (e: any) => e.kind?.Note && e.kind.Note.source_start !== undefined,
        );
    }

    /** Start the highlighting animation loop. */
    start(): void {
        if (this.rafId !== null) return;
        this.tick();
    }

    /** Stop and clear all decorations. */
    stop(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.clearDecorations();
    }

    private tick = (): void => {
        this.rafId = requestAnimationFrame(this.tick);
        if (!this.player.isPlaying) return;

        const currentBeat = this.player.getCurrentBeat();
        const model = this.editor.getModel();
        if (!model) return;

        // Find notes that are currently sounding
        const activeDecos: monaco.editor.IModelDeltaDecoration[] = [];
        for (const evt of this.events) {
            const note = evt.kind.Note;
            const noteStart = evt.time;
            const noteEnd = evt.time + note.gate;
            if (currentBeat >= noteStart && currentBeat < noteEnd) {
                const startPos = model.getPositionAt(note.source_start);
                const endPos = model.getPositionAt(note.source_end);
                activeDecos.push({
                    range: new monaco.Range(
                        startPos.lineNumber,
                        startPos.column,
                        endPos.lineNumber,
                        endPos.column,
                    ),
                    options: {
                        className: 'note-playing',
                        inlineClassName: 'note-playing-inline',
                    },
                });
            }
        }

        this.decorations = this.editor.deltaDecorations(this.decorations, activeDecos);
    };

    private clearDecorations(): void {
        this.decorations = this.editor.deltaDecorations(this.decorations, []);
    }
}

// ── App ──────────────────────────────────────────────────

async function main() {
    await init();

    const player = new SongPlayer();

    // Register language and theme
    registerLanguage();

    // Inject dynamic CSS for note highlighting
    const highlightStyle = document.createElement('style');
    highlightStyle.textContent = `
        .note-playing {
            background-color: rgba(137, 180, 250, 0.15);
            border-radius: 2px;
        }
        .note-playing-inline {
            color: #f5e0dc !important;
            font-weight: bold;
        }
    `;
    document.head.appendChild(highlightStyle);

    // Create Monaco editor
    const editorContainer = document.getElementById('editor-container')!;
    const editor = monaco.editor.create(editorContainer, {
        value: loadSource(),
        language: LANGUAGE_ID,
        theme: 'songwalker-dark',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'off',
        renderWhitespace: 'none',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        padding: { top: 16, bottom: 16 },
        bracketPairColorization: { enabled: true },
        suggest: {
            showKeywords: true,
            showSnippets: true,
        },
    });

    // Auto-save on change
    editor.onDidChangeModelContent(() => {
        saveSource(editor.getValue());
    });

    // Create visualiser and highlighter
    const visualiser = new Visualiser(player);
    const highlighter = new NoteHighlighter(editor, player);

    // UI elements
    const playBtn = document.getElementById('play-btn')!;
    const stopBtn = document.getElementById('stop-btn')!;
    const openBtn = document.getElementById('open-btn')!;
    const saveBtn = document.getElementById('save-btn')!;
    const exportBtn = document.getElementById('export-btn')!;
    const fullscreenBtn = document.getElementById('fullscreen-btn')!;
    const presetBtn = document.getElementById('preset-btn')!;
    const statusEl = document.getElementById('status')!;
    const errorEl = document.getElementById('error')!;

    // Preset browser
    const presetLoader = new PresetLoader('https://clevertree.github.io/songwalker-library');
    const editorWrapper = document.querySelector('.editor-wrapper') as HTMLElement;
    const presetBrowser = new PresetBrowser(editorWrapper, presetLoader);
    presetBrowser.onPresetSelect((entry) => {
        // Insert a loadPreset comment/reference at cursor
        const position = editor.getPosition();
        if (position) {
            const text = `// Preset: ${entry.name} (${entry.path})\n`;
            editor.executeEdits('preset-browser', [{
                range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
                text,
            }]);
        }
    });

    // Compile and play using Rust DSP engine
    function compileAndPlay() {
        errorEl.textContent = '';
        clearErrorMarkers(editor);
        try {
            const source = editor.getValue();
            // Compile to get event list (for highlighting)
            const eventList = compile_song(source);
            highlighter.setEvents(eventList);
            // Render and play via Rust DSP
            player.playSource(source).then(() => {
                visualiser.drawWaveformOverview();
                visualiser.start();
                highlighter.start();
            });
        } catch (e: any) {
            const msg = String(e);
            errorEl.textContent = msg;
            showErrorLocation(editor, msg);
        }
    }

    // Export as WAV
    function exportWav() {
        errorEl.textContent = '';
        clearErrorMarkers(editor);
        try {
            const source = editor.getValue();
            compile_song(source); // validate first
            player.exportWav(source);
        } catch (e: any) {
            const msg = String(e);
            errorEl.textContent = msg;
            showErrorLocation(editor, msg);
        }
    }

    playBtn.addEventListener('click', compileAndPlay);
    stopBtn.addEventListener('click', () => {
        player.stop();
        visualiser.stop();
        highlighter.stop();
    });

    openBtn.addEventListener('click', async () => {
        const text = await openFile();
        if (text !== null) {
            editor.setValue(text);
            saveSource(text);
        }
    });

    saveBtn.addEventListener('click', () => saveFile(editor.getValue()));

    exportBtn.addEventListener('click', exportWav);

    fullscreenBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('fullscreen');
        setTimeout(() => editor.layout(), 100);
    });

    presetBtn.addEventListener('click', () => {
        presetBrowser.toggle();
    });

    // Register Ctrl+Enter as a Monaco keybinding
    editor.addAction({
        id: 'songwalker.play',
        label: 'Play Song',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => compileAndPlay(),
    });

    // Escape to exit fullscreen
    editor.addAction({
        id: 'songwalker.exitFullscreen',
        label: 'Exit Fullscreen',
        keybindings: [monaco.KeyCode.Escape],
        precondition: undefined,
        run: () => {
            document.documentElement.classList.remove('fullscreen');
            setTimeout(() => editor.layout(), 100);
        },
    });

    // Display playback state + stop visualisers when done
    player.onState((state) => {
        if (state.playing) {
            statusEl.textContent = `▶ ${state.currentBeat.toFixed(1)} / ${state.totalBeats.toFixed(1)}  @${state.bpm} BPM`;
        } else {
            statusEl.textContent = state.totalBeats > 0
                ? `${state.totalBeats.toFixed(1)} beats  @${state.bpm} BPM`
                : 'Ready';
            visualiser.stop();
            highlighter.stop();
        }
    });

    // Focus the editor
    editor.focus();
}

main().catch(console.error);
