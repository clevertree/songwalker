import {
    compileSongToCallback,
    compileSongToJavascript,
    exportCommandStatement,
    exportTrackDefinition,
    exportWaitStatement,
    sourceToTokens
} from '../compiler'

import {renderSong} from "@songwalker";

describe('compiler', () => {
    const emptyTemplate = (s: string) => s;
    it('play statement - C5@3/8^.2;', () => {
        const SONG_SOURCE = `C5@3/8^.2`
        const compiledSource = sourceToTokens(SONG_SOURCE);
        expect(JSON.stringify(compiledSource)).to.deep.eq(JSON.stringify(
            [{"type": "command-statement", "content": "C5@3/8^.2", "length": 9}]
        ))
        const javascriptContent = compileSongToJavascript(SONG_SOURCE, emptyTemplate);
        expect(javascriptContent).to.eq(exportCommandStatement('C5@3/8^.2'))
    })

    it('wait statement - 1/6; /5', () => {
        const SONG_SOURCE = `1/6; /5`
        const compiledSource = sourceToTokens(SONG_SOURCE);
        expect(JSON.stringify(compiledSource)).to.deep.eq(JSON.stringify(
            [
                {"type": "wait-statement", "content": "1/6", "length": 3},
                "; ",
                {"type": "wait-statement", "content": "/5", "length": 2}
            ]))
        const javascriptContent = compileSongToJavascript(SONG_SOURCE, emptyTemplate);
        expect(javascriptContent).to.eq(exportWaitStatement(`1/6`) + '; ' + exportWaitStatement(`1/5`))
    })

    it('set track variable', () => {
        const SONG_SOURCE = `track.someVar = 'wutValue';track.someVar=1/7;track.someVar = track.otherVar;`
        const compiledSource = sourceToTokens(SONG_SOURCE);
        expect(JSON.stringify(compiledSource)).to.deep.eq(JSON.stringify(
            [{
                "type": "variable-statement",
                "content": ["track.someVar = 'wutValue';"],
                "length": 27
            }, {
                "type": "variable-statement",
                "content": ["track.someVar=1/7;"],
                "length": 18
            }, {"type": "variable-statement", "content": ["track.someVar = track.otherVar;"], "length": 31}]
        ))
        const javascriptContent = compileSongToJavascript(SONG_SOURCE, emptyTemplate);
        expect(javascriptContent).to.eq("track.someVar = 'wutValue';track.someVar=1/7;track.someVar = track.otherVar;")
    })

    it('set const variable', () => {
        const SONG_SOURCE = `const someVar = wutVar;let otherVar=1/7;`
        const compiledSource = sourceToTokens(SONG_SOURCE);
        expect(JSON.stringify(compiledSource)).to.deep.eq(JSON.stringify(
            [{
                "type": "variable-statement",
                "content": ["const someVar = wutVar;"],
                "length": 23
            }, {"type": "variable-statement", "content": ["let otherVar=1/7;"], "length": 17}]
        ))
        const javascriptContent = compileSongToJavascript(SONG_SOURCE, emptyTemplate);
        expect(javascriptContent).to.eq("const someVar = wutVar;let otherVar=1/7;")
    })


    it('track declaration', () => {
        const SONG_SOURCE = `track myTrack(myTrackArg) { C4^2 D4@2 }`
        const compiledSource = sourceToTokens(SONG_SOURCE);
        expect(JSON.stringify(compiledSource)).to.deep.eq(JSON.stringify(
            [
                {"type": "track-definition", "content": "track myTrack(myTrackArg) {", "length": 27},
                " ",
                {"type": "command-statement", "content": "C4^2", "length": 4},
                " ",
                {"type": "command-statement", "content": "D4@2", "length": 4}, " }"]))
        const javascriptContent = compileSongToJavascript(SONG_SOURCE, emptyTemplate);
        expect(javascriptContent).to.eq(
            exportTrackDefinition("track myTrack(myTrackArg) {")
            + ` ${exportCommandStatement('C4^2')} ${exportCommandStatement('D4@2')} }`)

    })

    // it('track statement', () => {
    //     const SONG_SOURCE = `|track1^2@3`
    //     const compiledSource = sourceToTokens(SONG_SOURCE);
    //     expect(JSON.stringify(compiledSource)).to.deep.eq(JSON.stringify(
    //         [{"type": "track-statement", "content": "|track1^2@3", "length": 11}]
    //     ))
    //     const javascriptContent = compileSongToJavascript(SONG_SOURCE, emptyTemplate);
    //     expect(javascriptContent).to.eq(
    //         exportTrackStatement("|track1^2@3"))
    //
    // })

    it('function', () => {
        const SONG_SOURCE = `testFunction('arg');`
        const compiledSource = sourceToTokens(SONG_SOURCE);
        expect(JSON.stringify(compiledSource)).to.eq(JSON.stringify(
            [
                {"type": "function-statement", "content": "testFunction('arg')", "length": 19},
                ';'
            ]))
    })

    it('compiles to callback', () => {
        cy.fixture('test.song').then((SONG_SOURCE) => {
            const callback = compileSongToCallback(SONG_SOURCE);
            console.log('callback', callback);
        })
    })


    it('renders song', () => {
        cy.fixture('test.song').then((SONG_SOURCE) => {
            const song = compileSongToCallback(SONG_SOURCE);
            cy.wrap((async () => {
                await renderSong(song);
            })()).then(() => {
            });
        })
    })

    // it('compiles to javascript in event mode', () => {
    //     cy.fixture('test.song').then((SONG_SOURCE) => {
    //         cy.fixture('test.song.compiled').then((SONG_SOURCE_COMPILED) => {
    //             const {javascriptContent, tokens, trackTokenList} = compileSongToJavascript(SONG_SOURCE, {
    //                 // eventMode: true,
    //             });
    //             cy.log('javascriptContent', javascriptContent)
    //         })
    //     })
    // })
})


