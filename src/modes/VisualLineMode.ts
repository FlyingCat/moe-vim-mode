import { IEventSink } from "../types";
import { Mode, ModeBase } from "./Mode";
import { applyMotion } from "../utils/helper";
import * as P from "../matching/pattern";
import * as keyUtils from "../utils/key";
import { motionPattern } from "../motions";
import { Program } from "../matching/program";
import { KeyCode } from "../utils/KeyCode";
import { recorder } from "../recorder";
import { visualOperatorPattern } from "../operations";
import { createCommand, ICommandContext, executeCommand } from "../command";
import { configuration } from "../configuration";
import * as monaco from "monaco-editor";
import { actionsPattern } from "../actions";

const escKey = keyUtils.pack(KeyCode.Escape);

let moveCursor = createCommand((ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let sel = ctx.editor.getSelection();
    if (!sel) {
        return;
    }
    let start: monaco.IPosition = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
    let cursor: monaco.IPosition = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let result = applyMotion('Select', ctx, mst, cursor);
    if (!result.to) {
        ctx.vimState.beep();
        return;
    }
    let target = result.inclusive ? ctx.position.get(result.to).move(1) : result.to;
    if (result.keepPrevDesiredColumn !== true) {
        ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
    }
    let e: monaco.IPosition;
    if (start.lineNumber <= target.lineNumber) {
        let s = ctx.position.get(start.lineNumber, 1);
        e = ctx.position.get(target.lineNumber, 'eol');
        ctx.editor.setSelection(monaco.Selection.fromPositions(s, e));
    }
    else {
        let s = ctx.position.get(start.lineNumber, 'eol');
        e = ctx.position.get(target.lineNumber, 1);
        ctx.editor.setSelection(monaco.Selection.fromPositions(s, e));
    }
    ctx.editor.revealPosition(e);
    ctx.vimState.isMovingCursorByMotion = false;
    ctx.vimState.previousVisual = {kind: 'line', first: start.lineNumber, last: target.lineNumber};
});

let exchange = createCommand((ctx, mst) => {
    let sel = ctx.editor.getSelection();
    if (!sel) {
        return;
    }
    let first = sel.positionLineNumber;
    let last = sel.selectionStartLineNumber;
    let start: monaco.IPosition;
    let end: monaco.IPosition;
    if (first <= last) {
        start = ctx.position.get(first, 1);
        end = ctx.position.get(last, 'eol');
    }
    else {
        start = ctx.position.get(first, 'eol');
        end = ctx.position.get(last, 1);
    }
    ctx.vimState.previousVisual = {kind: 'line', first: start.lineNumber, last: end.lineNumber};
    let newSel = monaco.Selection.fromPositions(start, end);
    ctx.editor.setSelection(newSel);
    ctx.editor.revealRange(newSel);
});

let quit = createCommand((ctx, mst) => {
    ctx.vimState.toNormal();
});

let toChar = createCommand((ctx, mst) => {
    let sel = ctx.editor.getSelection();
    if (!sel) {
        return;
    }
    ctx.vimState.toVisual(sel);
});

function createProgram() {
    let patt = P.alternateList([
        P.concat(motionPattern, P.setCommand(moveCursor)),
        P.concat(P.common.countPart, P.alternateList([
            visualOperatorPattern,
            actionsPattern,
            P.concat(P.key('o'), P.setCommand(exchange)),
            P.concat(keyUtils.parseToPattern('<ESC>'), P.setCommand(quit)),
            P.concat(P.key('V'), P.setCommand(quit)),
            P.concat(P.key('v'), P.setCommand(toChar)),
        ]) ),
    ]);
    return new Program(P.concat(P.common.registerPart, patt));
}

const program = createProgram();

export class VisualLineMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

    constructor(context: ICommandContext) {
        super('VisualLine', 'Visual Line', context);
    }

    get program() {
        return program;
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
