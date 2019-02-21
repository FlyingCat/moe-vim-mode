import {  IEventSink } from "../types";
import { Mode } from "./Mode";
import * as keyUtils from "../utils/key";
import { KeyCode } from "../utils/KeyCode";
import { recorder, IRepeatableAction } from "../recorder";
import { CommandFunction, ICommandContext, ICommand, ICommandArgs, executeCommand } from "../command";
import { doThen } from "../utils/helper";
import * as monaco from "monaco-editor";

export type RepeatableKind = 'none' | 'text' | 'command';

type CommandAction = {command: ICommand; args: ICommandArgs}

type Change = {
    deleteBefore: number;
    deleteAfter: number;
    text: string;
}

type RepeatInsertionArg = {
    action?: CommandFunction;
    repeatable: RepeatableKind;
    change?: Change
}

interface IRepeatInsertAction extends IRepeatableAction {
    kind: RepeatableKind;
    beforeAction?: CommandAction;
    change?: Change;
    getCount(): number;
    commitInsertion(ctx: ICommandContext): void | PromiseLike<void>;
}

class PlainInsertAction implements IRepeatInsertAction {
    kind: RepeatableKind = 'none';

    constructor(public beforeAction?: CommandAction, public change?: Change) {
    }

    setCount(value: number) {
        if (this.beforeAction) {
            this.beforeAction.args.count = value;
        }
    }

    getCount() {
        if (this.beforeAction && this.beforeAction.args.count) {
            return this.beforeAction.args.count;
        }
        else {
            return 1;
        }
    }

    execBeforeAction(ctx: ICommandContext) {
        if (this.beforeAction) {
            return executeCommand(this.beforeAction.command, ctx, this.beforeAction.args);
        }
    }

    execute(ctx: ICommandContext) {
        return doThen(this.execBeforeAction(ctx), () => {
            if (this.change) {
                let pos = ctx.model.getOffsetAt(ctx.editor.getPosition()!);
                let offsetStart = Math.max(0, pos - this.change.deleteBefore);
                let start = ctx.model.getPositionAt(offsetStart);
                let end = ctx.model.getPositionAt(Math.min(ctx.model.getValueLength(), pos + this.change.deleteAfter));
                let range = monaco.Range.fromPositions(start, end);
                let text = this.change.text;
                ctx.editor.executeEdits('vim', [{range, text}]);
                let cur = ctx.model.getPositionAt(offsetStart + text.length);
                ctx.editor.setPosition(cur);
            }
            ctx.editor.pushUndoStop();
            toNormal(ctx);
        });
    }

    commitInsertion(ctx: ICommandContext) {
    }
}

class InsertRepeatedTextAction implements IRepeatInsertAction {
    kind: RepeatableKind = 'text';

    constructor(public beforeAction?: CommandAction, public change?: Change, private count = 1) {
    }

    setCount(value: number) {
        this.count = value;
    }

    getCount() {
        return this.count;
    }

    execBeforeAction(ctx: ICommandContext) {
        if (this.beforeAction) {
            return executeCommand(this.beforeAction.command, ctx, this.beforeAction.args);
        }
    }

    execute(ctx: ICommandContext) {
        return doThen(this.execBeforeAction(ctx), () => {
            if (this.change) {
                let n = this.count;
                while (n !== 0) {
                    let pos = ctx.model.getOffsetAt(ctx.editor.getPosition()!);
                    let offsetStart = Math.max(0, pos - this.change.deleteBefore);
                    let start = ctx.model.getPositionAt(offsetStart);
                    let end = ctx.model.getPositionAt(Math.min(ctx.model.getValueLength(), pos + this.change.deleteAfter));
                    let range = monaco.Range.fromPositions(start, end);
                    let text = this.change.text;
                    ctx.editor.executeEdits('vim', [{range, text}]);
                    let cur = ctx.model.getPositionAt(offsetStart + text.length);
                    ctx.editor.setPosition(cur);
                    n--;
                }
            }
            ctx.editor.pushUndoStop();
            toNormal(ctx);
        });
    }

