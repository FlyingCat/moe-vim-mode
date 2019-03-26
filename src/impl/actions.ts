import { registerCommand } from "../boot/registry";
import * as monaco from "monaco-editor";
import { recorder } from "../recorder";
import { ICommandContext, ICommandArgs, applyMotion, CommandFunction } from "../boot/base";
import * as P from "../matching/pattern";
import { PositionLiveType } from "../text/position";
import { executeExCommand } from "../exCommand";
import { setMarkByName } from "./sp/mark";

//#region Normal Mode
registerCommand('i', 'n', function (ctx, args) {
    ctx.editor.revealPosition(ctx.editor.getPosition()!);
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('I', 'n', function (ctx, args) {
    let cursor = ctx.editor.getPosition()!;
    let pos = ctx.position.get(cursor.lineNumber, '^');
    ctx.editor.setPosition(pos);
    ctx.editor.revealPosition(pos);
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('a', 'n', function (ctx, args) {
    let cursor = ctx.editor.getPosition()!;
    let pos = ctx.position.get().shouldWrap(false).move(1);
    ctx.editor.setPosition(pos);
    ctx.editor.revealPosition(pos);
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('A', 'n', function (ctx, args) {
    let cursor = ctx.editor.getPosition()!;
    let pos = ctx.position.get(cursor.lineNumber, 'eol');
    ctx.editor.setPosition(pos);
    ctx.editor.revealPosition(pos);
    ctx.vimState.desiredColumn = 'eol';
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('o', 'n', function (ctx, args) {
    ctx.editor.getAction('editor.action.insertLineAfter').run();
    let cursor = ctx.editor.getPosition()!;
    ctx.vimState.toInsert({ command: this, args }, 'command');
});
registerCommand('O', 'n', function (ctx, args) {
    ctx.editor.getAction('editor.action.insertLineBefore').run();
    let cursor = ctx.editor.getPosition()!;
    ctx.vimState.toInsert({ command: this, args }, 'command')
});
registerCommand('v', 'n', (ctx, args) => {
    let count = args.count || 0;
    let pos = ctx.position.get();
    let end = pos.clone().shouldWrap(false).move(count);
    ctx.vimState.toVisual(monaco.Selection.fromPositions(pos, end));
});
registerCommand('V', 'n', (ctx, args) => {
    let count = args.count || 1;
    let first = ctx.editor.getPosition()!.lineNumber;
    let last = first + count - 1;
    ctx.vimState.toVisualLine({ first, last });
});
registerCommand('gv', 'n', (ctx, args) => {
    let previous = ctx.vimState.previousVisual;
    if (previous === undefined) {
        ctx.vimState.beep();
    }
    else if (previous.kind === 'char') {
        let start = ctx.position.get(previous.start);
        let end = ctx.position.get(previous.end);
        ctx.vimState.toVisual(monaco.Selection.fromPositions(start, end));
    }
    else {
        ctx.vimState.toVisualLine(previous);
    }
});
registerCommand('.', 'n', (ctx, mst) => {
    recorder.repeatLast(ctx, mst.count);
});
registerCommand('gd', 'n', (ctx, mst) => {
    ctx.editor.trigger('vim', 'editor.action.goToDeclaration', null);
});
registerCommand('gh', 'n', (ctx, mst) => {
    // BUG: once show context menu, then this never works
    ctx.editor.trigger('vim', 'editor.action.showHover', null);
    // let action = ctx.editor.getAction('editor.action.showHover');
    // if (action) {
    //     return action.run();
    // }
});
registerCommand('gl', 'n', (ctx, mst) => {
    ctx.editor.trigger('vim', 'editor.action.wordHighlight.trigger', null);
});

registerCommand(P.holders.motion, '~n', (ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let result = applyMotion('Move', ctx, mst);
    let cursorPos = ctx.position.get();
    if (result) {
        let pos = ctx.position.get(result.to.lineNumber, result.to.column).soft();
        if (result.isJump && !monaco.Position.equals(cursorPos, pos)) {
            setMarkByName(ctx, "'", cursorPos);
        }
        ctx.editor.setPosition(pos);
        ctx.editor.revealPosition(pos);
        if (result.keepPrevDesiredColumn !== true) {
            ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
        }
    }
    else {
        ctx.vimState.beep();
    }
    ctx.vimState.isMovingCursorByMotion = false;
});
//#endregion


//#region Visual Mode
registerCommand(P.holders.motion, '~V', (ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let sel = ctx.editor.getSelection()!;
    let start: monaco.IPosition = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
    let cursor: monaco.IPosition = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let result = applyMotion('Select', ctx, mst, cursor);
    if (!result) {
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

registerCommand(P.holders.TextObject, 'V', (ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let sel = ctx.editor.getSelection()!;
    let cursor: monaco.IPosition = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let result = applyMotion('Select', ctx, mst, cursor);
    if (!result) {
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

registerCommand('o', 'V', (ctx, mst) => {
    let sel = ctx.editor.getSelection()!;
    let start = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let end = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
    let newSel = monaco.Selection.fromPositions(start, end);
    ctx.vimState.previousVisual = {kind: 'char', start, end};
    ctx.editor.setSelection(newSel);
    ctx.editor.revealRange(newSel);
});

registerCommand('<ESC>, v', 'V', (ctx, mst) => {
    ctx.vimState.toNormal();
});

registerCommand('V', 'V', (ctx, mst) => {
    let sel = ctx.editor.getSelection()!;
    ctx.vimState.toVisualLine({first: sel.selectionStartLineNumber, last: sel.positionLineNumber});
});
//#endregion


//#region VisualLine Mode
registerCommand(P.holders.motion, '~L', (ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let sel = ctx.editor.getSelection();
    if (!sel) {
        return;
    }
    let start: monaco.IPosition = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
    let cursor: monaco.IPosition = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
    let result = applyMotion('Select', ctx, mst, cursor);
    if (!result) {
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

registerCommand('o', 'L', (ctx, mst) => {
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

registerCommand('<ESC>, V', 'L', (ctx, mst) => {
    ctx.vimState.toNormal();
});

registerCommand('v', 'L', (ctx, mst) => {
    let sel = ctx.editor.getSelection();
    if (!sel) {
        return;
    }
    ctx.vimState.toVisual(sel);
});
//#endregion

//#region scrolling
function scroll(ctx: ICommandContext, args: ICommandArgs, to: 'down' | 'up', by: 'line' | 'page') {
    let pos = ctx.position.get();
    let count = args.count || 1;
    ctx.editor.trigger('vim', 'editorScroll', { to, by, value: count });
    let visibleRanges = ctx.editor.getVisibleRanges();
    if (visibleRanges.length > 0) {
        let firstLine = visibleRanges[0].startLineNumber;
        let lastLine = visibleRanges[0].endLineNumber;
        if (!(pos.lineNumber >= firstLine && pos.lineNumber <= lastLine)) {
            pos = ctx.position.get(to === 'down' ? firstLine : lastLine, pos.column);
            let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
            pos.live(liveType);
        }
    }
}

function scrollHalfPage(ctx: ICommandContext, args: ICommandArgs, to: 'down' | 'up') {
        let pos = ctx.position.get();
        let lineOffset = 0;
        let visibleRanges = ctx.editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
            let firstLine = visibleRanges[0].startLineNumber;
            let lastLine = visibleRanges[0].endLineNumber;
            if (pos.lineNumber >= firstLine && pos.lineNumber < lastLine) {
                lineOffset = pos.lineNumber - firstLine;
            }
        }
        let count = args.count || 1;
        ctx.editor.trigger('vim', 'editorScroll', {to, by: 'halfPage', value: count});
        visibleRanges = ctx.editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
            pos = ctx.position.get(visibleRanges[0].startLineNumber + lineOffset, pos.column);
            let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
            pos.live(liveType);
        }
}

const commands: {[k: string]: CommandFunction} = {
    '<C-E>': (ctx, args) => {
        scroll(ctx, args, 'down', 'line');
    },
    '<C-D>': (ctx, args) => {
        scrollHalfPage(ctx, args, 'down');
    },
    '<C-F>': (ctx, args) => {
        scroll(ctx, args, 'down', 'page');
    },
    'z+': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let line = args.count || ctx.editor.getVisibleRanges()[0].endLineNumber + 1;
        let pos = ctx.position.get(line, '^');
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'top'});
        pos.reveal().live(liveType);
    },
    '<C-Y>': (ctx, args) => {
        scroll(ctx, args, 'up', 'line');
    },
    '<C-U>': (ctx, args) => {
        scrollHalfPage(ctx, args, 'up');
    },
    '<C-B>': (ctx, args) => {
        scroll(ctx, args, 'up', 'page');
    },
    'z^': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let line = args.count || ctx.editor.getVisibleRanges()[0].startLineNumber - 1;
        let pos = ctx.position.get(line, '^');
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'bottom'});
        pos.reveal().live(liveType);
    },
    'z<CR>': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, '^');
        }
        else {
            pos.setColumn('^');
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'top'});
        pos.reveal().live(liveType);
    },
    'zt': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, pos.column);
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'top'});
        pos.reveal().live(liveType);
    },
    'z.': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, '^');
        }
        else {
            pos.setColumn('^');
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'center'});
        pos.reveal().live(liveType);
    },
    'zz': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, pos.column);
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'center'});
        pos.reveal().live(liveType);
    },
    'z-': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, '^');
        }
        else {
            pos.setColumn('^');
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'bottom'});
        pos.reveal().live(liveType);
    },
    'zb': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, pos.column);
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'bottom'});
        pos.reveal().live(liveType);
    },
};

for (let k in commands) {
    registerCommand(k, 'nv', commands[k]);
}
//#endregion

registerCommand(':', 'nv', (ctx, mst) => {
    let text = '';
    if (ctx.vimState.isVisual()) {
        text = "'<,'>";
    }
    else {
        if (mst.count === 1) {
            text = '.';
        }
        else if (mst.count) {
            text = '.,.+' + (mst.count - 1).toString();
        }
    }
    ctx.vimState.requestExternalInput(':', text, () => {}).then(text => {
        if (!text) {
            return;
        }
        executeExCommand(ctx, text);
    });
});
