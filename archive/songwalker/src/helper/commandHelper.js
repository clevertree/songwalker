"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    } catch (error) {
        e = {error: error};
    } finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        } finally {
            if (e) throw e.error;
        }
    }
    return ar;
};
var __values = (this && this.__values) || function (o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return {value: o && o[i++], done: !o};
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", {value: true});
exports.formatDuration = exports.parseWait = exports.parseNote = exports.formatCommandOverrides = exports.parseNumeric = void 0;
var language_1 = require("../compiler/language");
var DEFAULT_FREQUENCY_A4 = 440; // 432;
// const REGEX_PARSE_COMMAND = LANGUAGE["command-statement"]; // /^([^@^;\s]+)((?:[@^][^@^;\s]+)*)(?=;)?$/
var REGEX_PARSE_COMMAND_PARAMS = /([@^])([^@^=;\s]+)/g;
var REGEX_PARSE_FRACTION = /^(\d*)\/(\d+)?$/;
var REGEX_NOTE_COMMAND = /^([A-G][#qb]{0,2})(\d*)$/;

function parseNumeric(numericString) {
    if (numericString.indexOf('/') !== -1) {
        var match = numericString.match(REGEX_PARSE_FRACTION);
        if (!match)
            throw new Error("Invalid numeric string: " + numericString);
        var _a = __read(match, 3), numerator = _a[1], denominator = _a[2];
        return (numerator !== '' ? parseFloat(numerator) : 1) / parseFloat(denominator);
    } else {
        return parseFloat(numericString);
    }
}

exports.parseNumeric = parseNumeric;

function formatCommandOverrides(overrides, aliases) {
    var e_1, _a;
    var formattedProperties = '';
    var matches = overrides.matchAll(REGEX_PARSE_COMMAND_PARAMS);
    try {
        for (var matches_1 = __values(matches), matches_1_1 = matches_1.next(); !matches_1_1.done; matches_1_1 = matches_1.next()) {
            var _b = __read(matches_1_1.value, 3), key = _b[1], value = _b[2];
            var propertyName = aliases[key];
            if (!propertyName)
                throw new Error("Invalid override: " + key);
            if (value[0] === '/')
                value = '1' + value;
            formattedProperties += (formattedProperties ? ', ' : '') + "".concat(propertyName, ":").concat(value);
        }
    } catch (e_1_1) {
        e_1 = {error: e_1_1};
    } finally {
        try {
            if (matches_1_1 && !matches_1_1.done && (_a = matches_1.return)) _a.call(matches_1);
        } finally {
            if (e_1) throw e_1.error;
        }
    }
    return "{".concat(formattedProperties, "}");
}

exports.formatCommandOverrides = formatCommandOverrides;
// export function parseCommandParams(paramString: string): ParsedParams {
//     const parsedParams: ParsedParams = {};
//     const paramMatches = [...paramString.matchAll(REGEX_PARSE_COMMAND_PARAMS)];
//     for (const paramMatch of paramMatches) {
//         let [, paramSymbol, paramValue] = paramMatch;
//         parsedParams[OVERRIDE_ALIAS[paramSymbol as keyof OverrideAliases]] = formatDuration(paramValue)
//     }
//     return parsedParams;
// }
function parseNote(noteCommand, baseFrequency) {
    if (baseFrequency === void 0) {
        baseFrequency = DEFAULT_FREQUENCY_A4;
    }
    var match = noteCommand.match(REGEX_NOTE_COMMAND);
    if (!match)
        throw new Error("Invalid note command string: " + noteCommand);
    var _a = __read(match, 3), note = _a[1], octaveString = _a[2];
    var octave = parseInt(octaveString);
    if (typeof LIST_NOTE_NAMES[note] === "undefined")
        throw new Error("Unrecognized Note: " + note);
    var keyNumber = LIST_NOTE_NAMES[note];
    if (keyNumber < 6)
        keyNumber = keyNumber + 24 + ((octave - 1) * 24) + 2;
    else
        keyNumber = keyNumber + ((octave - 1) * 24) + 2;
    var frequency = baseFrequency * Math.pow(2, (keyNumber - 98) / 24);
    return {
        note: note,
        octave: octave,
        // keyNumber,
        frequency: frequency,
    };
}

exports.parseNote = parseNote;

function parseWait(fullWaitString) {
    var match = fullWaitString.match(language_1.default["swe-wait"]);
    if (!match)
        throw new Error("Invalid wait string: " + fullWaitString);
    var _a = __read(match, 2), duration = _a[1];
    return formatDuration(duration);
}

exports.parseWait = parseWait;

function formatDuration(durationString) {
    return durationString.replace(/^\//, '1/');
}

exports.formatDuration = formatDuration;
// TODO: change to regex calculation
var LIST_NOTE_NAMES = {
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
};
