import { ModeBase } from "./Mode";
import { configuration } from "../configuration";
import * as monaco from "monaco-editor";
import { getComposedPrograms } from "../boot/registry";
import { ICommandContext } from "../boot/base";

export class NormalMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

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
        let pos = this.context.position.get().soft();
        this.context.editor.setPosition(pos);
        this.subscriptions.push(this.context.editor.onDidChangeCursorPosition(e => this.onCursorChanged(e)));
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

    onCursorChanged(e: monaco.editor.ICursorPositionChangedEvent) {
        // console.log(`#cur source: ${e.source}, reason: ${monaco.editor.CursorChangeReason[e.reason]}`);
        // if (!this.context.vimState.isExecutingCommand) {
        //     let pos = this.context.position.soften(e.position);
        //     this.context.editor.setPosition(pos);
        // }
    }

    onSelectionChanged(e: monaco.editor.ICursorSelectionChangedEvent) {
        // console.log(`#sel source: ${e.source}, reason: ${monaco.editor.CursorChangeReason[e.reason]}`);
        // if (e.reason === monaco.editor.CursorChangeReason.Explicit && !e.selection.isEmpty()) {
        //     this.context.vimState.toInsert();
        // }
        if (e.reason === monaco.editor.CursorChangeReason.Undo || e.reason === monaco.editor.CursorChangeReason.Redo) {
            let pos = this.context.position.soften(e.selection.getPosition()!);
            this.context.editor.setPosition(pos);
            return;
        }
        if (!this.context.vimState.isExecutingCommand) {
            if (e.selection.isEmpty()) {
                let pos = this.context.position.soften(e.selection.getStartPosition());
                this.context.editor.setPosition(pos);
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

