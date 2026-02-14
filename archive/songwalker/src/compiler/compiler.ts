import {OverrideAliases, SongCallback, SongWalkerState} from "../types";
import {formatCommandOverrides, parseWait} from "../helper/commandHelper";
import {Token, tokenize} from "prismjs";
import LANGUAGE from "../compiler/language";


function formatTokenContent(token: Token | string, currentTokenID = 0): string {
    if (typeof token === "string")
        return token;
    switch (token.type as keyof typeof LANGUAGE) {
        case 'swe-comment':
        case 'swe-func-def':
        case 'swe-loop':
        case 'swe-var':
            return token.content as string;
        case 'swe-func':
            return exportFunctionStatement(token.content as string);
        // case 'track-statement':
        //     return exportTrackStatement(token.content as string);
        case 'swe-track':
            return exportTrackDefinition(token.content as string);
        case 'swe-cmd':
            return exportCommandStatement(token.content as string);
        case 'swe-wait':
            return exportWaitStatement(parseWait(token.content as string));
        default:
            throw new Error(`Unknown token type '${token.content}': ${JSON.stringify(token)} at tokenID ${currentTokenID}`);
    }
}

export function sourceToTokens(source: string) {
    return tokenize(source, LANGUAGE);
}

export function compileSongToJavascript(
    songSource: string,
    template: (s: string) => string = exportSongTemplate
    // eventMode: boolean = false
) {
    const tokenList = sourceToTokens(songSource)
    const javascriptSource = tokenList
        .map((token, tokenID) => {
            if (typeof token === "string")
                return token;
            return `${formatTokenContent(token, tokenID)}`;
        })
        .join('');
    return template(javascriptSource)
}


export function compileSongToCallback(songSource: string) {
    const jsSource = compileSongToJavascript(songSource);
    console.info(jsSource)
    const callback: SongCallback = eval(jsSource);
    return callback;
}

export function songwalker(strings: TemplateStringsArray, ...values: string[]) {
    let result = '';
    strings.forEach((str, i) => {
        result += str + (values[i] ? values[i] : '');
    });
    return compileSongToCallback(result);
}


/** Compiler Exports **/
type KS = keyof SongWalkerState;
const ROOT_TRACK = 'rootTrack';
const VAR_TRACK_STATE = 'track';
const VAR_PARENT_TRACK_STATE = 'parentTrack';
// export const F_WAIT = "_w";
// export const F_LOAD = "_lp";
// export const F_EXECUTE = "_e";
export const F_EXPORT = `{${
    'wait' as KS
}, ${
    'execute' as KS
}, ${
    'executeCallback' as KS
}, ${
    'loadPreset' as KS
}, ${
    'rootTrackState' as KS
}:track}`;
export const OVERRIDE_ALIAS: OverrideAliases = {
    '@': 'duration',
    '^': 'velocity'
};
export const TRACK_OVERRIDE_ALIAS: OverrideAliases = {
    '@': 'trackDuration',
    '^': 'velocity'
};

export function exportSongTemplate(sourceCode: string) {
    return `(async function ${ROOT_TRACK}(${F_EXPORT}) {\n${sourceCode}})`;
}

export function exportCommandStatement(commandString: string) {
    const match = (commandString).match(LANGUAGE["swe-cmd"]);
    if (!match)
        throw new Error("Invalid command statement: " + commandString)
    const [, command, overrideString] = match;
    const exportOverrides = overrideString ? ', ' + formatCommandOverrides(overrideString, OVERRIDE_ALIAS) : ''
    return `${'execute' as KS}(${VAR_TRACK_STATE}, "${command}"${exportOverrides});`
}

// variable: (variableName: string, variableContent: string) => `${variableName}=${variableContent}`,
export function exportWaitStatement(durationStatement: string) {
    return `if(await ${'wait' as KS}(${VAR_TRACK_STATE}${durationStatement ? ', ' + durationStatement : ''})) return;`;
}

export function exportTrackDefinition(trackDefinition: string) {
    const match = (trackDefinition).match(LANGUAGE["swe-track"]);
    if (!match)
        throw new Error("Invalid track definition: " + trackDefinition)
    const [, trackName, trackArgs] = match;
    return `async function ${trackName}(${trackArgs}){`
        + `\n\tconst ${VAR_TRACK_STATE} = {...this.parent, ...this.overrides, ${'position' as KS}:0};`
}

// export function exportTrackStatement(trackStatement: string) {
//     const match = (trackStatement).match(LANGUAGE["track-statement"]);
//     if (!match)
//         throw new Error("Invalid track statement: " + trackStatement)
//     const [, trackName, overrideString, paramString] = match;
//     let exportOverrides = ', ' + formatCommandOverrides(overrideString, TRACK_OVERRIDE_ALIAS)
//     // const functionCall = trackName + `.bind(${VAR_TRACK_STATE}${paramString ? ', ' + paramString : ''})`
//     return `${'executeCallback' as KS}(${VAR_TRACK_STATE}, ${trackName}${exportOverrides}${paramString ? ', ' + paramString : ''});`
// }

const reservedFunctions: Array<keyof SongWalkerState> = [
    'loadPreset',
    "wait",
]

export function exportFunctionStatement(functionStatement: string) {
    const match = functionStatement.match(LANGUAGE["swe-func"]);
    if (!match)
        throw new Error("Invalid function statement: " + functionStatement)
    const [, variableSet = '', awaitString = '', functionName, overrideString, paramString] = match;
    if (reservedFunctions.includes(<keyof SongWalkerState>functionName))
        return functionStatement;
    let exportOverrides = formatCommandOverrides(overrideString, TRACK_OVERRIDE_ALIAS)
    // const functionCall = trackName + `.bind(${VAR_TRACK_STATE}${paramString ? ', ' + paramString : ''})`
    return `${variableSet}${awaitString}${'executeCallback' as KS}(${VAR_TRACK_STATE}, ${functionName}, ${exportOverrides}${paramString ? ', ' + paramString : ''});`

}
