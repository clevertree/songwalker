#!/usr/bin/env node
/**
 * convert-webaudiofontdata.mjs
 *
 * Converts webaudiofontdata JSON instrument files to the unified
 * songwalker-library preset format.
 *
 * Usage:
 *   node scripts/convert-webaudiofontdata.mjs \
 *     --source /path/to/webaudiofontdata/public \
 *     --output /path/to/songwalker-library
 *
 * The script:
 * 1. Reads instrumentNames.json + instrumentKeys.json for GM mapping
 * 2. Processes each JSON instrument file from i/, p/, s/ directories
 * 3. Extracts base64 audio → WAV files with SHA256 dedup
 * 4. Creates preset.json for each instrument
 * 5. Organizes by GM category folders
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { createHash } from 'crypto';

// ── Configuration ───────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name) {
    const idx = args.indexOf(name);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

const SOURCE_DIR = getArg('--source') || '../samples/webaudiofontdata/public';
const OUTPUT_DIR = getArg('--output') || './library-output';
const DRY_RUN = args.includes('--dry-run');
const LIMIT = getArg('--limit') ? parseInt(getArg('--limit')) : Infinity;

// ── GM Category Mapping ─────────────────────────────────────

const GM_CATEGORIES = [
    'piano', 'piano', 'piano', 'piano', 'piano', 'piano', 'piano', 'piano',
    'chromatic-percussion', 'chromatic-percussion', 'chromatic-percussion', 'chromatic-percussion',
    'chromatic-percussion', 'chromatic-percussion', 'chromatic-percussion', 'chromatic-percussion',
    'organ', 'organ', 'organ', 'organ', 'organ', 'organ', 'organ', 'organ',
    'guitar', 'guitar', 'guitar', 'guitar', 'guitar', 'guitar', 'guitar', 'guitar',
    'bass', 'bass', 'bass', 'bass', 'bass', 'bass', 'bass', 'bass',
    'strings', 'strings', 'strings', 'strings', 'strings', 'strings', 'strings', 'strings',
    'ensemble', 'ensemble', 'ensemble', 'ensemble', 'ensemble', 'ensemble', 'ensemble', 'ensemble',
    'brass', 'brass', 'brass', 'brass', 'brass', 'brass', 'brass', 'brass',
    'reed', 'reed', 'reed', 'reed', 'reed', 'reed', 'reed', 'reed',
    'pipe', 'pipe', 'pipe', 'pipe', 'pipe', 'pipe', 'pipe', 'pipe',
    'synth-lead', 'synth-lead', 'synth-lead', 'synth-lead', 'synth-lead', 'synth-lead', 'synth-lead', 'synth-lead',
    'synth-pad', 'synth-pad', 'synth-pad', 'synth-pad', 'synth-pad', 'synth-pad', 'synth-pad', 'synth-pad',
    'synth-effects', 'synth-effects', 'synth-effects', 'synth-effects', 'synth-effects', 'synth-effects', 'synth-effects', 'synth-effects',
    'ethnic', 'ethnic', 'ethnic', 'ethnic', 'ethnic', 'ethnic', 'ethnic', 'ethnic',
    'percussive', 'percussive', 'percussive', 'percussive', 'percussive', 'percussive', 'percussive', 'percussive',
    'sound-effects', 'sound-effects', 'sound-effects', 'sound-effects', 'sound-effects', 'sound-effects', 'sound-effects', 'sound-effects',
];

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1;
    const note = midi % 12;
    return `${NOTE_NAMES[note]}${octave}`;
}

// ── Audio Extraction ────────────────────────────────────────

// Global dedup map: sha256 -> { filename, count }
const audioHashes = new Map();
let totalDedupSaved = 0;

/**
 * Extract base64 audio from a zone and write to a file.
 * Returns the filename (relative to preset dir).
 */
function extractAudio(zone, presetDir, zoneIndex, noteName) {
    const audioData = zone.file || zone.sample;
    if (!audioData) return null;

    const isFile = !!zone.file; // MP3 or compressed
    const buffer = Buffer.from(audioData, 'base64');
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);

    // Determine codec from content
    let codec = 'wav';
    let ext = 'wav';
    if (isFile) {
        // Check MP3 magic bytes (ID3 or MPEG sync word)
        if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
            codec = 'mp3'; ext = 'mp3';
        } else if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
            codec = 'mp3'; ext = 'mp3';
        } else if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67) {
            codec = 'ogg'; ext = 'ogg';
        }
    } else {
        // Raw PCM sample — we'll write as-is (raw 16-bit PCM)
        codec = 'raw';
        ext = 'raw';
    }

    const filename = `zone_${noteName}.${ext}`;
    const filepath = join(presetDir, filename);

    // Dedup check
    const hashKey = hash;
    if (audioHashes.has(hashKey)) {
        audioHashes.get(hashKey).count++;
        totalDedupSaved++;
    } else {
        audioHashes.set(hashKey, { filename, count: 1 });
    }

    if (!DRY_RUN) {
        writeFileSync(filepath, buffer);
    }

    return { filename, codec, sha256: hash };
}

