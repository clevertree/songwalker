import {ISourceEditorCursorRange} from "@songwalker-editor/types";
import {Token} from "prismjs";

export function insertIntoSelection(insertString: string) {
    const selection: Selection | null = window.getSelection();
    if (!selection)
        throw new Error("Invalid window.getSelection()")
    const {focusNode, focusOffset} = selection;
    if (!focusNode)
        throw new Error("Invalid focusNode")

    const source = focusNode.nodeValue;
    if (source === null)
        throw new Error("focusNode.nodeValue === null")
    focusNode.nodeValue = source.substring(0, focusOffset) + insertString + source.substring(focusOffset);
    const range = document.createRange()

    range.setStart(focusNode, focusOffset + 1)
    range.collapse(true)

    const sel = window.getSelection()
    if (!sel)
        throw new Error("Invalid window.getSelection()")
    sel.removeAllRanges()
    sel.addRange(range)
}


export function isMac(navigator: Navigator) {
    return navigator.userAgent.includes('Mac');
}

export function mapTokensToDOM(tokenList: Array<string | Token>, container: HTMLElement) {
    let childNodes = container.childNodes;
    var newChildren = document.createDocumentFragment();
    for (let tokenID = 0; tokenID < tokenList.length; tokenID++) {
        const token = tokenList[tokenID];
        let node = childNodes[tokenID]
        if (typeof token === "string") {
            if (node && node.nodeType === 3) {
                node.textContent = token;
            } else {
                node = document.createTextNode(token);
            }
        } else {
            if (!node || node.nodeName.toLowerCase() !== token.type) {
                node = document.createElement(token.type);
            } else {
                // console.info("Reusing", oldNode);
            }
            if (Array.isArray(token.content)) {
                mapTokensToDOM(token.content, <HTMLElement>node)
            } else if (typeof token.content === "string") {
                (<HTMLElement>node).innerText = token.content;
            } else {
                throw 'invalid token.content';
            }
        }
        newChildren.appendChild(node)
    }

    container.replaceChildren(newChildren)
}

// export function mapTokensToDOM(tokenList: Array<string | Token>, container: HTMLElement, callback = (newNode: ChildNode, charOffset: number, length: number) => {
// }) {
//     let elmID = 0;
//     let childNodes = container.childNodes;
//     let charOffset = 0;
//     container.replaceChildren(...tokenList.map((token: (string | Token)) => {
//         const oldNode = childNodes[elmID++];
//         let newNode = oldNode;
//         let length = 0;
//         // console.log('token', token, oldNode);
//         if (typeof token === "string") {
//
//             if (oldNode && oldNode.nodeType === 3) {
//                 oldNode.textContent = token;
//                 // console.info("Reusing", oldNode);
//                 // return oldNode;
//             } else {
//                 newNode = document.createTextNode(token);
//             }
//             length = token.length;
//             // }
//         } else {
//             if (!newNode || newNode.nodeName.toLowerCase() !== token.type) {
//                 newNode = document.createElement(token.type);
//             } else {
//                 // console.info("Reusing", oldNode);
//             }
//             if (Array.isArray(token.content)) {
//                 length = mapTokensToDOM(token.content, <HTMLElement>newNode)
//             } else if (typeof token.content === "string") {
//                 (<HTMLElement>newNode).innerText = token.content;
//                 length = token.content.length;
//             } else {
//                 throw 'invalid token.content';
//             }
//         }
//         charOffset += length;
//         callback(newNode, charOffset, length);
//         return newNode
//     }));
//     return charOffset
// }
export function setCursorPosition(contentEditable: HTMLElement, cursorRange: ISourceEditorCursorRange) {
    const {start, end, collapsed} = cursorRange;
    const range = createRange();
    const selection = window.getSelection();
    if (!selection)
        throw 'window.getSelection() is null. Iframe?';
    selection.removeAllRanges();
    selection.addRange(range);
    if (collapsed)
        range.collapse(true);


    function createRange() {
        let range = document.createRange();
        range.selectNode(contentEditable);
        range.setStart(contentEditable, 0);

        let pos = 0;
        const stack = [contentEditable];
        let current;
        let startFound = false;
        while (current = stack.pop()) {
            if (current.nodeType === Node.TEXT_NODE) {
                if (!current.textContent)
                    throw 'text node has no textContent';
                const len = current.textContent.length;
                if (!startFound && pos + len >= start) {
                    startFound = true;
                    range.setStart(current, start - pos);
                }
                if (pos + len >= end) {
                    range.setEnd(current, end - pos);
                    return range;
                }
                pos += len;
            } else if (current.childNodes && current.childNodes.length > 0) {
                for (let i = current.childNodes.length - 1; i >= 0; i--) {
                    stack.push(<HTMLElement>current.childNodes[i]);
                }
            }
        }

        console.error("The target position is greater than the length of the contenteditable element.")
        range.setEnd(contentEditable, contentEditable.childNodes.length);
        return range;
    }

}
