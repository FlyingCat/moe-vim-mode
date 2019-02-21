import { ModeBase } from "./Mode";
import { applyMotion } from "../utils/helper";
import * as P from "../matching/pattern";
import * as keyUtils from "../utils/key";
import { motionPattern, objectSelectionPattern } from "../motions";
import { Program } from "../matching/program";
import { KeyCode } from "../utils/KeyCode";
import { visualOperatorPattern } from "../operations";
import { createCommand, ICommandContext, executeCommand } from "../command";
import { configuration } from "../configuration";
import * as monaco from "monaco-editor";
import { actionsPattern } from "../actions";

const kFakeCursorClassName = 'visual-mode-fake-cursor';

const escKey = keyUtils.pack(KeyCode.Escape);

let moveCursor = createCommand((ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let sel = ctx.editor.getSelection()!;
    let start: monaco.IPosition = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
    let cursor: monaco.IPosition = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let result = applyMotion('Select', ctx, mst, cursor);
    if (!result.to) {
        ctx.vimState.beep();
        return;
    }
    let pos = result.inclusive ? ctx.position.get(result.to).move(1) : result.to;
    if (result.keepPrevDesiredColumn !== true) {
        ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
    }
    ctx.vimState.previousVisual = {kind: 'char', start, end: pos};
    let newSel = monaco.Selection.fromPositions(start, pos);
    ctx.editor.setSelection(newSel);
    ctx.editor.revealPosition(pos);
    ctx.vimState.isMovingCursorByMotion = false;
});

let selectObject = createCommand((ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let sel = ctx.editor.getSelection()!;
    let cursor: monaco.IPosition = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let result = applyMotion('Select', ctx, mst, cursor);
    if (!result.to) {
        ctx.vimState.beep();
        return;
    }
    let pos = ctx.position.get(result.to).move(1);
    if (result.keepPrevDesiredColumn !== true) {
        ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
    }
    let tar = monaco.Range.fromPositions(result.from, pos);
    if (monaco.Range.areIntersectingOrTouching(sel, tar)) {
        tar = monaco.Range.plusRange(sel, tar);
    }
    ctx.vimState.previousVisual = {kind: 'char', start: tar.getStartPosition(), end: tar.getEndPosition()};
    ctx.editor.setSelection(tar);
    ctx.editor.revealPosition(pos);
    ctx.vimState.isMovingCursorByMotion = false;
});

let exchange = createCommand((ctx, mst) => {
    let sel = ctx.editor.getSelection()!;
    let start = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let end = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
    let newSel = monaco.Selection.fromPositions(start, end);
    ctx.vimState.previousVisual = {kind: 'char', start, end};
    ctx.editor.setSelection(newSel);
    ctx.editor.revealRange(newSel);
});

let quit = createCommand((ctx, mst) => {
    ctx.vimState.toNormal();
});

let toLine = createCommand((ctx, mst) => {
    let sel = ctx.editor.getSelection()!;
    ctx.vimState.toVisualLine({first: sel.selectionStartLineNumber, last: sel.positionLineNumber});
});

function createProgram() {
    let patt = P.alternateList([
        P.concat(motionPattern, P.setCommand(moveCursor)),
        P.concat(objectSelectionPattern, P.setCommand(selectObject)),
        P.concat(P.common.countPart, P.alternateList([
            visualOperatorPattern,
            actionsPattern,
            P.concat(P.key('o'), P.setCommand(exchange)),
            P.concat(keyUtils.parseToPattern('<ESC>'), P.setCommand(quit)),
            P.concat(P.key('v'), P.setCommand(quit)),
            P.concat(P.key('V'), P.setCommand(toLine)),
        ])),
    ]);
    // return new Program(P.concat(P.common.registerPart, patt));
    return new Program(patt);
}

const program = createProgram();

export class VisualMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

    private decorations?: string[];

    constructor(context: ICommandContext) {
        super('Visual', 'Visual', context);
    }

    get program() {
        return program;
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
