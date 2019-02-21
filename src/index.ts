import { Dispatcher } from "./Dispatcher";
import { IEventSink } from "./types";
import * as monaco from "monaco-editor";

export { configuration } from "./configuration";
export { IEventSink };

export interface IDispatcher {
    readonly editor: monaco.editor.ICodeEditor;
    dispose(): void;
    getMode(): 'Normal' | 'Visual' | 'VisualLine' | 'Insert';
    getModeDisplayName(): string;
}

export function init(editor: monaco.editor.ICodeEditor, eventSink?: IEventSink): IDispatcher {
    return Dispatcher.create(editor, eventSink);
}

export function get(editor: monaco.editor.ICodeEditor): IDispatcher | undefined {
    return Dispatcher.getInstance(editor.getId());
}

export function disposeAll() {
    Dispatcher.disposeAllInstances();
}
