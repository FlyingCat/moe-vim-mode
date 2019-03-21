import { ModeName, ISearchPattern, IEventSink } from "./types";
import { Mode } from "./modes/Mode";
import { NormalMode } from "./modes/NormalMode";
import { InsertMode, RepeatableKind } from "./modes/InsertMode";
import { VisualMode } from "./modes/VisualMode";
import { VisualLineMode } from "./modes/VisualLineMode";
import { KeyCode } from "./utils/KeyCode";
import * as keyUtils from "./utils/key";
import { TextPositionFactory } from "./text/position";
import { configuration } from "./configuration";
import { ICommandContext, ICommand, ICommandArgs } from "./command";
import * as monaco from "monaco-editor";
import { ExternalInputWidget } from "./utils/externalInput";
import { executeExCommand } from "./exCommand";

export class GlobalState {
    lastCharMotion?: {
        kind: 'f' | 'F' | 't' | 'T';
        char: string;
    };

    lastSearch?: {
        direction: 'forward' | 'backward';
        pattern: ISearchPattern;
    }
}

type HistoryPatch = {
    beforeCursor?: monaco.Position;
    beforeVersionId: number;
    afterCursor?: monaco.Position;
    afterVersionId: number;
}

const globalState = new GlobalState();

class CommandContext implements ICommandContext {
    readonly editor: monaco.editor.ICodeEditor;
    readonly position: TextPositionFactory;

    constructor(readonly vimState: Dispatcher) {
        this.editor = vimState.editor;
        this.position = new TextPositionFactory(this.editor);
    }

    get model() {
        let model = this.editor.getModel();
        if (!model) {
            throw new Error('ICodeEditor.getModel() returns null.');
        }
        return model;
    }

    get globalState() {
        return globalState;
    }
}

export class Dispatcher {
    //#region vim state
    public desiredColumn: number | 'eol' = 1;
    public previousVisual?: {
        kind: 'char';
        start: monaco.IPosition;
        end: monaco.IPosition;
    } | {
        kind: 'line';
        first: number;
        last: number;
    };

    public isMovingCursorByMotion = false;
    public isExecutingCommand = false;
    public isRepeating = false;
    //#endregion

    private editorId: string;

    private subscriptions: monaco.IDisposable[] = [];

    private commandContext: ICommandContext;

    private currentModeName!: ModeName;
    private currentMode!: Mode;

    private normalMode: NormalMode;
    private insertMode: InsertMode;
    private visualMode: VisualMode;
    private visualLineMode: VisualLineMode;

    static instances = new Map<string, Dispatcher>();

    static create(editor: monaco.editor.ICodeEditor, eventSink?: IEventSink) {
        let editorId = editor.getId();
        if (Dispatcher.instances.has(editorId)) {
            throw new Error(`already created for "${editorId}"`);
        }
        let instance = new Dispatcher(editor, eventSink, configuration.startInInsertMode ? 'Insert' : 'Normal');
        Dispatcher.instances.set(editorId, instance);
        return instance;
    }

    static getInstance(editorId: string) {
        return Dispatcher.instances.get(editorId);
    }

    static disposeAllInstances() {
        Dispatcher.instances.forEach(x => x.dispose());
        Dispatcher.instances.clear();
    }

    private constructor(readonly editor: monaco.editor.ICodeEditor, readonly eventSink?: IEventSink, initialMode: ModeName = 'Normal') {
        this.editorId = editor.getId();

        this.commandContext = new CommandContext(this);

        this.normalMode = new NormalMode(this.commandContext);
        this.insertMode = new InsertMode(this.commandContext);
        this.visualMode = new VisualMode(this.commandContext);
        this.visualLineMode = new VisualLineMode(this.commandContext);

        switch(initialMode) {
            case 'Normal':
                this.toNormal();
                break;
            case 'Insert':
                this.toInsert();
                break;
            case 'Visual':
                this.toVisual();
                break;
            case 'VisualLine':
                this.toVisualLine();
                break;
        }

        this.subscriptions.push(this.editor.onKeyDown(e => this.handleKeyDown(e)));
        this.subscriptions.push(this.editor.onDidChangeCursorPosition(e => this.handleCursorChanged(e)));
        this.subscriptions.push(this.editor.onDidBlurEditorText(() => this.handleLostFocus()));
        this.subscriptions.push(this.editor.onDidDispose(() => this.dispose()));
    }

