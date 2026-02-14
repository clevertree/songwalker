import {SongWalkerState, TrackState} from "./types";

import {renderSong} from "./helper/renderHelper";

describe('songPlayer', () => {
    it('plays sub-tracks', async () => {
        // const logCallback = cy.stub();
        const instrumentCallback = cy.stub();
        const {songState, renderedBuffer} = await renderSong(testSong, {
            instrument: instrumentCallback
        });
        // const songState = getDefaultTrackState(destination);
        // await testSong(songState, instrumentCallback)
        // await DefaultSongFunctions.waitForTrackToFinish(songState);
        // await songInstance.waitForSongToFinish();
        console.log('songState', songState)
        expect(instrumentCallback.callCount).to.eq(32)
        expect(songState.rootTrackState.position).to.eq(4)
        // expect(songState.currentTime).to.greaterThan(2.25)
    })

    // it('plays percussion track', async () => {
    //     const songState = getDefaultTrackState(destination);
    //     const trackState = await testTrackPercussion(songState)
    //     expect(trackState.position).to.eq(8)
    //     // expect(trackState.currentTime).to.greaterThan(2)
    // })
    //
    // it('playing a song without an instrument throws an error ', async () => {
    //     try {
    //         const songState = getDefaultTrackState(destination)
    //         await testTrackNoInstrument(songState)
    //         throw new Error("Track finished without error")
    //     } catch (e) {
    //         // @ts-ignore
    //         expect(e.message).to.eq(ERRORS.ERR_NO_INSTRUMENT)
    //     }
    // })
})


async function testSong(songState: SongWalkerState) {
    const {wait, rootTrackState: track, execute, executeCallback} = songState;
    // track.instrument = await testMelodicInstrument(track, instrumentCallback)

    track.beatsPerMinute = 160;
    executeCallback(track, testTrack)
    executeCallback(track, testTrack2)

    await wait(track, 2);

    track.beatsPerMinute = 80;
    executeCallback(track, testTrack)
    executeCallback(track, testTrackLoadLate)

    await wait(track, 2);

// async function testSongNoInstrument(track: TrackState) {
//     trackRenderer.startTrack(testTrack)
// }

    async function testTrack2(track: TrackState) {
        track.duration = 1 / 4;
        execute(track, 'C5')
        // playCommand( 'config', {});
        // track.config = {} // no need for config objectrack
        await wait(track, 1 / 4);
        track.currentTime = 1
        track.velocity = 3
        track.duration = 1 / 6;
        execute(track, 'C4');
        await wait(track, 1 / 4);
        execute(track, 'G4');
        await wait(track, 1 / 4);
        execute(track, 'Eb4');
        await wait(track, 1 / 4);
        execute(track, 'Eb5');
        await wait(track, 1 / 4);
        execute(track, 'F5');
        await wait(track, 1 / 4);
        execute(track, 'Eb5');
        await wait(track, 1 / 4);
        execute(track, 'D5');
        await wait(track, 1 / 4);
        return track;
    }

    async function testTrack(track: TrackState) {
        execute(track, "C5", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "C4", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "G4", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "Eb4", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "Eb5", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "F5", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "Eb5", {duration: 1 / 4});
        await wait(track, 1 / 4);
        execute(track, "D5", {duration: 1 / 4});
        await wait(track, 1 / 4);
        // n(track, "C5", {duration: 1 / 4});
        return track;
    }


    async function testTrackLoadLate(track: TrackState) {
        // track.instrument = await testPercussionInstrument(songState, cy.stub())
        track.beatsPerMinute = 240;
        execute(track, "kick");
        execute(track, "hat");
        await wait(track, 1);
        execute(track, "hat");
        await wait(track, 1);
        execute(track, "snare");
        execute(track, "hat");
        await wait(track, 1);
        execute(track, "hat");
        await wait(track, 1);
        execute(track, "kick");
        await wait(track, 1);
        execute(track, "snare");
        return track;
    }
}

/** Instruments **/


// const testMelodicInstrument: InstrumentLoader = (song, callback: (...args: any[]) => void) => {
//     return function (track, command) {
//         const {commandString} = command;
//         const noteInfo = parseNote(commandString);
//         if (!noteInfo)
//             throw new Error("Unrecognized note: " + commandString);
//         const {frequency, octave, note} = noteInfo;
//         callback(commandString, frequency);
//         // console.log("testMelodicInstrument", track, command)
//         return {
//             addEventListener: cy.stub(),
//             stop: cy.stub(),
//             frequency,
//             octave,
//             note
//         }
//     }
// }

// const testPercussionInstrument: InstrumentLoader = (track, callback: (...args: any[]) => void) => {
//     return function (track, command) {
//         callback({...track, ...command});
//         const {commandString} = command;
//         console.log("testPercussionInstrument", track, command)
//         if (!['kick', 'hat', 'snare'].includes(commandString))
//             throw new Error("Unrecognized percussive instrument: " + commandString)
//         return {
//             addEventListener: callback,
//             stop: callback,
//         }
//     }
// }
