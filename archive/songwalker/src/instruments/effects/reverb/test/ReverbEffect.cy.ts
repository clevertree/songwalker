// noinspection DuplicatedCode

import {playSong, renderSong, songwalker} from "../../../..";

const song = songwalker`
await loadPreset("Oscillator");
track.effects = [await loadPreset("Reverb", {duration: 10, decay: 0.5})];
for (let o = 2; o <= 6; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
10
`

describe('ReverbEffect', () => {
    it('Oscillator with ReverbEffect', async () => {
        const {renderedBuffer} = await renderSong(song);
        console.log('renderedBuffer', renderedBuffer)
        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))
    })
})