// ── Pitch Normalization ─────────────────────────────────────

function normalizePitch(zone) {
    const originalPitch = zone.originalPitch || 6000;
    const coarseTune = zone.coarseTune || 0;
    const fineTune = zone.fineTune || 0;

    // base_detune = originalPitch - 100 * coarseTune - fineTune
    const baseDetune = originalPitch - 100 * coarseTune - fineTune;
    const rootNote = Math.max(0, Math.min(127, Math.floor(baseDetune / 100)));
    const fineTuneCents = baseDetune % 100;

    return { rootNote, fineTuneCents };
}

// ── Zone Conversion ─────────────────────────────────────────

function convertZone(zone, presetDir, zoneIndex) {
    const { rootNote, fineTuneCents } = normalizePitch(zone);
    const noteName = midiToNoteName(rootNote);

    const audioInfo = extractAudio(zone, presetDir, zoneIndex, noteName);
    if (!audioInfo) return null;

    const converted = {
        keyRange: {
            low: zone.keyRangeLow ?? 0,
            high: zone.keyRangeHigh ?? 127,
        },
        pitch: {
            rootNote,
            fineTuneCents,
        },
        sampleRate: zone.sampleRate || 44100,
        audio: {
            type: 'external',
            url: audioInfo.filename,
            codec: audioInfo.codec,
            sha256: audioInfo.sha256,
        },
    };

    // Add loop points if present and valid
    if (zone.loopStart != null && zone.loopEnd != null &&
        zone.loopStart >= 0 && zone.loopEnd > zone.loopStart) {
        converted.loop = { start: zone.loopStart, end: zone.loopEnd };
    }

    return converted;
}

// ── Instrument Conversion ───────────────────────────────────

function convertInstrument(filePath, gmProgram, instrumentName, libraryName, variant) {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const zones = data.zones || [];

    if (zones.length === 0) return null;

    const isPercussion = zones.some(z => z.midi === 128);
    const category = isPercussion ? 'percussion' : GM_CATEGORIES[gmProgram] || 'unknown';

    // Create a safe directory name
    const safeName = instrumentName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    const safeLib = libraryName.replace(/[^a-zA-Z0-9]/g, '_');
    const dirName = `${safeLib}_${safeName}`;

    let presetPath;
    if (isPercussion) {
        presetPath = join(OUTPUT_DIR, 'percussion', 'individual', dirName);
    } else {
        presetPath = join(OUTPUT_DIR, 'instruments', category, dirName);
    }

    if (!DRY_RUN) {
        mkdirSync(presetPath, { recursive: true });
    }

    // Convert all zones
    const convertedZones = [];
    for (let i = 0; i < zones.length; i++) {
        const z = convertZone(zones[i], presetPath, i);
        if (z) convertedZones.push(z);
    }

    if (convertedZones.length === 0) return null;

    // Build tags
    const tags = [];
    tags.push(isPercussion ? 'percussion' : 'melodic');
    if (!isPercussion) tags.push(category);
    tags.push(`gm:${gmProgram}`);
    tags.push(`library:${libraryName}`);

    // Check for loop support
    if (convertedZones.some(z => z.loop)) tags.push('sustained', 'looped');
    else tags.push('one-shot');

    const id = `${safeLib.toLowerCase()}-${safeName.toLowerCase().replace(/_/g, '-')}`;

    const preset = {
        id,
        name: instrumentName,
        category: isPercussion ? 'sampler' : 'sampler',
        tags,
        metadata: {
            gmProgram,
            gmCategory: isPercussion ? 'Percussion' : GM_CATEGORIES[gmProgram],
            sourceLibrary: libraryName,
            variant,
            license: 'See original SF2 license',
        },
        graph: {
            type: 'sampler',
            config: {
                isDrumKit: isPercussion,
                zones: convertedZones,
            },
        },
    };

    if (!DRY_RUN) {
        writeFileSync(
            join(presetPath, 'preset.json'),
            JSON.stringify(preset, null, 2)
        );
    }

    return {
        id: preset.id,
        name: preset.name,
        path: presetPath.replace(OUTPUT_DIR + '/', '') + '/preset.json',
        category: preset.category,
        tags: preset.tags,
        gmProgram,
        sourceLibrary: libraryName,
        zoneCount: convertedZones.length,
        keyRange: {
            low: Math.min(...convertedZones.map(z => z.keyRange.low)),
            high: Math.max(...convertedZones.map(z => z.keyRange.high)),
        },
        tuningVerified: false,
    };
}

// ── Instrument File Parsing ─────────────────────────────────

function parseInstrumentFilename(filename) {
    // Pattern: {XXXX}_{Library}_{sf2}[_file].json
    // XXXX / 10 = GM program, XXXX % 10 = variant
    const match = filename.match(/^(\d{4})_(.+?)(?:_sf2(?:_file)?)?\.json$/);
    if (!match) return null;

    const code = parseInt(match[1]);
    const library = match[2];
    const gmProgram = Math.floor(code / 10);
    const variant = code % 10;

    return { gmProgram, variant, library };
}

