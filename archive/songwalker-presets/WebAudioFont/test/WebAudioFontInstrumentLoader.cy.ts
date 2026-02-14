// noinspection DuplicatedCode

import {WebAudioFontInstrumentLoaderConfig} from "@songwalker-presets/WebAudioFont/WebAudioFontInstrumentLoader";
import {fetchJSONFromMirror} from "@songwalker-presets/WebAudioFont/mirrors";
import {
    PRESET_PATH_DRUMSET,
    PRESET_PATH_DRUMSET_KEYS,
    PRESET_PATH_INSTRUMENT,
    PRESET_PATH_INSTRUMENT_KEYS,
    PRESET_PATH_PERCUSSION,
    PRESET_PATH_PERCUSSION_KEYS
} from "@songwalker-presets/WebAudioFont/constants";

import {playSong, renderSong, songwalker} from "@songwalker";

describe('WebAudioFontInstrument', () => {


    it('loads and plays instrument', async () => {

        const song = songwalker`
await loadPreset('WebAudioFontLoader', track.custom.webAudioFontInstrumentLoaderConfig);

for (let o = 0; o <= 4; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
D4 1 C4 1
`
        let instrumentKeys = await fetchJSONFromMirror(PRESET_PATH_INSTRUMENT_KEYS);
        const webAudioFontInstrumentLoaderConfig: WebAudioFontInstrumentLoaderConfig = {
            presetPath: `${PRESET_PATH_INSTRUMENT}/${instrumentKeys[Math.round(Math.random() * instrumentKeys.length)]}.json`
        }

        const {renderedBuffer} = await renderSong(song, {
            custom: {webAudioFontInstrumentLoaderConfig}
        });
        console.log('renderedBuffer', renderedBuffer)
        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))
    })

    it('loads and plays percussion', async () => {
        const song = songwalker`
await loadPreset('WebAudioFontLoader', track.custom.webAudioFontInstrumentLoaderConfig);

for (let o = 0; o <= 4; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
D4 1 C4 1
`
        let percussionKeys = await fetchJSONFromMirror(PRESET_PATH_PERCUSSION_KEYS);
        const webAudioFontInstrumentLoaderConfig: WebAudioFontInstrumentLoaderConfig = {
            presetPath: `${PRESET_PATH_PERCUSSION}/${percussionKeys[Math.round(Math.random() * percussionKeys.length)]}.json`
        }

        const {renderedBuffer} = await renderSong(song, {
            custom: {webAudioFontInstrumentLoaderConfig}
        });
        console.log('renderedBuffer', renderedBuffer)
        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))

    })

    it('loads and plays drumset', async () => {
        const song = songwalker`
await loadPreset('WebAudioFontLoader', track.custom.webAudioFontInstrumentLoaderConfig);

for (let o = 0; o <= 4; o++) {
    for (let i = 0; i < 6; i++) {
        const note = String.fromCharCode(65 + i)
        execute(track, note + o, {duration: 1 / 9})
        1/8
    }
}
D4 1 C4 1
`
        let drumsetKeys = await fetchJSONFromMirror(PRESET_PATH_DRUMSET_KEYS);
        const webAudioFontInstrumentLoaderConfig: WebAudioFontInstrumentLoaderConfig = {
            presetPath: `${PRESET_PATH_DRUMSET}/${drumsetKeys[Math.round(Math.random() * drumsetKeys.length)]}.json`
        }

        const {renderedBuffer} = await renderSong(song, {
            custom: {webAudioFontInstrumentLoaderConfig}
        });
        console.log('renderedBuffer', renderedBuffer)
        await playSong(songwalker`loadPreset('AudioBuffer', {src: track.custom.src}); play`, () => ({custom: {src: renderedBuffer}}))

    })
})
