'use client'

import SongEditorComponent from "@songwalker-editor/SongEditorComponent";
import {useEffect, useState} from "react";

export default function Home() {
    const [songSource, setSongSource] = useState('');
    useEffect(() => {
        fetch(`/song/test.sw`)
            .then(res => res.text())
            .then(setSongSource);
    }, []);
    console.log('songSource', songSource)
    if (!songSource)
        return "Loading..."

    return (
        <>
            <header className="App-header">
            </header>
            <main className="flex flex-col items-center">
                <SongEditorComponent className="absolute left-0 right-0 top-0 bottom-0" initialValue={songSource}/>
            </main>
        </>
    )
}
