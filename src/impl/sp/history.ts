import * as monaco from "monaco-editor";
import { ICommandContext } from "../../boot/base";
import { registerCommand, registerContextDataFactory } from "../../boot/registry";
import { TextPositionFactory } from "../../text/position";

type HistoryPatch = {
    beforeCursor?: monaco.Position;
    beforeVersionId: number;
    afterCursor?: monaco.Position;
    afterVersionId: number;
}

class HistoryModel {
    private historyPatches = new Map<number, HistoryPatch>();

    constructor(readonly editor: monaco.editor.ICodeEditor, readonly position: TextPositionFactory) {
    }

    dispose() {
    }

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
        let model = this.editor.getModel()!;
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
                this.editor.setPosition(this.position.soften(item.beforeCursor));
            }
            return versionId;
        }
        else {
            this.editor.trigger('vim', 'undo', null);
            return model.getAlternativeVersionId();
        }
    }

    redo(): number {
        let model = this.editor.getModel()!;
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
                this.editor.setPosition(this.position.soften(item.afterCursor));
            }
            return versionId;
        }
        else {
            this.editor.trigger('vim', 'redo', null);
            return model.getAlternativeVersionId();
        }
    }
}

registerContextDataFactory('history', d => new HistoryModel(d.editor, d.commandContext.position));

export function addHistoryPatch(ctx: ICommandContext, beforeVersionId: number, afterVersionId: number, beforeCursor?: monaco.IPosition, afterCursor?: monaco.IPosition) {
    let historyModel = ctx.vimState.getContextData<HistoryModel>('history');
    historyModel.addHistoryPatch(beforeVersionId, afterVersionId, beforeCursor, afterCursor);
}

registerCommand('u', 'n', (ctx, mst) => {
    let historyModel = ctx.vimState.getContextData<HistoryModel>('history');
    let n = mst.count || 1;
    let versionId = ctx.model.getAlternativeVersionId();
    while (n !== 0) {
        let altVersionId = historyModel.undo();
        if (versionId === altVersionId) {
            ctx.vimState.beep();
            break;
        }
        else {
            versionId = altVersionId;
        }
        n--;
    }
    let sel = ctx.editor.getSelection();
    if (sel && !sel.isEmpty()) {
        let pos = ctx.position.get(sel.positionLineNumber, sel.positionColumn).soft();
        ctx.editor.setPosition(pos);
    }
});

registerCommand('<C-R>', 'n', (ctx, mst) => {
    let historyModel = ctx.vimState.getContextData<HistoryModel>('history');
    let n = mst.count || 1;
    let versionId = ctx.model.getAlternativeVersionId();
    while (n !== 0) {
        let altVersionId = historyModel.redo();
        if (versionId === altVersionId) {
            ctx.vimState.beep();
            break;
        }
        else {
            versionId = altVersionId;
        }
        n--;
    }
});
