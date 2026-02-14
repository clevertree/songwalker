import {parseNote} from "../..";
import {ParsedNote} from "../../types";

export interface KeyRangeConfig {
    keyRangeLow?: string,
    keyRangeHigh?: string,
}

type FilterCallback = (noteInfo: ParsedNote) => boolean;

export function configFilterByKeyRange({
                                           keyRangeHigh,
                                           keyRangeLow
                                       }: KeyRangeConfig, callback: FilterCallback = () => false): FilterCallback {
    let filterCallback = callback;
    if (typeof keyRangeLow !== 'undefined') {
        const keyRangeLowFrequency = parseNote(keyRangeLow).frequency;
        const refCallback = filterCallback
        filterCallback = (noteInfo) => {
            if (keyRangeLowFrequency > noteInfo.frequency) {
                return true;
            }
            return refCallback(noteInfo)
        }
    }
    if (typeof keyRangeHigh !== 'undefined') {
        const keyRangeHighFrequency = parseNote(keyRangeHigh).frequency;
        const refCallback = filterCallback
        filterCallback = (noteInfo) => {
            if (keyRangeHighFrequency < noteInfo.frequency) {
                return true;
            }
            return refCallback(noteInfo)
        }
    }
    return filterCallback;
}

// export function updateKeyRangeConfig(config: KeyRangeConfig, paramName: keyof KeyRangeConfig, command: commandWithOverrides) {
//     // switch (paramName) {
//     //     case 'keyRangeLow':
//     //         config.keyRangeLow =
//     //         return;
//     //     case 'keyRangeHigh':
//     //         config.keyRangeHigh =
//     //         return;
//     // }
//     throw new Error("Unknown config key: " + paramName);
// }

// export function configFilterByCurrentTime(): FilterCallback {
//     return (noteInfo: ParsedNote, command: commandWithOverrides) => {
//         let {
//             destination: {
//                 context: audioContext
//             },
//             currentTime,
//         } = commandState;
//         if (currentTime < audioContext.currentTime) {
//             console.warn("skipping note that occurs in the past: ",
//                 noteInfo.note, currentTime, '<', audioContext.currentTime)
//             return true
//         }
//         return false;
//     }
// }
