import { ModeBase } from "./Mode";
import { configuration } from "../configuration";
import * as monaco from "monaco-editor";
import { getComposedPrograms } from "../boot/registry";
import { ICommandContext } from "../boot/base";

export class NormalMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

    private checkCursorsScheduled = false;

    constructor(context: ICommandContext) {
        super('Normal', 'Normal', context);
    }

    get program() {
        return getComposedPrograms().forNormal;
    }

    get mapper() {
        return configuration.nmap;
    }

    enter() {
        this.context.editor.updateOptions({cursorStyle: 'block'});
        let selections = this.context.editor.getSelections();
        if (selections) {
            this.context.editor.setSelections(selections.map(x => this.context.position.soften(x.getPosition()).toSelection()));
        }
        this.subscriptions.push(this.context.editor.onDidChangeCursorSelection(e => this.onSelectionChanged(e)));
        this.subscriptions.push(this.context.editor.onDidChangeModelContent(e => this.onContentChanged()))
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

    onContentChanged() {
        if (!this.context.vimState.isExecutingCommand) {
            this.checkCursorsScheduled = true;
            requestAnimationFrame(() => {
                if (this.checkCursorsScheduled) {
                    const editor = this.context.editor;
                    let selections = editor.getSelections();
                    if (selections) {
                        editor.setSelections(selections.map(x => this.context.position.soften(x.getPosition()).toSelection()))
                    }
                }
            });
        }
    }

    onSelectionChanged(e: monaco.editor.ICursorSelectionChangedEvent) {
        // console.log(`#sel source: ${e.source}, reason: ${monaco.editor.CursorChangeReason[e.reason]}`);
        if (!this.context.vimState.isExecutingCommand) {
            this.checkCursorsScheduled = false;
            if (e.reason === monaco.editor.CursorChangeReason.Undo ||  e.reason === monaco.editor.CursorChangeReason.Redo || (e.selection.isEmpty() && e.secondarySelections.every(x => x.isEmpty()))) {
                let pos = this.context.position.soften(e.selection.getPosition());
                let selections = [monaco.Selection.fromPositions(pos, pos)];
                e.secondarySelections.forEach(x => {
                    let p = this.context.position.soften(x.getPosition())
                    selections.push(monaco.Selection.fromPositions(p, p));
                })
                this.context.editor.setSelections(selections);
            }
            else {
                if (configuration.enterInsertModeIfSelectOutsideVim) {
                    this.context.vimState.toInsert();
                }
                else {
                    this.context.vimState.toVisual();
                }
            }
        }
    }
}
