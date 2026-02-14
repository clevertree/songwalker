import init, { compile_song } from './wasm/songwalker_core.js';
import { SongPlayer } from './player.js';
import * as monaco from 'monaco-editor';
import {
    LANGUAGE_ID,
    languageConfig,
    monarchTokens,
    editorTheme,
    completionItems,
} from './sw-language.js';

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
track.beatsPerMinute = 140;

riff();

track riff() {
    track.duration = 1/4;

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

// ── App ──────────────────────────────────────────────────

async function main() {
    await init();

    const player = new SongPlayer();

    // Register language and theme
    registerLanguage();

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

    // UI elements
    const playBtn = document.getElementById('play-btn')!;
    const stopBtn = document.getElementById('stop-btn')!;
    const openBtn = document.getElementById('open-btn')!;
    const saveBtn = document.getElementById('save-btn')!;
    const exportBtn = document.getElementById('export-btn')!;
    const fullscreenBtn = document.getElementById('fullscreen-btn')!;
    const statusEl = document.getElementById('status')!;
    const errorEl = document.getElementById('error')!;

    // Compile and play using Rust DSP engine
    function compileAndPlay() {
        errorEl.textContent = '';
        try {
            const source = editor.getValue();
            // Validate syntax first
            compile_song(source);
            // Then render and play via Rust DSP
            player.playSource(source);
        } catch (e: any) {
            errorEl.textContent = String(e);
        }
    }

    // Export as WAV
    function exportWav() {
        errorEl.textContent = '';
        try {
            const source = editor.getValue();
            compile_song(source); // validate first
            player.exportWav(source);
        } catch (e: any) {
            errorEl.textContent = String(e);
        }
    }

    playBtn.addEventListener('click', compileAndPlay);
    stopBtn.addEventListener('click', () => player.stop());

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

    // Display playback state
    player.onState((state) => {
        if (state.playing) {
            statusEl.textContent = `▶ ${state.currentBeat.toFixed(1)} / ${state.totalBeats.toFixed(1)}  @${state.bpm} BPM`;
        } else {
            statusEl.textContent = `${state.totalBeats.toFixed(1)} beats  @${state.bpm} BPM`;
        }
    });

    // Focus the editor
    editor.focus();
}

main().catch(console.error);