function parsePercussionFilename(filename) {
    // Pattern: {NN}_{X}_{Library}...json
    const match = filename.match(/^(\d+)_(\d+)_(.+?)(?:_sf2(?:_file)?)?\.json$/);
    if (!match) return null;

    const midiNote = parseInt(match[1]);
    const variant = parseInt(match[2]);
    const library = match[3];

    return { midiNote, variant, library };
}

// ── Main Conversion Pipeline ────────────────────────────────

function main() {
    console.log('SongWalker Preset Converter');
    console.log(`Source:  ${SOURCE_DIR}`);
    console.log(`Output:  ${OUTPUT_DIR}`);
    console.log(`Dry run: ${DRY_RUN}`);
    console.log();

    // Load GM instrument names
    let instrumentNames;
    try {
        instrumentNames = JSON.parse(readFileSync(join(SOURCE_DIR, 'instrumentNames.json'), 'utf-8'));
    } catch (e) {
        console.error('Could not load instrumentNames.json:', e.message);
        process.exit(1);
    }

    // Create output directories
    if (!DRY_RUN) {
        mkdirSync(join(OUTPUT_DIR, 'instruments'), { recursive: true });
        mkdirSync(join(OUTPUT_DIR, 'percussion', 'individual'), { recursive: true });
        mkdirSync(join(OUTPUT_DIR, 'percussion', 'drum-kits'), { recursive: true });
        mkdirSync(join(OUTPUT_DIR, 'synths'), { recursive: true });
        mkdirSync(join(OUTPUT_DIR, 'effects'), { recursive: true });
        for (const cat of new Set(GM_CATEGORIES)) {
            mkdirSync(join(OUTPUT_DIR, 'instruments', cat), { recursive: true });
        }
    }

    const catalogEntries = [];
    let convertedCount = 0;
    let errorCount = 0;

    // ── Convert instrument files (i/) ──
    const instrumentDir = join(SOURCE_DIR, 'i');
    if (existsSync(instrumentDir)) {
        const files = readdirSync(instrumentDir).filter(f => f.endsWith('.json')).sort();
        console.log(`Found ${files.length} instrument files`);

        for (const file of files) {
            if (convertedCount >= LIMIT) break;

            const info = parseInstrumentFilename(file);
            if (!info || info.gmProgram >= 128) continue;

            const name = instrumentNames[info.gmProgram] || `Program ${info.gmProgram}`;
            // Strip category suffix from name (e.g., "Harpsichord: Piano" → "Harpsichord")
            const cleanName = name.split(':')[0].trim();

            try {
                const entry = convertInstrument(
                    join(instrumentDir, file),
                    info.gmProgram,
                    cleanName,
                    info.library,
                    info.variant
                );
                if (entry) {
                    catalogEntries.push(entry);
                    convertedCount++;
                    if (convertedCount % 50 === 0) {
                        console.log(`  Converted ${convertedCount} instruments...`);
                    }
                }
            } catch (e) {
                console.error(`  Error converting ${file}: ${e.message}`);
                errorCount++;
            }
        }
    }

    // ── Convert percussion files (p/) ──
    const percussionDir = join(SOURCE_DIR, 'p');
    if (existsSync(percussionDir)) {
        const files = readdirSync(percussionDir).filter(f => f.endsWith('.json')).sort();
        console.log(`Found ${files.length} percussion files`);

        let percCount = 0;
        for (const file of files) {
            if (convertedCount >= LIMIT) break;

            const info = parsePercussionFilename(file);
            if (!info) continue;

            const noteName = midiToNoteName(info.midiNote);

            try {
                const entry = convertInstrument(
                    join(percussionDir, file),
                    128, // sentinel for percussion
                    `Percussion_${noteName}_${info.midiNote}`,
                    info.library,
                    info.variant
                );
                if (entry) {
                    // Override category
                    entry.category = 'sampler';
                    entry.tags = ['percussion', `midi:${info.midiNote}`, `library:${info.library}`];
                    catalogEntries.push(entry);
                    convertedCount++;
                    percCount++;
                    if (percCount % 100 === 0) {
                        console.log(`  Converted ${percCount} percussion files...`);
                    }
                }
            } catch (e) {
                console.error(`  Error converting ${file}: ${e.message}`);
                errorCount++;
            }
        }
    }

    // ── Write catalog ──
    console.log();
    console.log(`Total converted: ${convertedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Unique audio files: ${audioHashes.size}`);
    console.log(`Dedup savings: ${totalDedupSaved} duplicates skipped`);

    if (!DRY_RUN) {
        const index = {
            version: 1,
            generatedAt: new Date().toISOString(),
            presets: catalogEntries,
        };
        writeFileSync(
            join(OUTPUT_DIR, 'index.json'),
            JSON.stringify(index, null, 2)
        );
        console.log(`Wrote index.json with ${catalogEntries.length} entries`);
    } else {
        console.log(`(Dry run — ${catalogEntries.length} entries would be written)`);
    }
}

main();