    dispose() {
        this.currentMode.leave();
        this.normalMode.dispose();
        this.insertMode.dispose();
        this.visualMode.dispose();
        this.visualLineMode.dispose();
        for (const item of this.subscriptions) {
            item.dispose();
        }
        Dispatcher.instances.delete(this.editorId);
        this.editor.updateOptions({cursorStyle: 'line'});
    }

    get model() {
        let model = this.editor.getModel();
        if (!model) {
            throw new Error('ICodeEditor.getModel() returns null.');
        }
        return model;
    }

    isVisual() {
        return this.currentModeName === 'Visual' || this.currentModeName === 'VisualLine';
    }

    getMode() {
        return this.currentModeName;
    }

    getModeDisplayName() {
        return this.currentMode.displayName;
    }

    toNormal() {
        if (this.currentModeName === 'Normal') {
            return;
        }
        if (this.currentMode) {
            this.currentMode.leave();
        }
        this.normalMode.enter();
        this.currentModeName = 'Normal';
        this.currentMode = this.normalMode;
        this.onModeChanged();
    }

    toInsert(action?: {command: ICommand, args: ICommandArgs}, repeatable: RepeatableKind = 'none') {
        if (this.currentModeName === 'Insert') {
            return;
        }
        if (this.currentMode) {
            this.currentMode.leave();
        }
        this.insertMode.enter(action, repeatable);
        this.currentModeName = 'Insert';
        this.currentMode = this.insertMode;
        this.onModeChanged();
    }

    toVisual(selection?: monaco.Selection) {
        if (this.currentModeName === 'Visual') {
            return;
        }
        if (this.currentMode) {
            this.currentMode.leave();
        }
        this.visualMode.enter(selection);
        this.currentModeName = 'Visual';
        this.currentMode = this.visualMode;
        this.onModeChanged();
    }

    toVisualLine(selection?: {first: number; last: number}) {
        if (this.currentModeName === 'VisualLine') {
            return;
        }
        if (this.currentMode) {
            this.currentMode.leave();
        }
        this.visualLineMode.enter(selection);
        this.currentModeName = 'VisualLine';
        this.currentMode = this.visualLineMode;
        this.onModeChanged();
    }

    outputInfo(message: string) {
        if (this.eventSink && this.eventSink.onCommandOuput) {
            this.eventSink.onCommandOuput(this, 'info', message);
        }
    }

    outputError(message: string) {
        if (this.eventSink && this.eventSink.onCommandOuput) {
            this.eventSink.onCommandOuput(this, 'error', message);
        }
    }

    beep() {
        if (this.eventSink && this.eventSink.onCommandBeep) {
            this.eventSink.onCommandBeep(this);
        }
    }

    notifyKeyBufferChanged(keys: string | ReadonlyArray<number>) {
        if (this.eventSink && this.eventSink.onKeyBufferChanged) {
            if (typeof keys !== 'string') {
                keys = keys.map(x => keyUtils.vkey(x)).join('');
            }
            this.eventSink.onKeyBufferChanged(this, keys);
        }
    }

    notifyKeyWaiting(keys: string | ReadonlyArray<number>) {
        if (this.eventSink && this.eventSink.onKeyWaiting) {
            if (typeof keys !== 'string') {
                keys = keys.map(x => keyUtils.vkey(x)).join('');
            }
            this.eventSink.onKeyWaiting(this, keys);
        }
    }

    notifyKeyMatched(keys: string | ReadonlyArray<number>) {
        if (this.eventSink && this.eventSink.onKeyMatched) {
            if (typeof keys !== 'string') {
                keys = keys.map(x => keyUtils.vkey(x)).join('');
            }
            this.eventSink.onKeyMatched(this, keys);
        }
    }

    notifyKeyFailed(keys: string | ReadonlyArray<number>) {
        if (this.eventSink && this.eventSink.onKeyFailed) {
            if (typeof keys !== 'string') {
                keys = keys.map(x => keyUtils.vkey(x)).join('');
            }
            this.eventSink.onKeyFailed(this, keys);
        }
    }

    notifyKeyCanceled(keys: string | ReadonlyArray<number>) {
        if (this.eventSink && this.eventSink.onKeyCanceled) {
            if (typeof keys !== 'string') {
                keys = keys.map(x => keyUtils.vkey(x)).join('');
            }
            this.eventSink.onKeyCanceled(this, keys);
        }
    }

    private onModeChanged() {
        if (Dispatcher.instances.has(this.editorId) && this.eventSink && this.eventSink.onModeChanged) {
            this.eventSink.onModeChanged(this, this.getMode(), this.getModeDisplayName());
        }
    }

