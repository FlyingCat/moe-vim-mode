import * as monaco from "monaco-editor";
import { ICommandContext } from "../../boot/base";
import { registerCommand, registerMotion, registerContextDataFactory } from "../../boot/registry";
import { convertToMarkId } from "./markCommon";

class MarkModel {
    private marks = new Map<string, monaco.IPosition>();

    private removedMarks = new Map<number, {name: string, position: monaco.IPosition}[]>();

    private prevVersionId: number;

    private subcriptions: monaco.IDisposable[] = [];

    constructor(readonly editor: monaco.editor.ICodeEditor) {
        this.prevVersionId = this.editor.getModel()!.getAlternativeVersionId();
        this.subcriptions.push(this.editor.onDidChangeModelContent(e => {
            if (e.changes.length !== 0) {
                this.onTextChanged(e);
            }
            this.prevVersionId = this.editor.getModel()!.getAlternativeVersionId();
        }));
    }

    dispose() {
        for (const s of this.subcriptions) {
            s.dispose();
        }
    }

    getMark(name: string): monaco.IPosition | undefined {
        return this.marks.get(name);
    }

    setMark(name: string, pos: monaco.IPosition) {
        this.marks.set(name, monaco.Position.lift(pos));
    }

    onTextChanged(e: monaco.editor.IModelContentChangedEvent) {
        let changes = e.changes.sort((a, b) => a.rangeOffset - b.rangeOffset);
        let list: {startLn: number, endLn: number, diff: number}[] = [];
        let getAdded = (text: string) => {
            let m = text.match(/\n/g);
            return m ? m.length : 0;
        }
        for (const change of changes) {
            let startLn = change.range.startLineNumber;
            let endLn = change.range.endLineNumber;
            let removed = endLn - startLn;
            let added = getAdded(change.text);
            let diff = (list.length ? list[list.length - 1].diff : 0) + added - removed;
            list.push({startLn, endLn, diff});
        }
        let handled = new Set<string>();
        for (let i = list.length; i > 0; i--) {
            let changeItem = list[i - 1];
            this.marks.forEach((markPos, name) => {
                if (handled.has(name)) {
                    return;
                }
                if (markPos.lineNumber >= changeItem.endLn) {
                    this.marks.set(name, {lineNumber: markPos.lineNumber + changeItem.diff, column: markPos.column});
                }
                else if (markPos.lineNumber < changeItem.endLn && markPos.lineNumber >= changeItem.startLn) {
                    if (!this.removedMarks.has(this.prevVersionId)) {
                        this.removedMarks.set(this.prevVersionId, []);
                    }
                    this.removedMarks.get(this.prevVersionId)!.push({name, position: markPos});
                    this.marks.delete(name);
                }
            });
        }
        if (e.isUndoing) {
            let verId = this.editor.getModel()!.getAlternativeVersionId();
            if (this.removedMarks.has(verId)) {
                for (const mark of this.removedMarks.get(verId)!) {
                    if (!this.marks.has(mark.name)) {
                        this.marks.set(mark.name, mark.position);
                    }
                }
            }
        }
    }
}

registerContextDataFactory('mark', d => new MarkModel(d.editor))

type MarkAccessor = {
    get(ctx: ICommandContext): monaco.IPosition | undefined;
    set(ctx: ICommandContext, pos: monaco.IPosition): void;
}

const specialMarks: {[k: string]: MarkAccessor} = {
    '<': {
        get(ctx) {
            let prev = ctx.vimState.previousVisual;
            if (prev) {
                if (prev.kind === 'char') {
                    return prev.start;
                }
                else {
                    if (prev.first <= prev.last) {
                        return ctx.position.get(prev.first, 1);
                    }
                    else {
                        return ctx.position.get(prev.first, '$');
                    }
                }
            }
            return undefined;
        },
        set(ctx, pos) {
            throw new Error('Not implemented');
        }
    },
    '>': {
        get(ctx) {
            let prev = ctx.vimState.previousVisual;
            if (prev) {
                if (prev.kind === 'char') {
                    return prev.end;
                }
                else {
                    if (prev.first <= prev.last) {
                        return ctx.position.get(prev.last, '$');
                    }
                    else {
                        return ctx.position.get(prev.last, 1);
                    }
                }
            }
            return undefined;
        },
        set(ctx, pos) {
            throw new Error('Not implemented');
        }
    },
}

function get(ctx: ICommandContext, id: string): monaco.IPosition | undefined {
    if (specialMarks[id]) {
        return specialMarks[id].get(ctx);
    }
    else {
        return ctx.vimState.getContextData<MarkModel>('mark').getMark(id);
    }
}

export function getMarkByName(ctx: ICommandContext, name: string): monaco.IPosition | undefined {
    if (name.length === 1) {
        let id = convertToMarkId(name.charCodeAt(0));
        if (id) {
            return get(ctx, id);
        }
    }
    return undefined;
}

function set(ctx: ICommandContext, id: string, pos: monaco.IPosition) {
    if (specialMarks[id]) {
        specialMarks[id].set(ctx, pos);
    }
    else {
        ctx.vimState.getContextData<MarkModel>('mark').setMark(id, pos);
    }
}

export function setMarkByName(ctx: ICommandContext, name: string, pos: monaco.IPosition) {
    if (name.length === 1) {
        let id = convertToMarkId(name.charCodeAt(0));
        if (id) {
            set(ctx, id, pos);
            return;
        }
    }
    throw new Error();
}

registerCommand(['m', {kind: 'Mark'}], 'n', (ctx, args) => {
    let cursor = ctx.position.get();
    set(ctx, args.mark!, cursor);
});

registerMotion(["'", {kind: 'Mark'}], { isJump: true, run: (ctx, pos, count, _a, _b, args) => {
    let mark = get(ctx, args.mark!);
    if (mark) {
        return ctx.position.get(mark.lineNumber, '^');
    }
    return null;
}});

registerMotion(["`", {kind: 'Mark'}], { isJump: true, run: (ctx, pos, count, _a, _b, args) => {
    return get(ctx, args.mark!) || null;
}});
