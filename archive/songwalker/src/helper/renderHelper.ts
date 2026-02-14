import {InstrumentInstance, PresetBank, SongCallback, SongWalkerState, TrackStateOverrideCallback} from "../types";
import PresetLibrary from "../presets/PresetLibrary";
import {getDefaultSongState} from "../helper/songHelper";

export async function renderSong(song: SongCallback,
                                 rootTrackOverrides?: TrackStateOverrideCallback,
) {
    const {lengthInSeconds} = await walkSongHeadless(song, rootTrackOverrides);
    const context = new OfflineAudioContext({
        numberOfChannels: 2,
        length: 44100 * lengthInSeconds,
        sampleRate: 44100,
    })
    const songState = getSongRendererState(context, rootTrackOverrides);
    // Render song
    await song(songState)
    return {
        renderedBuffer: await context.startRendering(),
        songState
    };
}

export async function walkSongHeadless(song: SongCallback,
                                       rootTrackOverrides?: TrackStateOverrideCallback,
) {
    const songState = getSongAnalysisState(rootTrackOverrides);
    // Analyze song
    await song(songState);
    const {
        rootTrackState: {
            currentTime,
            position
        }
    } = songState;
    return {lengthInSeconds: currentTime, lengthPosition: position};
}

export function getSongAnalysisState(
    rootTrackOverrides?: TrackStateOverrideCallback,
): SongWalkerState {
    return {
        ...getDefaultSongState({} as BaseAudioContext, rootTrackOverrides),
        execute: () => {
            // Do not execute notes
        },
        executeCallback: () => {
            // Do not execute sub-tracks
        },
        loadPreset: async () => {
            // Do not load instruments
            return null as unknown as InstrumentInstance
        },
    }
}

export function getSongRendererState(context: OfflineAudioContext,
                                     rootTrackOverrides?: TrackStateOverrideCallback,
                                     presetLibrary: PresetBank = PresetLibrary) {
    return getDefaultSongState(context, rootTrackOverrides, presetLibrary);
}
