import * as monaco from "monaco-editor";

export type ModeName = 'Normal' | 'Visual' | 'VisualLine' | 'Insert';

/**
 * central input handler for vim mode
 */
export interface IDispatcher {
    /**
     * target editor
     */
    readonly editor: monaco.editor.ICodeEditor;
    /**
     * detach from editor and clean up. Will be called when the editor has been disposed
     */
    dispose(): void;
    /**
     * get current mode
     */
    getMode(): ModeName;
    /**
     * get current mode label string, e.g. 'Visual Line'
     */
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
    onRequestExternalInput?(sender: IDispatcher, prefix: string, textChangedCallback: (text: string) => void): Promise<string | null>;
}


export interface IMapper {
    addString(from: string, to: string): void;

    addUserAction(keys: string, action: (editor: monaco.editor.ICodeEditor) => void | PromiseLike<void>): void;

    addEditorAction(keys: string, actionId: string): void;

    clear(): void;
}

export interface IConfiguration {
    startInInsertMode: boolean;
    ignoreCase: boolean;
    smartCase: boolean;
    readonly nmap: IMapper;
    readonly vmap: IMapper;
}

/**
 * initialize a new instance
 */
export function init(editor: monaco.editor.ICodeEditor, eventSink?: IEventSink): IDispatcher;

/**
 * get the attached dispatcher of target editor
 */
export function get(editor: monaco.editor.ICodeEditor): IDispatcher | undefined;

/**
 * dispose all instances
 */
export function disposeAll(): void;

export const configuration: IConfiguration;
