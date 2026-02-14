export interface IAppContext {
    appState: IAppState,

    updateAppState(newState: IAppState | ((oldState: IAppState) => IAppState)): void
}

export interface IAppState {
    // menu: MenuState,
    activeEditor: ISourceEditorState,
}


export interface ISourceEditorCursorRange {
    start: number,
    end: number,
    collapsed: boolean
}

export interface ISourceEditorState {
    path: string,
    value: string,
    cursorRange: ISourceEditorCursorRange,
    // isPlaying: boolean,
    // errors: Array<string>,
}
