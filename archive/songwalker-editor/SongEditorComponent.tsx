"use client"

import React, {useState} from 'react'

import styles from "./SongEditorComponent.module.scss"
import {ActiveEditors} from "@songwalker-editor/document/ActiveEditors";
import {EditorContext} from "@songwalker-editor/context";
import {IAppContext, IAppState} from "@songwalker-editor/types";

interface SongEditorComponentProps {
    initialValue: string,
    className: string
}

export default function SongEditorComponent(props: SongEditorComponentProps) {
    const {className, initialValue} = props;
    const [editorState, setEditorState] = useState<IAppState>({
        activeEditor: {
            cursorRange: {
                start: 10,
                end: 20,
                collapsed: false
            },
            path: 'new.sw',
            value: initialValue
        }
    });

    const editorContext: IAppContext = {
        appState: editorState,
        updateAppState: setEditorState
    }
    return (
        <EditorContext.Provider value={editorContext}>
            <div
                className={styles.container + (className ? ' ' + className : '')}
            >
                {/*<MenuPanel/>*/}
                <ActiveEditors/>
            </div>
        </EditorContext.Provider>)
}

