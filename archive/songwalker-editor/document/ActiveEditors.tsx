import React, {useContext} from "react";
import {IAppContext} from "@songwalker-editor/types";
import SourceEditor from "@songwalker-editor/document/SourceEditor";
import {EditorContext} from "@songwalker-editor/context";

export function ActiveEditors() {
    const {appState} = useContext<IAppContext>(EditorContext)

    return <SourceEditor {...appState.activeEditor}/>
}
