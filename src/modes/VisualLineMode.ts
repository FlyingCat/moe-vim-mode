import { ModeBase } from "./Mode";
import { configuration } from "../configuration";
import * as monaco from "monaco-editor";
import { getComposedPrograms } from "../boot/registry";
import { ICommandContext } from "../boot/base";

export class VisualLineMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

    constructor(context: ICommandContext) {
        super('VisualLine', 'Visual Line', context);
    }

    get program() {
        return getComposedPrograms().forVisualLine;
    }

    get mapper() {
        return configuration.vmap;
    }

    enter(sel?: {first: number; last: number}) {
        this.context.editor.updateOptions({cursorStyle: 'block'});
        let start: monaco.IPosition;
        let end: monaco.IPosition;
        if (sel) {
            if (sel.first <= sel.last) {
                start = this.context.position.get(sel.first, 1);
                end = this.context.position.get(sel.last, 'eol');
            }
            else {
                start = this.context.position.get(sel.first, 'eol');
                end = this.context.position.get(sel.last, 1);
            }
        }
        else {
            let ln = this.context.editor.getPosition()!.lineNumber;
            start = this.context.position.get(ln, 1);
            end = this.context.position.get(ln, 'eol');
        }
        this.context.vimState.previousVisual = {kind: 'line', first: start.lineNumber, last: end.lineNumber};
        this.context.editor.setSelection(monaco.Selection.fromPositions(start, end));
        this.subscriptions.push(this.context.editor.onDidChangeCursorPosition(e => this.onCursorPositionChanged(e)));
    }

    leave() {
        this.dispose();
    }

    dispose() {
        super.dispose();

        for (const item of this.subscriptions) {
            item.dispose();
        }
        this.subscriptions = []
    }

    onCursorPositionChanged(e: monaco.editor.ICursorPositionChangedEvent) {
        if (!this.context.vimState.isMovingCursorByMotion) {
            if (this.context.editor.getSelection()!.isEmpty()) {
                this.context.vimState.toNormal();
            }
        }
    }
}
