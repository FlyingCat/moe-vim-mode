import * as monaco from "monaco-editor";

export type ModeName = 'Normal' | 'Insert' | 'Visual' | 'VisualLine';

export interface ISearchPattern {
    readonly searchString: string;
    readonly isRegex: boolean;
    readonly wholeWord: boolean;
    readonly matchCase: boolean;
}

export interface IDispatcher {
    readonly editor: monaco.editor.ICodeEditor;
    dispose(): void;
    getMode(): ModeName;
    getModeDisplayName(): string;
}

export interface IEventSink {
    onKeyBufferChanged?(sender: IDispatcher, keys: string): void;
    onKeyWaiting?(sender: IDispatcher, keys: string): void;
    onKeyMatched?(sender: IDispatcher, keys: string): void;
    onKeyFailed?(sender: IDispatcher, keys: string): void;
    onKeyCanceled?(sender: IDispatcher, keys: string): void;
    onCommandBeep?(sender: IDispatcher): void;
    onCommandOuput?(sender: IDispatcher, type: 'info' | 'error', message: string): void;
    onModeChanged?(sender: IDispatcher, mode: ModeName, displayName: string): void;
    onRequestExternalInput?(sender: IDispatcher, prefix: string, text: string, textChangedCallback: (text: string) => void): Promise<string | null>;
}

export interface IMapper {
    addString(from: string, to: string): void;

    addUserAction(keys: string, action: (editor: monaco.editor.ICodeEditor) => void | PromiseLike<void>): void;

    addEditorAction(keys: string, actionId: string): void;

    clear(): void;
}

export interface IConfiguration {
    startInInsertMode: boolean;
    enterInsertModeIfSelectOutsideVim: boolean;
    ignoreCase: boolean;
    smartCase: boolean;
    incrementalSearch: boolean;
    highlightSearch: boolean;
    nmap: IMapper;
    vmap: IMapper;
}
