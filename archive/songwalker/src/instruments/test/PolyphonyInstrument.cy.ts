import {PolyphonyInstrumentConfig} from "../PolyphonyInstrument";
import OscillatorInstrument, {OscillatorInstrumentConfig} from "../OscillatorInstrument";
import AudioBufferInstrument, {AudioBufferInstrumentConfig} from "../AudioBufferInstrument";
import {Preset} from "../../types";
import {generateRandomBuffer} from "./testHelper";
import {playSong, renderSong, songwalker} from "../..";

const song = songwalker`
await loadPreset('Polyphony', track.custom.polyphonyConfig);

for (let o = 2; o <= 6; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
D4 1 C4 1
`

describe('Polyphony', () => {
    it('Polyphony plays C#4d1/2', async () => {
        const polyphonyConfig: PolyphonyInstrumentConfig = {
            voices: [{
                title: 'osc',
                loader: OscillatorInstrument,
                config: {
                    pan: -.5,
                    mixer: 0.8,
                    type: 'square'
                }
            } as Preset<OscillatorInstrumentConfig>, {
                title: 'buffer',
                loader: AudioBufferInstrument,
                config: {
                    pan: .5,
                    mixer: 0.8,
                    src: generateRandomBuffer(new AudioContext())
                }
            } as Preset<AudioBufferInstrumentConfig>]
        };
        const {renderedBuffer} = await renderSong(song, {
            custom: {polyphonyConfig}
        });
        console.log('renderedBuffer', renderedBuffer)
        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))

    })
})
