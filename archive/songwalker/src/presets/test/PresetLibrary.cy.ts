import {findPreset} from "../../helper/songHelper";

describe('WebAudioFontLibrary', () => {
    it('load presets', async () => {
        let preset = await findPreset(/^JCLive/i)
        expect(preset.title).to.include('JCLive');
        preset = await findPreset(/Grand Piano$/i)
        expect(preset.title).to.include('Grand Piano');
        preset = await findPreset(/Stratocaster.*Guitar/i)
        expect(preset.title).to.include('Stratocaster');
    })
})
