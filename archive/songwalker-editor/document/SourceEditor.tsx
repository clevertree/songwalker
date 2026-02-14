"use client"

import React, {useContext, useEffect, useMemo, useRef} from 'react'
import {IAppContext, ISourceEditorState} from "../types";
import styles from "./SourceEditor.module.scss"
import {getSelectionRange, renderSourceEditor} from "@songwalker-editor/helper/sourceHelper";
import Undo from "undoh";
import {EditorContext} from "@songwalker-editor/context";
import {insertIntoSelection, isMac} from "@songwalker-editor/helper/domHelper";
import {compileSongToCallback} from "@songwalker/compiler/compiler";
import {playSong} from "@songwalker";


const TIMEOUT_SAVE_ON_CHANGE_EVENT = 500
let saveTimeout: any = null;

export default function SourceEditor(state: ISourceEditorState) {
    const {path, value, cursorRange} = state;
    const {updateAppState} = useContext<IAppContext>(EditorContext)
    const undoBuffer = useMemo(() => new Undo<ISourceEditorState>(state), []);
    // const errors = useSelector((state: EditorState) => state.document.errors);
    // const updateTimeout = useRef(-1); // we can save timer in useRef and pass it to child
    // const playbackManager = useContext(PlaybackContext)
    const refEditor = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const editor = getEditor();
        editor.focus()
        renderSourceEditor(editor, value, cursorRange)
    });

    function getEditor() {
        const divEditor = refEditor.current;
        if (!divEditor)
            throw new Error("Editor ref is unavailable");
        return divEditor;
    }

    function handleChangeEvent(e: any) {
        clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
            const editor = getEditor();
            const newState = updateState({
                value: editor.innerText,
                path,
                cursorRange: getSelectionRange(editor)
            });
            undoBuffer.retain(newState)
        }, TIMEOUT_SAVE_ON_CHANGE_EVENT) as any
    }


    function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        switch (e.code) {
            case 'Tab':
                return;
            case 'Enter':
                e.preventDefault();
                insertIntoSelection("\n")
                handleChangeEvent(e);
                console.log(e);
                return;
            // case 'Tab': // TODO group shift?
            //     e.preventDefault();
            //     insertIntoOffset("\t")
            //     return;
            case 'KeyZ':
                if (e[isMac(navigator) ? 'metaKey' : 'ctrlKey']) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        const redoValue = undoBuffer.redo();
                        console.log('redoValue', redoValue)
                        updateState(redoValue)
                    } else {
                        const undoValue = undoBuffer.undo();
                        console.log('undoValue', undoValue)
                        updateState(undoValue)
                    }
                }
                return;
            default:
                // const range = getSelectionRange(getEditor());
                // shadowValue = insertAtRange(e.key, shadowValue, range)
                console.log(e)
                break;
        }
    }

    function updateState(newState: ISourceEditorState) {
        updateAppState((prevState) => {
            if (newState)
                prevState.activeEditor = newState;
            return {...prevState};
        })
        return newState;
    }

    async function startPlayback(e: any) {
        const callback = compileSongToCallback(value);
        console.log('callback', callback)
        await playSong(callback)
    }

    return (
        <div className={styles.container}>
            <div className={styles.title}>[{path}]</div>
            <button
                onClick={startPlayback}
            >play
            </button>
            <div
                key={path}
                className={styles.editor}
                ref={refEditor}
                contentEditable={'plaintext-only'}
                spellCheck={false}
                onKeyDown={onKeyDown}
                // onKeyUp={handleKeyEvent}
                onInput={handleChangeEvent}
            />
            {/*{errorMessages.map(message => <div key={message} className={styles.errorMessage}>{message}</div>)}*/}
        </div>
    )
}
