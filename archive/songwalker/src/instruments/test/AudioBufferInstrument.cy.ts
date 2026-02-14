import {generateRandomBuffer} from "../test/testHelper";
import {playSong, renderSong, songwalker} from "../..";

const song = songwalker`
await loadPreset('AudioBuffer', {
    src: track.custom.src,
    loop: true,
    mixer: 1,
    pan: -.2
})
for (let o = 2; o <= 6; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
D4 1 C4 1
`


describe('AudioBuffer', () => {
    it('AudioBuffer plays C#4d1/2', async () => {
        const src = generateRandomBuffer(new AudioContext())
        const {renderedBuffer} = await renderSong(song, {custom: {src}});
        console.log('renderedBuffer', renderedBuffer)
        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))

    })
})
