import {Preset} from "@songwalker/types";
import WebAudioFontInstrumentLoader, {
    WebAudioFontInstrumentLoaderConfig
} from "@songwalker-presets/WebAudioFont/WebAudioFontInstrumentLoader";
import {fetchJSONFromMirror} from "@songwalker-presets/WebAudioFont/mirrors";
import {
    PRESET_PATH_DRUMSET,
    PRESET_PATH_DRUMSET_NAMES,
    PRESET_PATH_INSTRUMENT,
    PRESET_PATH_INSTRUMENT_KEYS,
    PRESET_PATH_INSTRUMENT_NAMES,
    PRESET_PATH_PERCUSSION,
    PRESET_PATH_PERCUSSION_KEYS,
    PRESET_PATH_PERCUSSION_NAMES
} from "@songwalker-presets/WebAudioFont/constants";
import WebAudioFontInstrument from "@songwalker-presets/WebAudioFont/WebAudioFontInstrument";

export async function* WebAudioFontLibrary(): AsyncGenerator<Preset> {
    yield {
        title: "WebAudioFont",
        loader: WebAudioFontInstrument,
        config: {}
    }
    yield {
        title: "WebAudioFontLoader",
        loader: WebAudioFontInstrumentLoader,
        config: {}
    }
    yield* listInstruments()
    yield* listDrumAndDrumSets()
}

async function* listInstruments() {
    let instrumentKeys = await fetchJSONFromMirror(PRESET_PATH_INSTRUMENT_KEYS);
    let instrumentNames = await fetchJSONFromMirror(PRESET_PATH_INSTRUMENT_NAMES);
    for (let i = 0; i < instrumentKeys.length; i++) {
        const instrumentKey = instrumentKeys[i];
        const [pitch, ...libraryStringParts] = instrumentKey.split('_')
        const libraryString = libraryStringParts.join('_').replace(/\.js$/, '');
        const libraryName = libraryString
            .replace(/_file$/, '')
            .replace(/_sf2$/, '')
        const instrumentName = instrumentNames[parseInt(pitch.substring(0, 3))];
        if (!instrumentName)
            throw new Error(`Invalid instrument name (pitch = ${pitch})`)
        yield {
            title: `${libraryName}/${instrumentName}`,
            loader: WebAudioFontInstrumentLoader,
            config: {
                presetPath: `${PRESET_PATH_INSTRUMENT}/${instrumentKey}.json`
            }
        } as Preset<WebAudioFontInstrumentLoaderConfig>
    }
}

async function* listDrumAndDrumSets(): AsyncGenerator<Preset<WebAudioFontInstrumentLoaderConfig>> {
    let drumKeys = await fetchJSONFromMirror(PRESET_PATH_PERCUSSION_KEYS);
    let drumNames = await fetchJSONFromMirror(PRESET_PATH_PERCUSSION_NAMES);
    // let drumSets = await fetchJSONFromMirror(PRESET_PATH_DRUMSET_KEYS);
    let drumSetNames = await fetchJSONFromMirror(PRESET_PATH_DRUMSET_NAMES);
    // const drumSetKeys = Object.keys(drumSets);
    // Loop through drum-sets first
    const drumSetLibraryKeys = Object.keys(drumSetNames)
    for (const drumSetLibraryKey of drumSetLibraryKeys) {
        const drumSets = drumSetNames[drumSetLibraryKey];
        for (let i = 0; i < drumSets.length; i++) {
            const drumSetName = drumSets[i];
            const presetName = `${drumSetLibraryKey}_${drumSetName}`
                .replaceAll(' ', '_')
            yield {
                title: `${drumSetLibraryKey}/${drumSetName}`,
                loader: WebAudioFontInstrumentLoader,
                config: {
                    presetPath: `${PRESET_PATH_DRUMSET}/${presetName}.json`
                }
            } as Preset<WebAudioFontInstrumentLoaderConfig>
        }
    }

    // Loop though all percussion instruments
    for (let i = 0; i < drumKeys.length; i++) {
        const drumKey = drumKeys[i];
        const [pitch, drumSetID, ...libraryStringParts] = drumKey.split('_')
        const libraryString = libraryStringParts.join('_').replace(/\.js$/, '')
            .replace(/_file$/, '')
            .replace(/_sf2$/, '')
        const drumSetName = drumSetNames[libraryString as keyof typeof drumSetNames][parseInt(drumSetID)];
        yield {
            title: `${libraryString}/${drumSetName}/${drumNames[pitch as keyof typeof drumNames]}`,
            loader: WebAudioFontInstrumentLoader,
            config: {
                presetPath: `${PRESET_PATH_PERCUSSION}/${drumKey}.json`
            }
        } as Preset<WebAudioFontInstrumentLoaderConfig>
    }
}

