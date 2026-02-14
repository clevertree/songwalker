import {Preset, PresetBank} from "../types";
import {InstrumentPresetBank} from "../instruments";


const presetBanks: Array<PresetBank> = [
    InstrumentPresetBank
]

async function* PresetLibrary(): AsyncGenerator<Preset> {
    for (const presetBank of presetBanks) {
        yield* presetBank()
    }
}


export default PresetLibrary;

export function registerPresetBank(presetBank: PresetBank) {
    presetBanks.push(presetBank);
}

try {
    require("@songwalker-presets");
} catch (e) {
    console.error("Error loading preset library: ", e);
}
