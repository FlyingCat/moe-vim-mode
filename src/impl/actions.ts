import { registerCommand } from "../boot/registry";
import * as monaco from "monaco-editor";
import { recorder } from "../recorder";
import { ICommandContext, ICommandArgs, applyMotion, CommandFunction } from "../boot/base";
import * as P from "../matching/pattern";
import { PositionLiveType } from "../text/position";
import { executeExCommand } from "../exCommand";
import { setMarkByName } from "./sp/mark";
import { mergePositions, mergeSelections, mergeLineRanges, mergeLineSelections } from "../utils/helper";

//#region Normal Mode
registerCommand('i', 'n', function (ctx, args) {
    ctx.editor.revealPosition(ctx.editor.getPosition()!);
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('I', 'n', function (ctx, args) {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    let cursors = selections.map(x => {
        let pos = ctx.position.get(x.getPosition().lineNumber, '^');
        return monaco.Selection.fromPositions(pos);
    });
    ctx.editor.setSelections(cursors);
    ctx.editor.revealRange(cursors[0]);
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('a', 'n', function (ctx, args) {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    let cursors = selections.map(x => {
        let pos = ctx.position.get(x.getPosition()).shouldWrap(false).move(1);
        return monaco.Selection.fromPositions(pos);
    })
    ctx.editor.setSelections(cursors);
    ctx.editor.revealRange(cursors[0]);
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('A', 'n', function (ctx, args) {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    let curosrs = selections.map(x => {
        let pos = ctx.position.get(x.getPosition().lineNumber, 'eol');
        return monaco.Selection.fromPositions(pos);
    });
    ctx.editor.setSelections(curosrs);
    ctx.editor.revealRange(curosrs[0]);
    ctx.vimState.desiredColumn = 'eol';
    ctx.vimState.toInsert({ command: this, args }, 'text');
});
registerCommand('o', 'n', function (ctx, args) {
    ctx.editor.getAction('editor.action.insertLineAfter').run();
    ctx.vimState.toInsert({ command: this, args }, 'command');
});
registerCommand('O', 'n', function (ctx, args) {
    ctx.editor.getAction('editor.action.insertLineBefore').run();
    ctx.vimState.toInsert({ command: this, args }, 'command')
});
registerCommand('v', 'n', (ctx, args) => {
    let cursors =  ctx.editor.getSelections();
    if (!cursors) {
        return;
    }
    let count = args.count || 0;
    let selections = cursors.map(x => {
        let pos = ctx.position.get(x.getPosition());
        let end = pos.clone().shouldWrap(false).move(count);
        return monaco.Selection.fromPositions(pos, end);
    });
    selections = mergeSelections(selections);
    ctx.vimState.toVisual(selections);
});
registerCommand('V', 'n', (ctx, args) => {
    let cursors =  ctx.editor.getSelections();
    if (!cursors) {
        return;
    }
    let count = args.count || 1;
    let ranges = cursors.map(x => {
        let first = x.getPosition().lineNumber;
        let last = first + count - 1;
        return { first, last };
    });
    ranges = mergeLineRanges(ranges);
    ctx.vimState.toVisualLine(ranges);
});
registerCommand('gv', 'n', (ctx, args) => {
    let previous = ctx.vimState.previousVisual;
    if (previous === undefined) {
        ctx.vimState.beep();
    }
    else if (previous.kind === 'char') {
        let start = ctx.position.get(previous.start);
        let end = ctx.position.get(previous.end);
        ctx.vimState.toVisual([monaco.Selection.fromPositions(start, end)]);
    }
    else {
        ctx.vimState.toVisualLine([previous]);
    }
});
registerCommand('.', 'n', (ctx, mst) => {
    recorder.repeatLast(ctx, mst.count);
});

registerCommand(P.holders.motion, '~n', (ctx, mst) => {
    const selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    if (!mst.motion) {
        throw new Error();
    }
    ctx.vimState.isMovingCursorByMotion = true;
    let failedCount = 0;
    let primaryPos = ctx.editor.getPosition()!;
    if (mst.motion.makeSelection !== true) {
        let cursors = selections.map((x, i) => {
            let result = applyMotion('Move', ctx, mst, x.getPosition());
            if (result) {
                let pos = ctx.position.get(result.to.lineNumber, result.to.column).soft();
                if (i === 0) {
                    if (result.isJump && !monaco.Position.equals(primaryPos, pos)) {
                        setMarkByName(ctx, "'", primaryPos);
                    }
                    if (result.keepPrevDesiredColumn !== true) {
                        ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
                    }
                }
                return pos;
            }
            else {
                failedCount++;
                return x.getPosition();
            }
        });
        if (failedCount === cursors.length) {
            ctx.vimState.beep();
        }
        ctx.editor.setSelections(mergePositions(cursors).map(x => monaco.Selection.fromPositions(x, x)));
        ctx.editor.revealPosition(cursors[0]);
    }
    else {
        let newSelections: monaco.Selection[] = [];
        selections.forEach(x => {
            let result = applyMotion('Move', ctx, mst, x.getPosition());
            if (result) {
                let ltr = monaco.Position.isBeforeOrEqual(result.from, result.to);
                let start = ltr || !result.inclusive ? result.from : ctx.position.get(result.from).move(1);
                let end = !ltr || !result.inclusive ? result.to : ctx.position.get(result.to).move(1);
                newSelections.push(monaco.Selection.fromPositions(start, end));
            }
        });
        if (newSelections.length > 0) {
            if (mst.motion.keepPrevDesiredColumn !== true) {
                ctx.vimState.desiredColumn = mst.motion.desiredColumnAtEol ? 'eol' : newSelections[0].getPosition().column;
            }
            ctx.vimState.toVisual(newSelections)
            ctx.editor.revealRange(newSelections[0]);
        }
        else {
            ctx.vimState.beep();
        }
    }
    ctx.vimState.isMovingCursorByMotion = false;
});
//#endregion


//#region Visual Mode
registerCommand(P.holders.motion, '~V', (ctx, mst) => {
    const selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    ctx.vimState.isMovingCursorByMotion = true;
    let failedCount = 0;
    let primaryPos = ctx.editor.getPosition()!;
    let newSelections = selections.map((x, i) => {
        let selectionStart = new monaco.Position(x.selectionStartLineNumber, x.selectionStartColumn);
        let result = applyMotion('Select', ctx, mst, x.getPosition());
        if (result) {
            let pos = monaco.Position.isBeforeOrEqual(selectionStart, result.to) && result.inclusive ? ctx.position.get(result.to).move(1) : result.to;
            if (i === 0) {
                if (result.isJump && !monaco.Position.equals(primaryPos, pos)) {
                    setMarkByName(ctx, "'", primaryPos);
                }
                if (result.keepPrevDesiredColumn !== true) {
                    ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
                }
                ctx.vimState.previousVisual = {kind: 'char', start: selectionStart, end: pos};
            }
            return monaco.Selection.fromPositions(selectionStart, pos);
        }
        else {
            failedCount++;
            return x;
        }
    });
    if (failedCount === selections.length) {
        ctx.vimState.beep();
    }
    else {
        // newSelections = mergeSelections(selections);
        ctx.editor.setSelections(newSelections);
    }
    ctx.editor.revealPosition(newSelections[0].getPosition());
    ctx.vimState.isMovingCursorByMotion = false;
});

registerCommand(P.holders.TextObject, 'V', (ctx, mst) => {
    const selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    ctx.vimState.isMovingCursorByMotion = true;
    let failedCount = 0;
    let newSelections = selections.map((x, i) => {
        let result = applyMotion('Select', ctx, mst, x.getPosition());
        if (result) {
            let pos = ctx.position.get(result.to).move(1);
            if (result.keepPrevDesiredColumn !== true) {
                ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
            }
            let tar = monaco.Range.fromPositions(result.from, pos);
            if (monaco.Range.areIntersectingOrTouching(x, tar)) {
                tar = monaco.Range.plusRange(x, tar);
            }
            if (i === 0) {
                if (result.keepPrevDesiredColumn !== true) {
                    ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
                }
                ctx.vimState.previousVisual = {kind: 'char', start: tar.getStartPosition(), end: tar.getEndPosition()};
            }
            return monaco.Selection.fromPositions(tar.getStartPosition(), tar.getEndPosition());
        }
        else {
            failedCount++;
            return x;
        }
    });
    if (failedCount === selections.length) {
        ctx.vimState.beep();
    }
    else {
        // newSelections = mergeSelections(selections);
        ctx.editor.setSelections(newSelections);
    }
    ctx.editor.revealPosition(newSelections[0].getPosition());
    ctx.vimState.isMovingCursorByMotion = false;
});

registerCommand('o', 'V', (ctx, mst) => {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    let newSelections = selections.map((sel, index) => {
        let start = {lineNumber: sel.positionLineNumber, column: sel.positionColumn};
        let end = {lineNumber: sel.selectionStartLineNumber, column: sel.selectionStartColumn};
        if (index === 0) {
            ctx.vimState.previousVisual = {kind: 'char', start, end};
        }
        return monaco.Selection.fromPositions(start, end);
    });
    ctx.editor.setSelections(newSelections);
    ctx.editor.revealRange(newSelections[0]);
});

registerCommand('<ESC>, v', 'V', (ctx, mst) => {
    ctx.vimState.toNormal();
});

registerCommand('V', 'V', (ctx, mst) => {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    ctx.vimState.toVisualLine(selections.map(x => ({first: x.selectionStartLineNumber, last: x.positionLineNumber})));
});
//#endregion


//#region VisualLine Mode
registerCommand(P.holders.motion, '~L', (ctx, mst) => {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    ctx.vimState.isMovingCursorByMotion = true;
    let failedCount = 0;
    let newLineSelections = selections.map((x, i) => {
        let start: monaco.IPosition = {lineNumber: x.selectionStartLineNumber, column: x.selectionStartColumn};
        let cursor: monaco.IPosition = {lineNumber: x.positionLineNumber, column: x.positionColumn};
        let result = applyMotion('Move', ctx, mst, cursor);
        if (result) {
            let target = monaco.Position.isBeforeOrEqual(start, result.to) && result.inclusive ? ctx.position.get(result.to).move(1) : result.to;
            if (result.keepPrevDesiredColumn !== true) {
                ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
            }
            return {start: start.lineNumber, target: target.lineNumber};
        }
        else {
            failedCount++;
            return {start: start.lineNumber, target: cursor.lineNumber};
        }
    });
    if (failedCount === selections.length) {
        ctx.vimState.beep();
    }
    else {
        newLineSelections = mergeLineSelections(newLineSelections);
        selections = newLineSelections.map(x => {
            let e: monaco.IPosition;
            if (x.start <= x.target) {
                let s = ctx.position.get(x.start, 1);
                e = ctx.position.get(x.target, 'eol');
                return monaco.Selection.fromPositions(s, e);
            }
            else {
                let s = ctx.position.get(x.start, 'eol');
                e = ctx.position.get(x.target, 1);
                return monaco.Selection.fromPositions(s, e);
            }
        });
        ctx.editor.setSelections(selections);
    }
    ctx.editor.revealRange(selections[0]);
    ctx.vimState.isMovingCursorByMotion = false;
    ctx.vimState.previousVisual = {kind: 'line', first: selections[0].selectionStartLineNumber, last: selections[0].positionLineNumber};
});

registerCommand('o', 'L', (ctx, mst) => {
    let selections = ctx.editor.getSelections();
    if (!selections) {
        return;
    }
    let newSelections = selections.map((sel, index) => {
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
        if (index === 0) {
            ctx.vimState.previousVisual = {kind: 'line', first: start.lineNumber, last: end.lineNumber};
        }
        return monaco.Selection.fromPositions(start, end);
    });
    ctx.editor.setSelections(newSelections);
    ctx.editor.revealRange(newSelections[0]);
});

registerCommand('<ESC>, V', 'L', (ctx, mst) => {
    ctx.vimState.toNormal();
});

registerCommand('v', 'L', (ctx, mst) => {
    let sel = ctx.editor.getSelections();
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
registerCommand('gb', 'nv', (ctx, mst) => {
    ctx.editor.trigger('vim', 'editor.action.addSelectionToNextFindMatch', null);
    let selections = ctx.editor.getSelections();
    if (selections && selections.every(x => !x.isEmpty())) {
        ctx.vimState.toVisual();
    }
});

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
