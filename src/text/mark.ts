import * as monaco from "monaco-editor";
import { ICommandContext } from "../command";

let modelRegistry = new Map<string, MarkModel>();

class MarkModel {
    private editorId: string;

    private marks = new Map<string, monaco.IPosition>();

    private removedMarks = new Map<number, {name: string, position: monaco.IPosition}[]>();

    private prevVersionId: number;

    private constructor(readonly editor: monaco.editor.ICodeEditor) {
        this.editorId = this.editor.getId();
        this.prevVersionId = this.editor.getModel()!.getAlternativeVersionId();
        this.editor.onDidDispose(() => {
            modelRegistry.delete(this.editorId);
        });
        this.editor.onDidChangeModelContent(e => {
            if (e.changes.length !== 0) {
                this.onTextChanged(e);
            }
            this.prevVersionId = this.editor.getModel()!.getAlternativeVersionId();
        });
    }

    static create(editor: monaco.editor.ICodeEditor) {
        let editorId = editor.getId();
        let instance = modelRegistry.get(editorId);
        if (!instance) {
            instance = new MarkModel(editor);
            modelRegistry.set(editorId, instance);
        }
        return instance;
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

export class TextMark {
    static get(ctx: ICommandContext, name: string): monaco.IPosition | undefined {
        let instance = MarkModel.create(ctx.editor);
        return instance.getMark(name);
    }

    static set(ctx: ICommandContext, name: string, pos: monaco.IPosition) {
        let instance = MarkModel.create(ctx.editor);
        instance.setMark(name, pos);
    }
}
