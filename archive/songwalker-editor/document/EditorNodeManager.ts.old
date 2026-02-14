import React, {RefObject} from "react";
import Undo from "undoh";
import {ConfigObject} from "../config/configActions";
import {sourceToTokens} from "@songwalker/tokens";
import {insertIntoSelection, mapTokensToDOM, walkDOM} from "@songwalker-editor/domUtils";
import {EditorState} from "./DocumentEditor";
import {SongTrackEvent} from "@songwalker/types";
import {addMIDIEventListener, removeMIDIEventListener} from "@songwalker-editor/midi/MIDIInterface";

export class EditorNodeManager {
    private readonly ref: RefObject<HTMLElement>;
    private readonly undoBuffer: Undo<EditorState>;
    private saveTimeout: NodeJS.Timeout | undefined;
    private undoTimeout: NodeJS.Timeout | undefined;
    private lastCursorPosition: number;
    private trackName: string;
    private lastCursorNode: HTMLElement | undefined;
    private midiEventListener: ((ev: MIDIMessageEvent) => any) | undefined;

    constructor(editorRef: RefObject<HTMLElement>, trackName: string, initialValue: EditorState) {
        this.ref = editorRef;
        this.trackName = trackName;
        this.undoBuffer = new Undo<EditorState>(initialValue);
        this.lastCursorPosition = 0;

    }

    getLastCursorPosition() {
        return this.lastCursorPosition
    }

    unload() {
        clearTimeout(this.saveTimeout);
        clearTimeout(this.undoTimeout);
    }

    retainEditorState(
        cursorPosition = this.lastCursorPosition,
        value = this.getValue()
    ) {
        this.undoBuffer.retain({value, cursorPosition})
        // console.log('this.undoBuffer', this.undoBuffer)
    }

    startRetainTimeout(editorRetainTimeout: number) {
        clearTimeout(this.saveTimeout)
        this.saveTimeout = setTimeout(() => this.retainEditorState(), editorRetainTimeout)
    }

    getNode() {
        if (!this.ref || !this.ref.current)
            throw new Error("Ref is not available yet");
        return this.ref.current;
    }

    getValue() {
        // console.log('getValue', value, value === this.getNode().innerText);
        return Array.prototype.map.call(this.getNode().childNodes, child => child.innerText || child.textContent).join('');
    }

    render(trackValueString: string) {
        const tokenList = sourceToTokens(trackValueString);
        // console.log('render', trackValueString, tokenList)
        mapTokensToDOM(tokenList, this.getNode())
        if (this.getValue() !== trackValueString)
            console.error(`Rendering value mismatch: \n`, JSON.stringify(this.getValue()), ` !== \n`, JSON.stringify(trackValueString));
    }


    refreshNode() {
        const editorValue = this.getValue();
        const cursorPosition = this.getCursorPosition();
        this.render(editorValue);
        this.setCursorPosition(cursorPosition);
        // clearTimeout(saveTimeout)
        // saveTimeout = setTimeout(updateEditorState, config.editorUpdateTimeout)
    }

    getCursorPosition(): number {
        const selection: Selection | null = window.getSelection();
        if (!selection)
            throw new Error("Invalid selection")
        const {focusNode, focusOffset} = selection;
        let editorPosition = -1;
        const editorNode = this.getNode()
        if (editorNode === focusNode)
            return this.lastCursorPosition;
        if (!focusNode || !editorNode.contains(focusNode))
            throw new Error("Focus node not in editor")

        const result = walkDOM(editorNode, (childNode, offset) => {
            if (childNode === focusNode) {
                editorPosition = offset + focusOffset
                return true;
            }
        })
        if (!result)
            // @ts-ignore
            throw new Error("focusNode not found in editor: " + (focusNode.outerHTML || focusNode));


        this.lastCursorPosition = editorPosition;
        return editorPosition;
    }

    getFocusNode() {
        const selection: Selection | null = window.getSelection();
        if (!selection)
            throw new Error("Invalid selection")
        const {focusNode} = selection;
        const editorNode = this.getNode();
        if (!focusNode || !editorNode.contains(focusNode))
            throw new Error("Focus node not in editor")
        return findEditorNode(focusNode, editorNode);
    }

    setCursorNode(cursorNode: HTMLElement) {
        if (this.lastCursorNode)
            this.lastCursorNode.removeAttribute('cursor')
        if (cursorNode.nodeType === Node.TEXT_NODE) {
            this.lastCursorNode = undefined;
        } else {
            this.lastCursorNode = cursorNode;
            cursorNode.setAttribute('cursor', '')
        }
    }

