import React from "react";
import styles from "./MenuPanel.module.scss";
import {EditorState} from "../types";

function MenuPanel({}) {
    const dispatch = useDispatch();

    const isPlaying = useSelector((state: EditorState) => state.document.isPlaying);
    const hasError = useSelector((state: EditorState) => state.document.errors);

    return (
        <div className={styles.menuPanel}>
            <button disabled={isPlaying} className={hasError ? styles.buttonError : ''}
                    onClick={() => dispatch(startPlayback())}>Play
            </button>
            <button disabled={!isPlaying} onClick={() => dispatch(stopPlayback())}>Stop</button>
        </div>
    )
}

export default MenuPanel
