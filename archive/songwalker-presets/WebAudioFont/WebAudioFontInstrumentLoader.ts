import {InstrumentLoader, SongWalkerState} from "@songwalker/types";
import WebAudioFontInstrument, {
    WebAudioFontInstrumentConfig
} from "@songwalker-presets/WebAudioFont/WebAudioFontInstrument";
import {fetchJSONFromMirror} from "@songwalker-presets/WebAudioFont/mirrors";


export interface WebAudioFontInstrumentLoaderConfig {
    title?: string,
    presetPath: string,
}

// export interface VoiceConfiguration {
//     alias?: string
//     preset: InstrumentPreset
// }


const WebAudioFontInstrumentLoader: InstrumentLoader<WebAudioFontInstrumentLoaderConfig> = async function (songState: SongWalkerState, config) {
    const {
        presetPath
    } = config;
    let fontConfig: WebAudioFontInstrumentConfig = await fetchJSONFromMirror(presetPath);
    return WebAudioFontInstrument(songState, fontConfig)
}

export default WebAudioFontInstrumentLoader;
