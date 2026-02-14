import {ISourceEditorCursorRange} from "@songwalker-editor/types";
import {sourceToTokens} from "@songwalker";
import {mapTokensToDOM, setCursorPosition} from "@songwalker-editor/helper/domHelper";

export function renderSourceEditor(editor: HTMLElement, sourceValue: string, cursorRange: ISourceEditorCursorRange) {
    const tokenList = sourceToTokens(sourceValue);
    // const caretOffset = getCaretOffset(editor);
    // console.log('render', tokenList, cursorPosition)

    mapTokensToDOM(tokenList, editor);

    setCursorPosition(editor, cursorRange);

    const renderedValue = renderValue(editor);
    if (renderedValue !== sourceValue)
        console.error(`Rendering value mismatch: \n`, renderedValue, ` !== \n`, sourceValue);
}

export function renderValue(editor: HTMLElement) {
    return editor.innerText;
    // return Array.prototype.map.call(editor.childNodes,
    //     child => child.innerText || child.textContent).join('');
}

export function getSelectionRange(editor: HTMLElement): ISourceEditorCursorRange {
    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0)
        throw new Error("Invalid window.getSelection()")
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    // preCaretRange.selectNodeContents(editor);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const end = preCaretRange.toString().length;
    return {
        start,
        end,
        collapsed: range.collapsed
    };
}

