#!/usr/bin/env node
/**
 * generate-index.js
 *
 * Scans a songwalker-library directory for all preset.json files
 * and generates a root index.json catalog.
 *
 * Usage:
 *   node scripts/generate-index.js [library-dir]
 *
 * Default library-dir: ./library-output (or songwalker-library repo root)
 *
 * Designed to run as a Husky pre-commit hook:
 *   .husky/pre-commit: node scripts/generate-index.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const LIBRARY_DIR = process.argv[2] || './library-output';

function findPresetFiles(dir, results = []) {
    if (!existsSync(dir)) return results;

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            findPresetFiles(fullPath, results);
        } else if (entry.name === 'preset.json') {
            results.push(fullPath);
        }
    }
    return results;
}

function buildCatalogEntry(presetPath, libraryRoot) {
    const data = JSON.parse(readFileSync(presetPath, 'utf-8'));
    const relPath = relative(libraryRoot, presetPath).replace(/\\/g, '/');

    // Extract zone stats from the graph
    let zoneCount = 0;
    let keyRangeLow = 127;
    let keyRangeHigh = 0;

    function countZones(node) {
        if (!node) return;
        if (node.type === 'sampler' && node.config?.zones) {
            for (const zone of node.config.zones) {
                zoneCount++;
                if (zone.keyRange) {
                    keyRangeLow = Math.min(keyRangeLow, zone.keyRange.low);
                    keyRangeHigh = Math.max(keyRangeHigh, zone.keyRange.high);
                }
            }
        }
        if (node.type === 'composite' && node.children) {
            for (const child of node.children) {
                countZones(child);
            }
        }
    }
    countZones(data.graph);

    return {
        id: data.id,
        name: data.name,
        path: relPath,
        category: data.category,
        tags: data.tags || [],
        gmProgram: data.metadata?.gmProgram ?? null,
        sourceLibrary: data.metadata?.sourceLibrary ?? null,
        zoneCount,
        keyRange: zoneCount > 0 ? { low: keyRangeLow, high: keyRangeHigh } : null,
        tuningVerified: data.tuning?.verified ?? false,
    };
}

function main() {
    console.log(`Scanning ${LIBRARY_DIR} for preset.json files...`);

    const presetFiles = findPresetFiles(LIBRARY_DIR);
    console.log(`Found ${presetFiles.length} presets`);

    const entries = [];
    let errors = 0;

    for (const file of presetFiles) {
        try {
            const entry = buildCatalogEntry(file, LIBRARY_DIR);
            entries.push(entry);
        } catch (e) {
            console.error(`Error reading ${file}: ${e.message}`);
            errors++;
        }
    }

    // Sort by category, then name
    entries.sort((a, b) => {
        const catCmp = (a.category || '').localeCompare(b.category || '');
        if (catCmp !== 0) return catCmp;
        return (a.name || '').localeCompare(b.name || '');
    });

    const index = {
        version: 1,
        generatedAt: new Date().toISOString(),
        presets: entries,
    };

    const outputPath = join(LIBRARY_DIR, 'index.json');
    writeFileSync(outputPath, JSON.stringify(index, null, 2));

    const sizeKB = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
    console.log(`Generated ${outputPath}`);
    console.log(`  ${entries.length} presets, ${sizeKB} KB`);
    if (errors > 0) console.log(`  ${errors} errors`);
}

main();
