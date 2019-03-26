import { ModeBase } from "./Mode";
import { configuration } from "../configuration";
import * as monaco from "monaco-editor";
import { getComposedPrograms } from "../boot/registry";
import { ICommandContext } from "../boot/base";

const kFakeCursorClassName = 'visual-mode-fake-cursor';

export class VisualMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

    private decorations?: string[];

    constructor(context: ICommandContext) {
        super('Visual', 'Visual', context);
    }

    get program() {
        return getComposedPrograms().forVisual;
    }

    get mapper() {
        return configuration.vmap;
    }

    enter(selection?: monaco.Selection) {
        if (selection) {
            this.context.editor.setSelection(selection);
            this.context.editor.revealRange(selection);
            this.updateDecoration(selection);
        }
        this.context.editor.updateOptions({cursorStyle: 'line'});
        this.subscriptions.push(this.context.editor.onDidChangeCursorSelection(e => this.onSelectionChanged(e)));
    }

    leave() {
        if (this.decorations) {
            this.decorations = this.context.editor.deltaDecorations(this.decorations, []);
        }
        this.dispose();
    }

    dispose() {
        super.dispose();
        for (const item of this.subscriptions) {
            item.dispose();
        }
        this.subscriptions = []
    }

    onSelectionChanged(e: monaco.editor.ICursorSelectionChangedEvent) {
        let sel = e.selection;
        if (!this.context.vimState.isMovingCursorByMotion) {
            if (sel.isEmpty()) {
                this.context.vimState.toNormal();
            }
        }
        this.updateDecoration(sel);
    }

    private updateDecoration(sel: monaco.Selection) {
        if (sel.isEmpty() && this.decorations) {
            this.decorations = this.context.editor.deltaDecorations(this.decorations, []);
            return;
        }
        let ltr = sel.getDirection() === monaco.SelectionDirection.LTR;
        let pos = sel.getPosition();
        this.decorations = this.context.editor.deltaDecorations(this.decorations || [], [{
            range: {
                startLineNumber: pos.lineNumber,
                startColumn: Math.max(1, ltr ? pos.column - 1 : pos.column),
                endLineNumber: pos.lineNumber,
                endColumn: ltr ? pos.column : pos.column + 1,
            },
            options: {
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                className: kFakeCursorClassName,
            }
        }]);
    }
}