    setCursorPosition(cursorPosition: number) {
        if (cursorPosition < 0 || isNaN(cursorPosition))
            throw new Error("Invalid editor position: " + cursorPosition)


        let editorNode = this.getNode();
        const result = walkDOM(editorNode, (childNode, offset) => {
            if (childNode.nodeType !== Node.TEXT_NODE)
                return false;
            if (childNode.nodeValue === null)
                throw new Error('childNode.nodeValue === null')
            const newOffset = offset + childNode.nodeValue.length;
            if (newOffset >= cursorPosition) {
                const focusOffset = cursorPosition - offset;
                const range = document.createRange()

                range.setStart(childNode, focusOffset)
                // range.collapse(true)

                const sel = window.getSelection()
                if (!sel)
                    throw new Error("Invalid window.getSelection()");
                sel.removeAllRanges()
                sel.addRange(range)
                // console.log('setEditorPosition', cursorPosition, focusOffset, childNode, sel, range);
                // console.log('setEditorPosition', offset, editorPosition, childNode, focusOffset);
                // this.setCursorNode(findEditorNode(childNode, editorNode))
                return true;
            }
        })
        if (!result)
            console.error("Reached end of editor. Position not found: " + cursorPosition)

    }

    async handleSongEvent(trackEvent: SongTrackEvent, tokenID: number) {
        const tokenIDElm = this.getNode().childNodes[tokenID] as HTMLElement
        // console.log('handleSongEvent', trackEvent, tokenID)
        await trackEvent.waitForEventStart()
        tokenIDElm.setAttribute('active', '')
        await trackEvent.waitForEventEnd()
        tokenIDElm.removeAttribute('active')
        // if (startTime > 0) {
    }

    handleInputEvent(noteEvent: React.SyntheticEvent<HTMLDivElement>, config: ConfigObject) {
        switch (noteEvent.type) {
            default:
                console.log(noteEvent.type, noteEvent);
                break;
            case 'click':
                console.log(noteEvent.type, noteEvent);
                let cursorNode = findEditorNode(noteEvent.target as Node, this.getNode());
                if (cursorNode)
                    this.setCursorNode(cursorNode);
                break;
            case 'focus':
                this.midiEventListener = (e: MIDIMessageEvent) => console.log("MIDI", e.data, e.timeStamp, this.trackName);
                addMIDIEventListener(this.midiEventListener)
                break;
            case 'blur':
                if (this.midiEventListener)
                    removeMIDIEventListener(this.midiEventListener)
                break;

            // this.setCursorPosition(this.lastCursorPosition)
            // break;
            case 'input':
                this.refreshNode()
                break;
            case 'keyup':
                this.getCursorPosition();
                const focusNode = this.getFocusNode();
                if (focusNode)
                    this.setCursorNode(focusNode)
                this.startRetainTimeout(config.editorRetainTimeout);
                break;
            case 'keydown':
                let ke = noteEvent as React.KeyboardEvent<HTMLDivElement>
                switch (ke.code) {
                    case 'Enter':
                        ke.preventDefault();
                        insertIntoSelection("\n")
                        return;
                    // case 'Tab': // TODO group shift?
                    //     e.preventDefault();
                    //     insertIntoOffset("\t")
                    //     return;
                    case 'KeyZ':
                        if (ke.ctrlKey) {
                            ke.preventDefault();
                            if (ke.shiftKey) {
                                const redoValue = this.undoBuffer.redo();
                                console.log('redoValue', redoValue)
                                this.render(redoValue.value);
                                this.setCursorPosition(redoValue.cursorPosition)
                            } else {
                                const undoValue = this.undoBuffer.undo();
                                console.log('undoValue', undoValue)
                                this.render(undoValue.value);
                                this.setCursorPosition(undoValue.cursorPosition)
                            }
                        }
                        return;
                    // case 'ControlLeft':
                    //     e.preventDefault();
                    //     setEditorPosition(getEditorPosition() - 1);
                    //     console.log(e.code)
                    //     break;
                    default:
                        // console.log(e.key)
                        break;
                }
                break;
        }
    }
}

function findEditorNode(childNode: Node, editorNode: HTMLElement) {
    while (childNode.parentNode !== editorNode) {
        if (!childNode.parentNode)
            return null;
        childNode = childNode.parentNode as Node;
    }
    return childNode as HTMLElement;
}
