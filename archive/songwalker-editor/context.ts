import {createContext} from 'react';
import {IAppContext, IAppState} from './types';


export const EditorContext = createContext<IAppContext>({
    updateAppState(newState: IAppState): void {
        throw new Error("Unimplemented");
    },
    appState: {
        activeEditor: {
            cursorRange: {
                start: 0,
                end: 0,
                collapsed: true
            },
            value: 'C4',
            path: 'new.sw'
        }
    }
});