    requestExternalInput(prefix: string, text: string, textChangedCallback: (text: string) => void): Promise<string | null> {
        if (this.eventSink && this.eventSink.onRequestExternalInput) {
            return this.eventSink.onRequestExternalInput(this, prefix, text, textChangedCallback);
        }
        else {
            return new Promise(resolve => {
                let ev = {
                    onChange: (s: string) => {
                        textChangedCallback(s);
                    },
                    onSubmit: (s: string) => {
                        resolve(s);
                    },
                    onCancel: () => {
                        resolve(null);
                    }
                };
                new ExternalInputWidget(this.editor, prefix, text, ev);
            });
        }
    }

    private handleKeyDown(e: monaco.IKeyboardEvent) {
        let keyCode: KeyCode = e.keyCode as number;
        if (keyCode == KeyCode.Ctrl || keyCode === KeyCode.Shift || keyCode === KeyCode.Alt || keyCode === KeyCode.Meta) {
            return;
        }
        let key = keyUtils.extract(e);
        let r = this.handleInput(key, true);
        if (r.handled) {
            e.preventDefault();
            e.stopPropagation();
            if (r.job) {
                r.job();
            }
        }
    }

    private handleInput(key: number, isFromKeyboard: boolean) {
        let r = this.currentMode.handleInput(key, isFromKeyboard);
        if (typeof r === 'boolean') {
            r = {handled: r};
        }
        return r;
    }

    async sendInput(k: number | number[] | string) {
        if (typeof k === 'number') {
            let r = this.handleInput(k, false);
            if (r.job) {
                await r.job();
            }
            return r.handled;
        }
        else {
            let allHandled = true;
            let keys = typeof k === 'string' ? keyUtils.parse(k) : k;
            for (let key of keys) {
                let r = this.handleInput(key, false);
                if (!r.handled || r.failed) {
                    allHandled = false;
                    break;
                }
                if (r.job) {
                    await r.job();
                }
            }
            return allHandled;
        }
    }

    executeExCommand(text: string) {
        return executeExCommand(this.commandContext, text);
    }

    handleCursorChanged(e: monaco.editor.ICursorPositionChangedEvent) {
        if (!this.isMovingCursorByMotion) {
            this.desiredColumn = e.position.column;
        }
    }

    handleLostFocus() {
        this.currentMode.discardInputBuffer();
    }

    private historyPatches = new Map<number, HistoryPatch>();

    addHistoryPatch(beforeVersionId: number, afterVersionId: number, beforeCursor?: monaco.IPosition, afterCursor?: monaco.IPosition) {
        let item: HistoryPatch = {beforeVersionId, afterVersionId};
        if (beforeCursor) {
            item.beforeCursor = monaco.Position.lift(beforeCursor);
        }
        if (afterCursor) {
            item.afterCursor = monaco.Position.lift(afterCursor);
        }
        this.historyPatches.set(beforeVersionId, item);
        this.historyPatches.set(afterVersionId, item);
    }

    undo(): number {
        let model = this.model;
        let versionId = model.getAlternativeVersionId();
        let item = this.historyPatches.get(versionId);
        if (item && item.afterVersionId == versionId) {
            while (versionId !== item.beforeVersionId) {
                this.editor.trigger('vim', 'undo', null);
                let vid = model.getAlternativeVersionId();
                if (vid === versionId) {
                    return vid;
                }
                versionId = vid;
            }
            if (item.beforeCursor) {
                this.editor.setPosition(this.commandContext.position.soften(item.beforeCursor));
            }
            return versionId;
        }
        else {
            this.editor.trigger('vim', 'undo', null);
            return model.getAlternativeVersionId();
        }
    }

    redo(): number {
        let model = this.model;
        let versionId = model.getAlternativeVersionId();
        let item = this.historyPatches.get(versionId);
        if (item && item.beforeVersionId == versionId) {
            // fact: altVerId equals verId after any non-undo-redo change
            while (versionId < item.afterVersionId) {
                this.editor.trigger('vim', 'redo', null);
                let vid = model.getAlternativeVersionId();
                if (vid === versionId) {
                    return vid;
                }
                versionId = vid;
            }
            if (versionId === item.afterVersionId && item.afterCursor) {
                this.editor.setPosition(this.commandContext.position.soften(item.afterCursor));
            }
            return versionId;
        }
        else {
            this.editor.trigger('vim', 'redo', null);
            return model.getAlternativeVersionId();
        }
    }
}
