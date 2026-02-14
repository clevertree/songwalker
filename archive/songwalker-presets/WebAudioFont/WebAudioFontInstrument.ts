import {InstrumentLoader, parseNote, SongWalkerState, TrackState} from "@songwalker";
import WebAudioFontPlayer from "./src/player";
import {WavePreset} from "@songwalker-presets/WebAudioFont/src/otypes";
import DrumToMIDI from "./constants/drumToMIDI";


export interface WebAudioFontInstrumentConfig extends WavePreset {
    title?: string,
}

// export interface VoiceConfiguration {
//     alias?: string
//     preset: InstrumentPreset
// }


const WebAudioFontInstrument: InstrumentLoader<WebAudioFontInstrumentConfig> = async function (songState: SongWalkerState, config) {
    const {
        rootTrackState,
    } = songState;
    const audioContext = songState.getContext();
    const player = new WebAudioFontPlayer();
    await player.adjustPreset(audioContext, config);

    const syncTime = audioContext.currentTime - rootTrackState.currentTime;
    if (syncTime > 0) {
        console.error(`WebAudioFontInstrumentLoader continued loading past buffer (${syncTime}).`)
    }

    function playWebAudioFontNote(track: TrackState, commandString: string) {
        const {
            destination = audioContext.destination,
            currentTime,
            duration = 1,
            beatsPerMinute
        } = track;
        let pitch: number;
        if (typeof DrumToMIDI[commandString] !== 'undefined') {
            pitch = DrumToMIDI[commandString]
        } else {
            const {frequency} = parseNote(commandString);
            pitch = (Math.log(frequency) / Math.log(2)) * 12
        }
        // const playbackRate = Math.pow(2, (100.0 * pitch) / 1200.0);
        const durationSeconds = duration * (60 / beatsPerMinute)
        player.queueWaveTable(audioContext, destination, config, currentTime, pitch, durationSeconds);
    }

    // Set this instrument if no root track instrument was set
    if (!songState.rootTrackState.instrument)
        songState.rootTrackState.instrument = playWebAudioFontNote;
    return playWebAudioFontNote
}
export default WebAudioFontInstrument
