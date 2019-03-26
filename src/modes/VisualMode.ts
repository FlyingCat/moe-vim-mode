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

    enter(selections?: monaco.Selection[]) {
        if (selections) {
            this.context.editor.setSelections(selections);
            this.context.editor.revealRange(selections[0]);
            this.updateDecoration();
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
        if (!this.context.vimState.isExecutingCommand) {
            if (sel.isEmpty() && e.secondarySelections.length === 0) {
                this.context.vimState.toNormal();
                return;
            }
        }
        this.updateDecoration();
    }

    private updateDecoration() {
        let selections = this.context.editor.getSelections();
        if (!selections) {
            return;
        }
        this.decorations = this.context.editor.deltaDecorations(this.decorations || [], selections.filter(x => !x.isEmpty()).map(x => {
            let ltr = x.getDirection() === monaco.SelectionDirection.LTR;
            let pos = x.getPosition();
            return {
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
            }
        }));
    }
}
