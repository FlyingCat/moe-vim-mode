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

    enter(sels?: {first: number; last: number}[]) {
        this.context.editor.updateOptions({cursorStyle: 'block'});
        let selections: monaco.Selection[];
        if (sels && sels.length > 0) {
            selections = sels.map(sel => {
                let start: monaco.IPosition;
                let end: monaco.IPosition;
                if (sel.first <= sel.last) {
                    start = this.context.position.get(sel.first, 1);
                    end = this.context.position.get(sel.last, 'eol');
                }
                else {
                    start = this.context.position.get(sel.first, 'eol');
                    end = this.context.position.get(sel.last, 1);
                }
                return monaco.Selection.fromPositions(start, end);
            });
        }
        else {
            let ln = this.context.editor.getPosition()!.lineNumber;
            let start = this.context.position.get(ln, 1);
            let end = this.context.position.get(ln, 'eol');
            return monaco.Selection.fromPositions(start, end);
        }
        this.context.vimState.previousVisual = {kind: 'line', first: selections[0].selectionStartLineNumber, last: selections[0].positionLineNumber};
        this.context.editor.setSelections(selections);
        this.subscriptions.push(this.context.editor.onDidChangeCursorSelection(e => this.onSelectionChanged(e)));
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

    onSelectionChanged(e: monaco.editor.ICursorSelectionChangedEvent) {
        let sel = e.selection;
        if (!this.context.vimState.isExecutingCommand) {
            if (sel.isEmpty() && e.secondarySelections.length === 0) {
                this.context.vimState.toNormal();
                return;
            }
            else {
                let reverse = sel.selectionStartLineNumber > sel.positionLineNumber;
                let newSelections = this.context.editor.getSelections()!.map(x => {
                    let first = x.selectionStartLineNumber;
                    let last = x.positionLineNumber;
                    if (reverse && last >= first) {
                        let tmp = first;
                        first = last;
                        last = tmp;
                    }
                    let start: monaco.IPosition;
                    let end: monaco.IPosition;
                    if (!reverse) {
                        start = {lineNumber: first, column: 1};
                        end = this.context.position.get(last, 'eol');
                    }
                    else {
                        start = this.context.position.get(first, 'eol');
                        end = {lineNumber: last, column: 1};
                    }
                    return monaco.Selection.fromPositions(start, end);
                });
                this.context.editor.setSelections(newSelections);
            }
        }
    }
}
