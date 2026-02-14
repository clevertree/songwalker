import init, { compile_song } from './wasm/songwalker_core.js';
import { SongPlayer, EventList } from './player.js';

const EXAMPLE_SONG = `// SongWalker Example
const lead = await loadPreset("Oscillator");
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
      return null; // user cancelled
    }
  } else {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sw,.txt';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          resolve(await file.text());
        } else {
          resolve(null);
        }
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

// ── App ──────────────────────────────────────────────────

async function main() {
  await init();

  const player = new SongPlayer();
  const editor = document.getElementById('editor') as HTMLTextAreaElement;
  const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
  const openBtn = document.getElementById('open-btn') as HTMLButtonElement;
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  const fullscreenBtn = document.getElementById('fullscreen-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('status') as HTMLElement;
  const errorEl = document.getElementById('error') as HTMLElement;

  // Load persisted source
  editor.value = loadSource();

  // Auto-save on edit
  editor.addEventListener('input', () => {
    saveSource(editor.value);
  });

  // Compile and play
  function compileAndPlay() {
    errorEl.textContent = '';
    try {
      const eventList: EventList = compile_song(editor.value);
      player.load(eventList);
      player.play();
    } catch (e: any) {
      errorEl.textContent = String(e);
    }
  }

  playBtn.addEventListener('click', compileAndPlay);
  stopBtn.addEventListener('click', () => player.stop());

  openBtn.addEventListener('click', async () => {
    const text = await openFile();
    if (text !== null) {
      editor.value = text;
      saveSource(text);
    }
  });

  saveBtn.addEventListener('click', () => saveFile(editor.value));

  fullscreenBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('fullscreen');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter or Cmd+Enter to play
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      compileAndPlay();
    }
    // Escape to exit fullscreen
    if (e.key === 'Escape') {
      document.documentElement.classList.remove('fullscreen');
    }
  });

  // Display playback state
  player.onState((state) => {
    if (state.playing) {
      statusEl.textContent = `Playing: beat ${state.currentBeat.toFixed(1)} / ${state.totalBeats.toFixed(1)} @ ${state.bpm} BPM`;
    } else {
      statusEl.textContent = `Stopped | ${state.totalBeats.toFixed(1)} beats @ ${state.bpm} BPM`;
    }
  });
}

main().catch(console.error);
