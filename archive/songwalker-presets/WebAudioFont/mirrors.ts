export const URL_MIRRORS = [
    'https://webaudiofontdata.clevertree.net',
    'https://clevertree.github.io/webaudiofontdata'
];

export function* iterateMirrorsRandom() {
    const mirrors = [...URL_MIRRORS];
    for (let i = mirrors.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mirrors[i], mirrors[j]] = [mirrors[j], mirrors[i]];
    }
    for (const mirror of mirrors)
        yield mirror;
}

export function* iterateMirrors() {
    for (const mirror of URL_MIRRORS)
        yield mirror;
}

export async function fetchJSONFromMirror(jsonPath: string, random: boolean = true) {
    const iterator = random ? iterateMirrorsRandom() : iterateMirrors();
    for (const mirrorURL of iterator) {
        const fetchURL = mirrorURL + jsonPath;
        try {
            const request = await fetch(fetchURL, {signal: AbortSignal.timeout(5000)});
            return await request.json();
        } catch (e) {
            console.error("Unable to fetch: " + fetchURL);
        }
    }
    throw new Error("Unable to fetch json config from any url mirror");
}
