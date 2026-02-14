import {formatCommandOverrides, parseNote} from "../commandHelper";
import {OVERRIDE_ALIAS} from "../../compiler/compiler";

describe('noteHelper', () => {
    it('formatCommandOverrides v0.5d1/2', async () => {
        const overrides = formatCommandOverrides('^0.5@1/2', OVERRIDE_ALIAS);
        expect(overrides).to.eq('{velocity:0.5, duration:1/2}')
    })
    it('parseNote C#q4', async () => {
        const noteInfo = parseNote("C#q4", 432)
        expect(noteInfo).to.deep.eq({
            "note": "C#q",
            "octave": 4,
            "frequency": 280.1173438046181,
        })
    })
})