    commitInsertion(ctx: ICommandContext) {
        if (this.change) {
            let n = this.count - 1;
            while (n !== 0) {
                let pos = ctx.model.getOffsetAt(ctx.editor.getPosition()!);
                let offsetStart = Math.max(0, pos - this.change.deleteBefore);
                let start = ctx.model.getPositionAt(offsetStart);
                let end = ctx.model.getPositionAt(Math.min(ctx.model.getValueLength(), pos + this.change.deleteAfter));
                let range = monaco.Range.fromPositions(start, end);
                let text = this.change.text;
                ctx.editor.executeEdits('vim', [{range, text}]);
                let cur = ctx.model.getPositionAt(offsetStart + text.length);
                ctx.editor.setPosition(cur);
                n--;
            }
            ctx.editor.pushUndoStop();
        }
    }
}

class RepeatCommandAndInsertAction implements IRepeatableAction {
    kind: RepeatableKind = 'command';

    constructor(public beforeAction?: CommandAction, public change?: Change, private count = 1) {
    }

    setCount(value: number) {
        this.count = value;
    }

    getCount() {
        return this.count;
    }

    execBeforeAction(ctx: ICommandContext) {
        if (this.beforeAction) {
            return executeCommand(this.beforeAction.command, ctx, this.beforeAction.args);
        }
    }

    execute(ctx: ICommandContext) {
        let n = this.count;
        // TODO
        while (n !== 0) {
            doThen(this.execBeforeAction(ctx), () => {
                if (this.change) {
                    let pos = ctx.model.getOffsetAt(ctx.editor.getPosition()!);
                    let offsetStart = Math.max(0, pos - this.change.deleteBefore);
                    let start = ctx.model.getPositionAt(offsetStart);
                    let end = ctx.model.getPositionAt(Math.min(ctx.model.getValueLength(), pos + this.change.deleteAfter));
                    let range = monaco.Range.fromPositions(start, end);
                    let text = this.change.text;
                    ctx.editor.executeEdits('vim', [{range, text}]);
                    let cur = ctx.model.getPositionAt(offsetStart + text.length);
                    ctx.editor.setPosition(cur);
                }
            });
            n--;
        }
        ctx.editor.pushUndoStop();
        toNormal(ctx);
    }

    commitInsertion(ctx: ICommandContext) {
        let n = this.count - 1;
        // TODO
        while (n !== 0) {
            doThen(this.execBeforeAction(ctx), () => {
                if (this.change) {
                    let pos = ctx.model.getOffsetAt(ctx.editor.getPosition()!);
                    let offsetStart = Math.max(0, pos - this.change.deleteBefore);
                    let start = ctx.model.getPositionAt(offsetStart);
                    let end = ctx.model.getPositionAt(Math.min(ctx.model.getValueLength(), pos + this.change.deleteAfter));
                    let range = monaco.Range.fromPositions(start, end);
                    let text = this.change.text;
                    ctx.editor.executeEdits('vim', [{range, text}]);
                    let cur = ctx.model.getPositionAt(offsetStart + text.length);
                    ctx.editor.setPosition(cur);
                }
            });
            n--;
        }
        ctx.editor.pushUndoStop();
    }
}

function toNormal(ctx: ICommandContext, cursor?: monaco.IPosition) {
    cursor = cursor || ctx.editor.getPosition()!;
    let pos = ctx.position.get(cursor).shouldWrap(false).move(-1);
    ctx.editor.setPosition(pos);
    ctx.editor.revealPosition(pos);
    ctx.vimState.toNormal();
}

export class InsertMode extends Mode {
    beforeAction?: CommandAction;
    repeatable: RepeatableKind = 'none';

    private insertionPoint: number;

    private change?: {
        textStart: number;
        textEnd: number;
        deletionBefore: number;
        deletionAfter: number;
    }

    private stagedRepeatAction?: IRepeatInsertAction;

    private subscriptions: monaco.IDisposable[] = [];

    constructor(readonly context: ICommandContext) {
        super('Insert', 'Insert');
        this.insertionPoint = context.model.getOffsetAt(context.editor.getPosition()!);
    }

    enter(capture?: CommandAction, repeatable: RepeatableKind = 'none') {
        this.context.editor.updateOptions({cursorStyle: 'line'});
        if (this.context.vimState.isRepeating) {
            return;
        }
        this.beforeAction = capture;
        this.repeatable = repeatable;
        this.insertionPoint = this.context.model.getOffsetAt(this.context.editor.getPosition()!);
        this.subscriptions.push(this.context.editor.onDidChangeCursorPosition(e => this.onCursorPositionChanged(e)));
        this.subscriptions.push(this.context.editor.onDidChangeCursorSelection(e => this.onSelectionChanged(e)));
        this.subscriptions.push(this.context.model.onDidChangeContent(e => this.onContentChanged(e)));
    }

