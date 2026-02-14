// noinspection DuplicatedCode

import {WebAudioFontInstrumentConfig} from "@songwalker-presets/WebAudioFont/WebAudioFontInstrument";

import {playSong, renderSong, songwalker} from "@songwalker";

const song = songwalker`
await loadPreset('WebAudioFont', track.custom.webAudioFontConfig);

for (let o = 2; o <= 6; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
D4 1 C4 1
`
describe('WebAudioFontInstrument', () => {

    it('loads and plays', async () => {
        const webAudioFontConfig: WebAudioFontInstrumentConfig = {
            zones: [
                {
                    ahdsr: false,
                    // anchor: 0.00013605,
                    coarseTune: 0,
                    file: "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjcyLjEwMQAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFMgDr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr6+vr//////////////////////////////////////////////////////////////////8AAAAATGF2YzU3Ljk2AAAAAAAAAAAAAAAAJAXoAAAAAAAABTKUt2u9AAAAAAD/++DEAAALjDds9BSALvRILT894DAIAV+1t4xjGMYxjAAAAAUE9ogCgIAgGGHxw8f+AAZ/h4e//AHeZ/+Bv/8wD/4Bn/8cAd+AGP/w8Ad/AMf/jwB38Rj//YA7/zf/+AAAAAAYeHh4eAAAAAIw8PDx4BDK0MqOQOgMqr7M1qNBoNQYBoAhgGgPBcAIwAwADGuKhMPwVAEgJAUBkOASEIARhikYmBoPKKAGmAYA6XuMAUBA01jfzTzpqGgBzBdAYRBMAQAkzqW6DYtFuMIAA8vUW6AwArhP0aHDQpntLqmPQa4KgAF72YrtZ2pUispsYa5t5jAFCmMAD0YU4O40AGVgAo/LLVn99lzPrFQoBqYNwJJgyh6GD+GAYA4ObZYAizrPJAs1KYzhVlJgJhNGCKDsYEIE5UBeMCEEYDAfwy4EATU5FJC/vzLsyq1EVaJxB4CAOmAIAmQABBQCu1NTEN3bMPyO1KpdnWpqb60qMAgB0tQSAMgQA9HBl8lVyFQDJXK6+FujllncYpKvK1Wlwq0tn6oJAET9C4DRgAgIIZjoCQJAITrYA3Jk2qSWWNVLFP3CX2+09PGa3ZTWprtamtarSrHALABl7VlCABUCAFpoDgB4IAHU0WDZC0FDJOZfP//////////////////63//z//f/v///////1/+IQDgSAIquMgGA0ARU6bi0mzqYsNaUIgCQYACvgYANBgAqwiL6VLeNejTWRGAIXuY2KgFKTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+xDE1gPAAAGkHAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==",
                    fineTune: 0,
                    keyRangeHigh: 97,
                    keyRangeLow: 0,
                    loopEnd: 213,
                    loopStart: 188,
                    // midi: 31,
                    originalPitch: 8700 * 1,
                    sampleRate: 44100
                }
            ]
        }
        const {renderedBuffer} = await renderSong(song, {
            custom: {webAudioFontConfig}
        });
        console.log('renderedBuffer', renderedBuffer)

        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))
    })
})
