import {OverrideAliases, ParsedNote} from "../types";

import LANGUAGE from "../compiler/language";

const DEFAULT_FREQUENCY_A4 = 440; // 432;

// const REGEX_PARSE_COMMAND = LANGUAGE["command-statement"]; // /^([^@^;\s]+)((?:[@^][^@^;\s]+)*)(?=;)?$/
const REGEX_PARSE_COMMAND_PARAMS = /([@^])([^@^=;\s]+)/g
const REGEX_PARSE_FRACTION = /^(\d*)\/(\d+)?$/
const REGEX_NOTE_COMMAND = /^([A-G][#qb]{0,2})(\d*)$/

export function parseNumeric(numericString: string) {
    if (numericString.indexOf('/') !== -1) {
        const match = numericString.match(REGEX_PARSE_FRACTION);
        if (!match)
            throw new Error("Invalid numeric string: " + numericString);
        const [, numerator, denominator] = match;
        return (numerator !== '' ? parseFloat(numerator) : 1) / parseFloat(denominator);
    } else {
        return parseFloat(numericString)
    }
}

export function formatCommandOverrides(overrides: string, aliases: OverrideAliases) {
    let formattedProperties = ''
    const matches = overrides.matchAll(REGEX_PARSE_COMMAND_PARAMS);
    for (let [, key, value] of matches) {
        const propertyName = aliases[key as keyof OverrideAliases];
        if (!propertyName)
            throw new Error("Invalid override: " + key);
        if (value[0] === '/')
            value = '1' + value;
        formattedProperties += (formattedProperties ? ', ' : '') + `${propertyName}:${value}`
    }
    return `{${formattedProperties}}`
}

// export function parseCommandParams(paramString: string): ParsedParams {
//     const parsedParams: ParsedParams = {};
//     const paramMatches = [...paramString.matchAll(REGEX_PARSE_COMMAND_PARAMS)];
//     for (const paramMatch of paramMatches) {
//         let [, paramSymbol, paramValue] = paramMatch;
//         parsedParams[OVERRIDE_ALIAS[paramSymbol as keyof OverrideAliases]] = formatDuration(paramValue)
//     }
//     return parsedParams;
// }

export function parseNote(noteCommand: string, baseFrequency: number = DEFAULT_FREQUENCY_A4): ParsedNote {
    const match = noteCommand.match(REGEX_NOTE_COMMAND);
    if (!match)
        throw new Error("Invalid note command string: " + noteCommand);
    const [, note, octaveString] = match;
    const octave: number = parseInt(octaveString);
    if (typeof LIST_NOTE_NAMES[note] === "undefined")
        throw new Error("Unrecognized Note: " + note);
    let keyNumber: number = LIST_NOTE_NAMES[note];
    if (keyNumber < 6)
        keyNumber = keyNumber + 24 + ((octave - 1) * 24) + 2;
    else
        keyNumber = keyNumber + ((octave - 1) * 24) + 2;
    let frequency = baseFrequency * Math.pow(2, (keyNumber - 98) / 24);
    return {
        note,
        octave,
        // keyNumber,
        frequency,
    }
}


export function parseWait(fullWaitString: string) {
    const match = fullWaitString.match(LANGUAGE["swe-wait"]);
    if (!match)
        throw new Error("Invalid wait string: " + fullWaitString);
    const [, duration] = match;
    return formatDuration(duration);
}

export function formatDuration(durationString: string): string {
    return durationString.replace(/^\//, '1/')
}

// const REGEX_FREQOld = /^([A-G][#qb]{0,2})(\d)?$/
//
// export function matchFrequencyString(noteString: string) {
//     return noteString.match(REGEX_FREQOld);
// }
//
// export function parseFrequencyString(noteString: string) {
//     const match = matchFrequencyString(noteString);
//     if (!match)
//         throw new Error("Unrecognized frequency: " + noteString);
//     const [, note, octaveString] = match;
//     const octave: number = parseInt(octaveString);
//     // if (isNaN(octave))
//     //     throw new Error("Invalid octave value: " + noteString);
//     const {frequency} = parseFrequencyParts(note, octave);
//     return frequency;
// }

// export function parseFrequencyParts(note: string, octave: number) {
//     if (typeof LIST_NOTE_NAMES[note] === "undefined")
//         throw new Error("Unrecognized Note: " + note);
//     let keyNumber: number = LIST_NOTE_NAMES[note];
//     if (keyNumber < 6)
//         keyNumber = keyNumber + 24 + ((octave - 1) * 24) + 2;
//     else
//         keyNumber = keyNumber + ((octave - 1) * 24) + 2;
//     let frequency = DEFAULT_FREQUENCY_A4 * Math.pow(2, (keyNumber - 98) / 24);
//     return {
//         note,
//         octave,
//         keyNumber,
//         frequency
//     };
// }

interface NoteToKeyNumberMap {
    [note: string]: number
}

// TODO: change to regex calculation
const LIST_NOTE_NAMES: NoteToKeyNumberMap = {
    'A': 0,
    'Aq': 1,
    'A#': 2,
    'A#q': 3,
    'Bb': 2,
    'Bbq': 3,
    'B': 4,
    'Bq': 5,
    'C': 6,
    'Cq': 7,
    'C#': 8,
    'C#q': 9,
    'Db': 8,
    'Dbq': 9,
    'D': 10,
    'Dq': 11,
    'D#': 12,
    'D#q': 13,
    'Eb': 12,
    'Ebq': 13,
    'E': 14,
    'Eq': 15,
    'E#': 16,
    'E#q': 17,
    'F': 16,
    'Fq': 17,
    'F#': 18,
    'F#q': 19,
    'Gb': 18,
    'Gbq': 19,
    'G': 20,
    'Gq': 21,
    'G#': 22,
    'G#q': 23,
    'Ab': 22,
    'Abq': 23,
}