    leave() {
        this.change = undefined;
        this.repeatable = 'none';
        this.dispose();
    }

    dispose() {
        for (const item of this.subscriptions) {
            item.dispose();
        }
        this.subscriptions = []
    }

    discardInputBuffer() {
    }

    handleInput(key: number, isFromKeyboard: boolean): boolean {
        if (key === keyUtils.pack(KeyCode.Escape)) {
            this.commitChangeRecord();
            let ctx = this.context;
            toNormal(ctx);
            return true;
        }
        else if (!isFromKeyboard && keyUtils.isCharKey(key)) {
            this.context.editor.trigger('vim', 'type', {text: String.fromCharCode(key)});
            return true;
        }
        return false;
    }

    onCursorPositionChanged(e: monaco.editor.ICursorPositionChangedEvent) {
        if (e.reason === monaco.editor.CursorChangeReason.Explicit) {
            this.stageChangeRecord();
            this.insertionPoint = this.context.model.getOffsetAt(this.context.editor.getPosition()!);
            this.repeatable = 'text';
        }
    }

    onSelectionChanged(e: monaco.editor.ICursorSelectionChangedEvent) {
        // console.log(e);
    }

    onContentChanged(e: monaco.editor.IModelContentChangedEvent) {
        if (e.changes.length === 0) {
            return;
        }
        if (e.changes.length > 1) {
            this.stageChangeRecord();
            this.insertionPoint = this.context.model.getOffsetAt(this.context.editor.getPosition()!);
            return;
        }
        if (!this.change) {
            this.change = {
                textStart: this.insertionPoint,
                textEnd: this.insertionPoint,
                deletionBefore: 0,
                deletionAfter: 0,
            }
        }
        let removalStart = e.changes[0].rangeOffset;
        let removalEnd = e.changes[0].rangeOffset + e.changes[0].rangeLength;
        let removalLength = e.changes[0].rangeLength;
        let insertionLength = e.changes[0].text.length;
        let textLength = this.change.textEnd - this.change.textStart;
        if (removalStart > this.change.textEnd || removalEnd < this.change.textStart) {
            this.stageChangeRecord();
            this.insertionPoint = this.context.model.getOffsetAt(this.context.editor.getPosition()!);
            return;
        }
        this.stagedRepeatAction = undefined;
        if (removalStart < this.change.textStart) {
            let diff = this.change.textStart - removalStart;
            this.change.deletionBefore += diff;
            this.change.textStart = removalStart;
            removalLength -= diff;
        }
        if (removalEnd > this.change.textEnd) {
            let diff = removalEnd - this.change.textEnd
            this.change.deletionAfter += diff;
            removalLength -= diff;
        }
        this.change.textEnd = this.change.textStart + textLength + insertionLength - removalLength;
    }

    commitChangeRecord() {
        this.stageChangeRecord();
        if (this.stagedRepeatAction) {
            let staged = this.stagedRepeatAction;
            staged.commitInsertion(this.context);
            recorder.setLastAction(staged);
            this.stagedRepeatAction = undefined;
        }
    }

    stageChangeRecord() {
        if (this.stagedRepeatAction) {
            return;
        }
        let beforeAction = this.beforeAction;
        this.beforeAction = undefined;
        let count = (beforeAction ? beforeAction.args.count : 1) || 1;
        let change = this.change;
        this.change = undefined;
        let kind = this.repeatable;
        this.repeatable = 'none'
        let textChange: Change | undefined;
        if (change) {
            let text = '';
            if (change.textStart !== change.textEnd) {
                let start = this.context.model.getPositionAt(change.textStart);
                let end = this.context.model.getPositionAt(change.textEnd);
                let range = monaco.Range.fromPositions(start, end);
                text = this.context.model.getValueInRange(range);
            }
            textChange = {
                text,
                deleteBefore: change.deletionBefore,
                deleteAfter: change.deletionBefore,
            };
        }
        if (kind === 'none') {
            this.stagedRepeatAction = new PlainInsertAction(beforeAction, textChange);
        }
        else if (kind === 'command') {
            this.stagedRepeatAction = new RepeatCommandAndInsertAction(beforeAction, textChange, count);
        }
        else if (kind === 'text') {
            this.stagedRepeatAction = new InsertRepeatedTextAction(beforeAction, textChange, count);
        }
        return this.stagedRepeatAction;
    }
}


