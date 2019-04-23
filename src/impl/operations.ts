import * as P from "../matching/pattern";
import * as helper from "../utils/helper";
import { spMotion } from "./motions";
import { registerManager } from "../registerManager";
import { CursorKind } from "../text/position";
import { recorder } from "../recorder";
import { ICommandContext, ICommandArgs, ICommand, IMotion } from "../boot/base";
import * as monaco from "monaco-editor";
import { addExRangeCommand } from "../exCommand";
import { addHistoryPatch } from "./sp/history";
import { registerCommand } from "../boot/registry";
import { configuration } from "../configuration";

type LineRange = {
    first: number;
    last: number;
}

const enum RangeSource {
    ByCount, // {count} chars or lines
    ByLine, // d3d
    Motion,
    Visual,
}

//#region utils
function charFromLine(ctx: ICommandContext, lines: LineRange): monaco.Range {
    let start = {lineNumber: lines.first, column: 1};
    let end = {lineNumber: lines.last, column: ctx.model.getLineMaxColumn(lines.last)};
    return monaco.Range.fromPositions(start, end);
}

function lineFromChar(ctx: ICommandContext, range: monaco.IRange): LineRange {
    if (range.endColumn === 1 && range.startLineNumber !== range.endLineNumber) {
        return { first: range.startLineNumber, last: range.endLineNumber - 1 };
    }
    else {
        return { first: range.startLineNumber, last: range.endLineNumber };
    }
}

function selectionFromLine(ctx: ICommandContext, lines: LineRange) {
    let start = {lineNumber: lines.first, column: 1};
    let end = {lineNumber: lines.last, column: ctx.model.getLineMaxColumn(lines.last)};
    return monaco.Selection.fromPositions(start, end);
}

function pushEdits(ctx: ICommandContext, edits: monaco.editor.IIdentifiedSingleEditOperation[], cursors: monaco.editor.ICursorStateComputer) {
    ctx.editor.pushUndoStop();
    let r = ctx.model.pushEditOperations(ctx.editor.getSelections() || [], edits, cursors);
    if (r) {
        ctx.editor.setSelections(r);
    }
    ctx.editor.pushUndoStop();
}
//#endregion

//#region registration
type Operator = {
    isEdit?: boolean;
    shouldRecord?: boolean;
    isInserting?: boolean;
    mergeTouchedLineRanges?: boolean;
    runWithCursor?(ctx: ICommandContext, positions: monaco.IPosition[], commandArgs: ICommandArgs): void | PromiseLike<void>;
    runWithLineRange?(ctx: ICommandContext, lineRanges: LineRange[], source: RangeSource, commandArgs: ICommandArgs): void | PromiseLike<void>;
    runWithCharRange?(ctx: ICommandContext, charRanges: monaco.IRange[], source: RangeSource, commandArgs: ICommandArgs): void | PromiseLike<void>;
}

function ncmdCountChar(op: Operator, key: string | [string, P.Pattern]) {
    let isEdit = op.isEdit !== false;
    let shouldRecord = isEdit && op.shouldRecord !== false;
    let command: ICommand = {shouldRecord, run(ctx, args) {
        if (!op.runWithCharRange) {
            throw new Error();
        }
        let selections = ctx.editor.getSelections();
        if (!selections) {
            return;
        }
        let ranges = selections.map(x => {
            let start = x.getPosition();
            let end = ctx.position.get(start).setColumn(start.column + (args.count || 1));
            return monaco.Range.fromPositions(start, end);
        });
        ranges = helper.mergeRanges(ranges);
        if (isEdit) {
            ctx.editor.pushUndoStop();
        }
        return helper.doThen(op.runWithCharRange(ctx, ranges, RangeSource.ByCount, args), () => {
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command, args}, 'none');
            }
            ctx.position.get().reveal();
        })
    }};
    registerCommand(key, 'n', command);
}

function ncmdCountLine(op: Operator, key: string | [string, P.Pattern, string], source: RangeSource.ByCount | RangeSource.ByLine) {
    let isEdit = op.isEdit !== false;
    let shouldRecord = isEdit && op.shouldRecord !== false;
    let command: ICommand = {shouldRecord, run(ctx, args) {
        if (!op.runWithLineRange) {
            throw new Error();
        }
        let selections = ctx.editor.getSelections();
        if (!selections) {
            return;
        }
        let ranges = selections.map(x => {
            let first = x.getPosition().lineNumber;
            let last = Math.min(ctx.model.getLineCount(),  first + (args.count || 1) - 1);
            return { first, last };
        });
        ranges = helper.mergeLineRanges(ranges, op.mergeTouchedLineRanges);
        return helper.doThen(op.runWithLineRange(ctx, ranges, source, args), () => {
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command, args}, 'none');
            }
            ctx.position.get().reveal();
        })
    }};
    registerCommand(key, 'n', command);
}

function ncmdCursor(op: Operator, key: string) {
    let isEdit = op.isEdit !== false;
    let shouldRecord = isEdit && op.shouldRecord !== false;
    let command: ICommand = {shouldRecord, run(ctx, args) {
        if (!op.runWithCursor) {
            throw new Error();
        }
        let selections = ctx.editor.getSelections();
        if (!selections) {
            throw new Error();
        }
        let positions = selections.map(x => x.getPosition());
        return helper.doThen(op.runWithCursor(ctx, positions, args), () => {
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command, args}, 'none');
            }
            ctx.position.get().reveal();
        });
    }};
    registerCommand(key, 'n', command);
}

function vcmdChar(op: Operator, key: string | [string, P.Pattern]) {
    let isInserting = op.isInserting === true;
    let command: ICommand = { run(ctx, args) {
        if (!op.runWithCharRange) {
            throw new Error();
        }
        let selections = ctx.editor.getSelections();
        if (!selections) {
            throw new Error();
        }
        // at least select one character
        let charRanges: monaco.IRange[] = selections.map(x => {
            if (x.isEmpty()) {
                let start = x.getPosition();
                let end = ctx.position.get(start).move(1);
                return monaco.Range.fromPositions(start, end);
            }
            else {
                return x;
            }
        });
        let length = Math.max(1, ctx.model.getValueLengthInRange(charRanges[0]));
        return helper.doThen(op.runWithCharRange(ctx, charRanges, RangeSource.Visual, args), () => {
            if (!isInserting) {
                let clonedArgs = Object.assign({}, args);
                recorder.setLastAction({
                    setCount() { },
                    execute(ctx) {
                        let selections = ctx.editor.getSelections();
                        if (!selections) {
                            return;
                        }
                        let ranges = selections.map(x => {
                            let start = x.getPosition();
                            let end = ctx.position.get(start).move(length);
                            return monaco.Range.fromPositions(start, end);
                        });
                        ranges = helper.mergeRanges(ranges);
                        return op.runWithCharRange!(ctx, ranges, RangeSource.Visual, args);
                    }
                });
            }
            ctx.position.get().reveal();
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command: {run(ctx, args) {
                    let selections = ctx.editor.getSelections();
                    if (!selections) {
                        return;
                    }
                    let ranges = selections.map(x => {
                        let start = x.getPosition();
                        let end = ctx.position.get(start).move(length);
                        return monaco.Range.fromPositions(start, end);
                    });
                    ranges = helper.mergeRanges(ranges);
                    return op.runWithCharRange!(ctx, ranges, RangeSource.Visual, args);
                }}, args: Object.assign({}, args)}, 'none');
            }
            else {
                ctx.vimState.toNormal();
            }
        });
    }};
    registerCommand(key, 'V', command);
}

function vcmdLine(op: Operator, key: string | [string, P.Pattern]) {
    let isInserting = op.isInserting === true;
    let command: ICommand = { run(ctx, args) {
        if (!op.runWithLineRange) {
            throw new Error();
        }
        let selections = ctx.editor.getSelections();
        if (!selections) {
            throw new Error();
        }
        let ranges = selections.map(x => ({
            first: x.getStartPosition().lineNumber,
            last: x.getEndPosition().lineNumber
        }));
        let count = ranges[0].last - ranges[0].first + 1;
        return helper.doThen(op.runWithLineRange(ctx, ranges, RangeSource.Visual, args), () => {
            if (!isInserting) {
                let clonedArgs = Object.assign({}, args);
                recorder.setLastAction({
                    setCount() { },
                    execute(ctx) {
                        let selections = ctx.editor.getSelections();
                        if (!selections) {
                            return;
                        }
                        let ranges = selections.map(x => {
                            let first = x.getPosition().lineNumber;
                            let last = Math.min(ctx.model.getLineCount(), first + count - 1);
                            return { first, last };
                        });
                        ranges = helper.mergeLineRanges(ranges, op.mergeTouchedLineRanges);
                        return op.runWithLineRange!(ctx, ranges, RangeSource.Visual, args);
                    }
                });
            }
            ctx.position.get().reveal();
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command: {run(ctx, args) {
                    let selections = ctx.editor.getSelections();
                    if (!selections) {
                        return;
                    }
                    let ranges = selections.map(x => {
                        let first = x.getPosition().lineNumber;
                        let last = Math.min(ctx.model.getLineCount(), first + count - 1);
                        return { first, last };
                    });
                    ranges = helper.mergeLineRanges(ranges, op.mergeTouchedLineRanges);
                    return op.runWithLineRange!(ctx, ranges, RangeSource.Visual, args);
                }}, args: Object.assign({}, args)}, 'none');
            }
            else {
                ctx.vimState.toNormal();
            }
        });
    }};
    registerCommand(key, 'L', command);
}

type MotionRange = {
    kind: 'Char';
    vary: boolean;
    ranges: monaco.IRange[];
} | {
    kind: 'Line';
    ranges: LineRange[];
}

function getMotionRange(ctx: ICommandContext, args: ICommandArgs, shouldMergeTouchedLines: boolean): MotionRange {
    const motion = args.motion;
    if (!motion) {
        throw new Error();
    }
    const selections = ctx.editor.getSelections();
    if (!selections) {
        throw new Error();
    }
    let count = args.count;
    let linewise = args.linewise !== undefined ? args.linewise : (motion.linewise === true);
    if (linewise) {
        let ranges: LineRange[] = [];
        selections.forEach(x => {
            let from : monaco.IPosition = x.getPosition();
            let to: monaco.IPosition;
            let ret = motion.run(ctx, from, count || 1, 'Operator', count === undefined, args);
            if (!ret) {
                return;
            }
            if (monaco.Position.isIPosition(ret)) {
                to = ret;
            }
            else {
                from = ret.from;
                to = ret.to;
            }
            ranges.push({ first: from.lineNumber, last: to.lineNumber });
        });
        ranges = helper.mergeLineRanges(ranges, shouldMergeTouchedLines);
        return { kind: 'Line', ranges };
    }
    else {
        let vary = 0;
        let ranges: monaco.Range[] = [];
        selections.forEach(x => {
            let from: monaco.IPosition = x.getPosition();
            let to: monaco.IPosition;
            let ret = motion.run(ctx, from, count || 1, 'Operator', count === undefined, args);
            if (!ret) {
                return;
            }
            if (monaco.Position.isIPosition(ret)) {
                to = ret;
            }
            else {
                from = ret.from;
                to = ret.to;
                if (ret.linewise === true) {
                    vary++;
                }
            }
            let ltr = monaco.Position.isBeforeOrEqual(from, to);
            let start = ltr ? from : to;
            let end = ltr ? to : from;
            ranges.push(monaco.Range.fromPositions(start, motion.inclusive ? ctx.position.get(end).move(1) : end));
        });
        if (vary === ranges.length) {
            let lineRanges = ranges.map(x => ({first: x.startLineNumber, last: x.endLineNumber}));
            lineRanges = helper.mergeLineRanges(lineRanges, shouldMergeTouchedLines);
            return { kind: 'Line', ranges: lineRanges };
        }
        else {
            ranges = helper.mergeRanges(ranges);
            return { kind: 'Char', vary: vary !== 0, ranges };
        }
    }
}

function ncmdMotion(op: Operator, key: string) {
    let isEdit = op.isEdit !== false;
    let shouldRecord = isEdit && op.shouldRecord !== false;
    let command: ICommand = { shouldRecord, run(ctx, args) {
        if (!op.runWithCharRange || !op.runWithLineRange) {
            throw new Error();
        }
        if (op.isInserting) {
            if (args.motion === spMotion.word) {
                args.motion = spMotion.altWord;
            }
            else if (args.motion === spMotion.fullWord) {
                args.motion = spMotion.altFullWord;
            }
        }
        let ret = getMotionRange(ctx, args, op.mergeTouchedLineRanges === true);
        if (ret.ranges.length === 0) {
            ctx.vimState.beep();
            return false;
        }
        return helper.doThen(ret.kind === 'Char' ? op.runWithCharRange(ctx, ret.ranges, RangeSource.Motion, args) : op.runWithLineRange(ctx, ret.ranges, RangeSource.Motion, args), () => {
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command, args}, 'none');
            }
            ctx.position.get().reveal();
        });
    }};
    registerCommand([key, {kind: 'OperatorMotionHolder'}], 'n', command);
}

function ncmdSynonym(op: Operator, key: string, motion: IMotion) {
    let isEdit = op.isEdit !== false;
    let shouldRecord = isEdit && op.shouldRecord !== false;
    let command: ICommand = { shouldRecord, run(ctx, args) {
        if (!op.runWithCharRange || !op.runWithLineRange) {
            throw new Error();
        }
        let ret = getMotionRange(ctx, {count: args.count, motion}, op.mergeTouchedLineRanges === true);
        if (ret.ranges.length === 0) {
            ctx.vimState.beep();
            return false;
        }
        return helper.doThen(ret.kind === 'Char' ? op.runWithCharRange(ctx, ret.ranges, RangeSource.Motion, args) : op.runWithLineRange(ctx, ret.ranges, RangeSource.Motion, args), () => {
            if (op.isInserting && !ctx.vimState.isRepeating) {
                ctx.vimState.toInsert({command, args}, 'none');
            }
            ctx.position.get().reveal();
        });
    }};
    registerCommand(key, 'n', command);
}

type Regkeys = {
    ncmdCountChar?: string | [string, P.Pattern], // {count}~
    ncmdCountLine?: string, // {count}J
    ncmdCursor?: string, // p
    nkey?: string, // d{motion}
    nline?: string | true, // d{count}d
    nsynonym?: { [k: string]: IMotion },
    vkey?: string | [string, P.Pattern],
    vline?: string, // linewise arg from charwise visual
};
function register(op: Operator, keys: Regkeys) {
    if (keys.ncmdCountChar) {
        ncmdCountChar(op, keys.ncmdCountChar);
    }
    if (keys.ncmdCountLine) {
        ncmdCountLine(op, keys.ncmdCountLine, RangeSource.ByCount);
    }
    if (keys.ncmdCursor) {
        ncmdCursor(op, keys.ncmdCursor);
    }
    if (keys.nkey) {
        ncmdMotion(op, keys.nkey);
    }
    if (keys.nkey && keys.nline) {
        let nline = keys.nline === true ? keys.nkey : keys.nline;
        ncmdCountLine(op, [keys.nkey, P.common.countPart, nline], RangeSource.ByLine);
    }
    if (keys.nsynonym) {
        for (const k in keys.nsynonym) {
            ncmdSynonym(op, k, keys.nsynonym[k]);
        }
    }
    if (keys.vkey) {
        vcmdChar(op, keys.vkey);
        vcmdLine(op, keys.vkey);
    }
    if (keys.vline) {
        vcmdLine(op, keys.vline);
    }
}
//#endregion

abstract class TextTransform implements Operator {
    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource) {
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = ranges.filter(x => !monaco.Range.isEmpty(x)).map(x => ({ range: monaco.Range.lift(x), text: this.transform(ctx.model.getValueInRange(x)) }));
        if (edits.length) {
            let endCursors = ranges.map(x => ctx.position.get(x.startLineNumber, x.startColumn).soft().toSelection());
            pushEdits(ctx, edits, () => endCursors);
        }
    }

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[]) {
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = ranges.map(x => {
            let range = charFromLine(ctx, x);
            return { range, text: this.transform(ctx.model.getValueInRange(range)) }
        });
        if (edits.length) {
            let endCursors = ranges.map(x => ctx.position.get(x.first, '^').toSelection());
            pushEdits(ctx, edits, () => endCursors);
        }
    }

    abstract transform(s: string): string;
}

class LowerCase extends TextTransform {
    transform(s: string) {
        return s.toLowerCase();
    }
}

register(new LowerCase(), { nkey: 'gu', nline: 'gu, u', vkey: 'gu, u' });

class UpperCase extends TextTransform {
    transform(s: string) {
        return s.toUpperCase();
    }
}

register(new UpperCase(), { nkey: 'gU', nline: 'gU, U', vkey: 'gU, U' });

class ToggleCase extends TextTransform {
    runWithCursor(ctx: ICommandContext, posiitons: monaco.IPosition[], args: ICommandArgs) {
        let count = args.count || 1;
        let noWrap = configuration.whichWrap.indexOf('~') < 0;
        let ranges = posiitons.map(x => {
            let pos = ctx.position.get(x);
            if (noWrap) {
                pos.shouldWrap(false).move(count);
            }
            else {
                let n = count;
                while (n > 0) {
                    if (pos.forward()) {
                        if (pos.kind === CursorKind.EOL) {
                            pos.forward();
                        }
                        n--;
                    }
                    else {
                        break;
                    }
                }
            }
            return monaco.Range.fromPositions(x, pos);
        });
        ranges = helper.mergeRanges(ranges);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = ranges.filter(x => !monaco.Range.isEmpty(x)).map(range => ({ range, text: this.transform(ctx.model.getValueInRange(range)) }));
        if (edits.length) {
            let endCursors = ranges.map(x => ctx.position.get(x.endLineNumber, x.endColumn).soft().toSelection());
            pushEdits(ctx, edits, () => endCursors);
        }
    }

    transform(s: string) {
        let text = '';
        let oriText = s;
        for (let i = 0; i < oriText.length; i++) {
            let char = oriText[i];
            let newChar = char.toLowerCase();
            if (newChar === char) {
                newChar = char.toUpperCase();
            }
            text += newChar;
        }
        return text;
    }
}

register(new ToggleCase(), { ncmdCursor: '~', nkey: 'g~', nline: 'g~, ~', vkey: 'g~, ~' });

class Indent implements Operator {
    constructor(readonly action: string) {
    }

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        let beforeVersionId = ctx.model.getAlternativeVersionId();
        let beforeCursor = ctx.editor.getSelections()!.map(x => x.getPosition());
        let selections = ranges.map(x => selectionFromLine(ctx, x))
        ctx.editor.setSelections(selections);
        let n = 1;
        if (source === RangeSource.Visual) {
            n = args.count || 1;
        }
        while (n !== 0) {
            ctx.editor.trigger('vim', this.action, null);
            n--;
        }
        let afterVersionId = ctx.model.getAlternativeVersionId();
        let endCursors = ranges.map(x => ctx.position.get(x.first, '^').toSelection());
        ctx.editor.setSelections(endCursors);
        addHistoryPatch(ctx, beforeVersionId, afterVersionId, beforeCursor, endCursors.map(x => x.getPosition()));
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        let lineRanges = ranges.map(x => lineFromChar(ctx, x));
        lineRanges = helper.mergeLineRanges(lineRanges);
        this.runWithLineRange(ctx ,lineRanges, source, args);
    }
}

register(new Indent('editor.action.indentLines'), { nkey: '>', vkey: '>', nline: true });
register(new Indent('editor.action.outdentLines'), { nkey: '<', vkey: '<', nline: true });

class Format implements Operator {
    async runWithLineRange(ctx: ICommandContext, ranges: LineRange[]) {
        let beforeVersionId = ctx.model.getAlternativeVersionId();
        let beforeCursor = ctx.editor.getSelections()!.map(x => x.getPosition());
        let action = ctx.editor.getAction('editor.action.formatSelection')
        if (!action) {
            throw new Error();
        }
        for (const range of ranges) {
            let selection = selectionFromLine(ctx, range);
            ctx.editor.setSelection(selection);
            await action.run();
        }
        let afterVersionId = ctx.model.getAlternativeVersionId();
        let endCursors = ranges.map(x => ctx.position.get(x.first, '^').toSelection());
        ctx.editor.setSelections(endCursors);
        addHistoryPatch(ctx, beforeVersionId, afterVersionId, beforeCursor, endCursors.map(x => x.getPosition()));
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[]) {
        let lineRanges = ranges.map(x => lineFromChar(ctx, x));
        lineRanges = helper.mergeLineRanges(lineRanges);
        return this.runWithLineRange(ctx ,lineRanges);
    }
}

register(new Format(), { nkey: '=', vkey: '=', nline: true });

abstract class JoinLinesBase implements Operator {
    abstract run(ctx: ICommandContext, ranges: LineRange[], primaryIndex: number): void;

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[]) {
        let lineCount = ctx.model.getLineCount();
        ranges = ranges.filter(x => x.first !== lineCount).map(x => x.first === x.last ? {first: x.first, last: x.first + 1} : x);
        if (ranges.length === 0) {
            ctx.vimState.beep();
            return;
        }
        ranges = helper.mergeLineRanges(ranges);
        let firstRange = ranges[0];
        ranges = ranges.sort((a, b) => a.first - b.first);
        this.run(ctx, ranges, ranges.indexOf(firstRange));
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[]) {
        let lineRanges = ranges.map(x => lineFromChar(ctx, x));
        lineRanges = helper.mergeLineRanges(lineRanges);
        this.runWithLineRange(ctx ,lineRanges);
    }
}

class JoinLinesPreserveSpaces extends JoinLinesBase {
    run(ctx: ICommandContext, ranges: LineRange[], primaryIndex: number) {
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursors: monaco.Selection[] = [];
        let lineRemoved = 0;
        ranges.forEach((range, index) => {
            let len = 0;
            for (let ln = range.first; ln < range.last; ln++) {
                let pos = ctx.position.get(ln, 'eol');
                len += ctx.model.getLineLength(ln);
                let range = monaco.Range.fromPositions(pos, {lineNumber: ln + 1, column: 1});
                edits.push({ range, text: null });
            }
            let lineNumber = range.first - lineRemoved;
            let column = ctx.model.getLineLength(range.last) === 0 ? len : len + 1;
            let curosr = monaco.Selection.fromPositions({ lineNumber, column });
            if (index === primaryIndex) {
                endCursors.unshift(curosr);
            }
            else {
                endCursors.push(curosr);
            }
            lineRemoved += range.last - range.first;
        });
        pushEdits(ctx, edits, () => endCursors);
    }
}

register(new JoinLinesPreserveSpaces(), { ncmdCountLine: 'gJ', vkey: 'gJ'});

class JoinLinesCommon extends JoinLinesBase {
    run(ctx: ICommandContext, ranges: LineRange[], primaryIndex: number) {
        // /**
        //  * vim doc:
        //  * #1 insert one space in place of the <EOL> unless there is trailing white space
        //  * or the next line starts with a ')'
        //  * #2 delete any leading white space on the next line
        //  */

        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursors: monaco.Selection[] = [];
        let lineRemoved = 0;
        ranges.forEach((range, index) => {
            let ln = range.first;
            let resultingLineLength = ctx.model.getLineLength(ln);
            let column = 1;
            // do not insert space if empty line
            let resultingLineEndWithSpace = ctx.position.get(ln, '$').isBlank;
            for (ln = ln + 1; ln <= range.last; ln++) {
                let pos = ctx.position.get(ln, 1).shouldWrap(false);
                if (pos.kind === CursorKind.Whitespace) {
                    pos.stepTo(x => x.kind !== CursorKind.Whitespace);
                }
                let range = monaco.Range.fromPositions(ctx.position.get(ln - 1, 'eol'), pos);
                let lenToAdd = pos.lineLength - (pos.column - 1);
                let text = resultingLineEndWithSpace ? '' : ' ';
                if (lenToAdd === 0) {
                    resultingLineEndWithSpace = true;
                }
                else {
                    if (pos.char === ')') {
                        text = '';
                    }
                    resultingLineEndWithSpace = pos.setColumn('$').isBlank;
                }
                column = resultingLineLength + (lenToAdd === 0 ? 0 : 1);
                resultingLineLength += lenToAdd + text.length;
                edits.push({range, text});
            }
            let lineNumber = range.first - lineRemoved;
            let cursor = monaco.Selection.fromPositions({lineNumber, column});
            if (index === primaryIndex) {
                endCursors.unshift(cursor);
            }
            else {
                endCursors.push(cursor);
            }
            lineRemoved += range.last - range.first;
        })
        pushEdits(ctx, edits, () => endCursors);
    }
}

register(new JoinLinesCommon(), { ncmdCountLine: 'J', vkey: 'J'});

class CursorState {
    private points: {offset: number, delta: number, relative: number, result?: number}[] = [];

    private resolved?: monaco.Selection[];

    constructor(readonly model: monaco.editor.ITextModel) {
    }

    setRelative(p: monaco.IPosition, relative: number) {
        let offset = this.model.getOffsetAt(p);
        this.points.push({ offset, relative, delta: 0 });
    }

    applyEdits(edits: monaco.editor.IIdentifiedSingleEditOperation[]) {
        edits.forEach(edit => {
            let offset = this.model.getOffsetAt(edit.range.getStartPosition());
            let delta = (edit.text ? edit.text.length : 0) - this.model.getValueLengthInRange(edit.range);
            this.points.forEach(point => {
                if (point.offset > offset) {
                    point.delta += delta;
                }
            })
        });
        this.points.forEach(x => x.result = x.offset + x.delta + x.relative);
    }

    resolve() {
        if (!this.resolved) {
            this.resolved = this.points.map(x => monaco.Selection.fromPositions(this.model.getPositionAt(x.result!)));
        }
        return this.resolved;
    }
}

class ChangeNumber implements Operator {
    constructor(readonly type: 'add' | 'subtract', readonly sequence: boolean) {
    }

    runWithCursor(ctx: ICommandContext, posiitons: monaco.IPosition[], args: ICommandArgs) {
        let count = args.count || 1;
        if (this.type === 'subtract') {
            count = -count;
        }
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursorState = new CursorState(ctx.model);
        posiitons.map(x => {
            let pos = ctx.position.get(x).shouldWrap(false);
            if (this.isDigit(pos.char)) {
                let foundMinus = false;
                pos.backIf(x => !foundMinus && (this.isDigit(x.char) || (x.char === '-' && (foundMinus = true))));
            }
            let r = this.findNumberRange(ctx, monaco.Range.fromPositions(pos, pos.clone().setColumn('eol')));
            if (r) {
                let { range, value, length } = r;
                let text = this.numberToText(value + count, length);
                edits.push({ range, text });
                endCursorState.setRelative(range.getStartPosition(), text.length - 1);
            }
            else {
                endCursorState.setRelative(x, 0);
            }
        });
        if (edits.length > 0) {
            endCursorState.applyEdits(edits);
            pushEdits(ctx, edits, () => endCursorState.resolve());
        }
        else {
            ctx.vimState.beep();
        }
    }

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        let charRanges = ranges.map(x => charFromLine(ctx, x));
        this.runWithCharRange(ctx, charRanges, source, args);
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        if (source !== RangeSource.Visual) {
            throw new Error();
        }
        let count = args.count || 1;
        if (this.type === 'subtract') {
            count = -count;
        }
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursors = ranges.map(x => monaco.Selection.fromPositions({lineNumber: x.startLineNumber, column: x.startColumn}));
        ranges.forEach(x => {
            let n = 1;
            helper.splitRangeByLineEnding(ctx.model, x).forEach(rng => {
                let r = this.findNumberRange(ctx, rng);
                if (r) {
                    let { range, value, length } = r;
                    let newValue = value + (this.sequence ? n++ : 1) * count;
                    let text = this.numberToText(newValue, length);
                    edits.push({ range, text });
                }
            });
        });
        if (edits.length > 0) {
            pushEdits(ctx, edits, () => endCursors);
        }
        else {
            ctx.vimState.beep();
        }
    }

    isDigit(s: string) {
        let c = s.charCodeAt(0);
        return c >= '0'.charCodeAt(0) && c <= '9'.charCodeAt(0);
    }

    findNumberRange(ctx: ICommandContext, range: monaco.IRange) {
        let str = ctx.model.getValueInRange(range);
        let match = str.match(/-?\d+/);
        if (match) {
            let text = match[0];
            let ln = range.startLineNumber;
            let start = range.startColumn + match.index!;
            let newRange = new monaco.Range(ln, start, ln, start + text.length);
            let value = parseInt(text);
            let length = text.length - (value < 0 ? 1 : 0);
            return { range: newRange, value, text, length };
        }
    }

    numberToText(value: number, padLength: number) {
        if (value >= 0) {
            let s = value.toString();
            let n = padLength - s.length;
            while (n > 0) {
                s = '0' + s;
                n--;
            }
            return s;
        }
        else {
            let s = Math.abs(value).toString();
            let n = padLength - s.length;
            while (n > 0) {
                s = '0' + s;
                n--;
            }
            return '-' + s;
        }
    }
}

register(new ChangeNumber('add', false), { ncmdCursor: '<C-A>', vkey: '<C-A>' });
register(new ChangeNumber('subtract', false), { ncmdCursor: '<C-X>', vkey: '<C-X>' });
register(new ChangeNumber('add', true), { vkey: 'g<C-A>' });
register(new ChangeNumber('subtract', true), { vkey: 'g<C-X>' });


class Delete implements Operator {
    mergeTouchedLineRanges = true;

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        if (ctx.model.getValueLength() === 0) {
            return;
        }
        const lineCount = ctx.model.getLineCount();
        if (ranges.length === 1 && ranges[0].first === 1 && ranges[0].last === lineCount) {
            registerManager.storeText(ctx.model.getValue(), true, args.register || 'delete');
            let s = [new monaco.Selection(1, 1, 1, 1)];
            pushEdits(ctx, [{range: ctx.model.getFullModelRange(), text: null}], () => s);
            return;
        }
        let firstRange = ranges[0];
        ranges = ranges.sort((a, b) => a.first - b.first);
        let primaryIndex = ranges.indexOf(firstRange);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursors: monaco.Selection[] = [];
        let lineRemoved = 0;
        let texts: string[] = [];
        ranges.map((x, index) => {
            let rangeToCopy = monaco.Range.fromPositions({lineNumber: x.first, column: 1}, ctx.position.get(x.last, 'eol'));
            texts.push(ctx.model.getValueInRange(rangeToCopy));
            let range: monaco.Range;
            if (x.first === 1 && x.last === lineCount) {
                throw new Error();
            }
            else if (x.last !== lineCount) {
                range = new monaco.Range(x.first, 1, x.last + 1, 1);
            }
            else {
                range = monaco.Range.fromPositions(ctx.position.get(x.first - 1, 'eol'), ctx.position.get(x.last, 'eol'));
            }
            edits.push({ range, text: null });
            let column = ctx.position.get(x.last === lineCount ? x.first - 1 : x.last + 1, '^').column;
            let lineNumber = (x.last === lineCount ? x.first - 1 : x.first) - lineRemoved;
            let cursor = monaco.Selection.fromPositions({lineNumber, column});
            if (index === primaryIndex) {
                endCursors.unshift(cursor);
            }
            else {
                endCursors.push(cursor);
            }
            lineRemoved += x.last - x.first + 1;
        });
        registerManager.storeText(texts, true, args.register || 'delete');
        pushEdits(ctx, edits, () => endCursors);
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursorState = new CursorState(ctx.model);
        let texts: string[] = [];
        ranges.forEach(x => {
            let range = monaco.Range.lift(x);
            texts.push(ctx.model.getValueInRange(range));
            edits.push({range, text: null});
            let rel = range.startColumn !== 1 && ctx.position.get(range.getEndPosition()).kind === CursorKind.EOL ? -1 : 0;
            endCursorState.setRelative(range.getStartPosition(), rel);
        });
        registerManager.storeText(texts, false, args.register || 'delete');
        endCursorState.applyEdits(edits);
        pushEdits(ctx, edits, () => endCursorState.resolve());
    }
}

register(new Delete(), { nkey: 'd', nline: true, vkey: 'd, x, <Del>, <BS>', vline: 'X, D', nsynonym: {
    'x, <Del>': spMotion.right,
    'X': spMotion.left,
    'D': spMotion.EOL,
}});

addExRangeCommand({
    matcher: /^d(?:e|el|ele|elet|elete)?(?:\s+([^\d]))?(?:\s*(\d+))?\s*$/,
    handler(ctx, range, cap: string[]) {
        let register: number | undefined = undefined;
        let count: number | undefined = undefined;
        if (cap[1]) {
            register = registerManager.convertToId(cap[1].charCodeAt(0));
            if (!register) {
                ctx.vimState.outputError('Invalid register');
                return;
            }
        }
        if (cap[2]) {
            count = parseInt(cap[2]);
            if (count < 1) {
                ctx.vimState.outputError('Positive count required');
                return;
            }
        }
        if (count) {
            range = {first: range.last, last: range.last + count - 1};
        }
        ctx.editor.pushUndoStop();
        new Delete().runWithLineRange(ctx, [range], RangeSource.ByLine, { register });
        ctx.editor.pushUndoStop();
        ctx.editor.revealPosition(ctx.position.get());
        ctx.vimState.toNormal();
    }
});

class Yank implements Operator {
    isEdit = false;

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        ranges = ranges.sort((a, b) => a.first - b.first);
        let texts = ranges.map(x => ctx.model.getValueInRange(charFromLine(ctx, x)));
        registerManager.storeText(texts, true, args.register || 'yank');
        if (source === RangeSource.Visual) {
            let newSelections = ranges.map(x => monaco.Selection.fromPositions({lineNumber: x.first, column: 1}));
            ctx.editor.setSelections(newSelections);
        }
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        ranges = ranges.sort((a, b) => monaco.Range.compareRangesUsingStarts(a, b));
        let texts = ranges.map(x => ctx.model.getValueInRange(x));
        registerManager.storeText(texts, false, args.register || 'yank');
        if (source === RangeSource.Visual) {
            let newSelections = ranges.map(x => monaco.Selection.fromPositions({lineNumber: x.startLineNumber, column: x.startColumn}));
            ctx.editor.setSelections(newSelections);
        }
    }
}

register(new Yank(), { nkey: 'y', nline: true, ncmdCountLine: 'Y', vkey: 'y', vline: 'Y'});

//  sel     reg     then
//  line    line    [{first, 1}, {last, eol})
//  line    char    [{first, 1}, {last, eol})
//  char    line    text prepend and append \n
//  char    char    -
//  none    line    [eol); text prepend \n
//  none    char    [cursor+1)
class PutAfter implements Operator {
    constructor(readonly cursorAtNext: boolean) {
    }

    getRegisterItem(ctx: ICommandContext, args: ICommandArgs) {
        const item = registerManager.getText(args.register);
        if (!item) {
            let s = registerManager.idToString(args.register);
            if (s !== '_') {
                ctx.vimState.outputError('Nothing in register ' + s);
            }
        }
        return item;
    }

    runWithCursor(ctx: ICommandContext, posiitons: monaco.IPosition[], args: ICommandArgs) {
        const item = this.getRegisterItem(ctx, args);
        if (!item) {
            return;
        }
        let firstPos = posiitons[0];
        posiitons = posiitons.sort((a, b) => monaco.Position.compare(a, b));
        let primaryIndex = posiitons.indexOf(firstPos);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let getLineCount = (text: string) => {
            let m = text.match(/\n/g);
            return m ? m.length + 1 : 1;
        }
        let getTargetText: (index: number) => [string, number];
        if (posiitons.length > 1 && posiitons.length === item.texts.length) {
            let repeatedTexts = item.repeatTextRespectively(args.count || 1);
            getTargetText = index => [repeatedTexts[index], getLineCount(repeatedTexts[index])];
        }
        else {
            let joinedText = item.getJoinedText(args.count || 1);
            const srcLineCount = getLineCount(joinedText);
            getTargetText = () => [joinedText, srcLineCount];
        }
        if (item.linewise) {
            let cursorLines: number[] = [];
            let lineAdded = 0;
            posiitons.map((x, index) => {
                let pos = ctx.position.get(x.lineNumber, 'eol');
                let range = monaco.Range.fromPositions(pos, pos);
                let [srcText, srcLineCount] = getTargetText(index);
                let text = '\n' + srcText;
                edits.push({ range, text });
                let curosrLine = x.lineNumber + (this.cursorAtNext ? srcLineCount + 1 : 1) + lineAdded
                if (index === primaryIndex) {
                    cursorLines.unshift(curosrLine);
                }
                else {
                    cursorLines.push(curosrLine);
                }
                lineAdded += srcLineCount;
            });
            let resolvedCursorState: monaco.Selection[] | null = null;
            pushEdits(ctx, edits, () => {
                if (!resolvedCursorState) {
                    if (this.cursorAtNext) {
                        resolvedCursorState = cursorLines.map(x => monaco.Selection.fromPositions({lineNumber: x, column: 1}));
                    }
                    else {
                        resolvedCursorState = cursorLines.map(x => ctx.position.get(x, '^').toSelection());
                    }
                }
                return resolvedCursorState;
            });
        }
        else {
            let endCursorState = new CursorState(ctx.model);
            posiitons.map((x, index) => {
                let pos = ctx.position.get(x.lineNumber, x.column + 1);
                let range = monaco.Range.fromPositions(pos, pos);
                let [srcText, srcLineCount] = getTargetText(index);
                edits.push({ range, text: srcText });
                let rel = this.cursorAtNext ? srcText.length : (srcLineCount >  1 ? 0 : srcText.length - 1);
                endCursorState.setRelative(pos, rel);
            });
            endCursorState.applyEdits(edits);
            pushEdits(ctx, edits, () => endCursorState.resolve());
        }
    }

    storeLineTexts(ctx: ICommandContext, ranges: LineRange[], args: ICommandArgs) {
        let texts = ranges.map(x => {
            let rangeToCopy = monaco.Range.fromPositions({lineNumber: x.first, column: 1}, ctx.position.get(x.last, 'eol'));
            return ctx.model.getValueInRange(rangeToCopy);
        });
        registerManager.storeText(texts, true, args.register || 'delete');
    }

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        const item = this.getRegisterItem(ctx, args);
        if (!item) {
            return;
        }
        this.storeLineTexts(ctx, ranges, args);
        let firstRange = ranges[0];
        ranges = ranges.sort((a, b) => a.first - b.first);
        let primaryIndex = ranges.indexOf(firstRange);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let getLineCount = (text: string) => {
            let m = text.match(/\n/g);
            return m ? m.length + 1 : 1;
        }
        let getTargetText: (index: number) => [string, number];
        if (ranges.length > 1 && ranges.length === item.texts.length) {
            let repeatedTexts = item.repeatTextRespectively(args.count || 1, true);
            getTargetText = index => [repeatedTexts[index], getLineCount(repeatedTexts[index])];
        }
        else {
            let joinedText = item.getJoinedText(args.count || 1, true);
            const srcLineCount = getLineCount(joinedText);
            getTargetText = () => [joinedText, srcLineCount];
        }
        let cursorLines: number[] = [];
        let lineDelta = 0;
        ranges.map((x, index) => {
            let range = charFromLine(ctx, x);
            let [text, srcLineCount] = getTargetText(index);
            edits.push({ range, text });
            let curosrLine = x.first + (this.cursorAtNext ? srcLineCount : 0) + lineDelta;
            if (index === primaryIndex) {
                cursorLines.unshift(curosrLine);
            }
            else {
                cursorLines.push(curosrLine);
            }
            lineDelta += srcLineCount - (x.last - x.first + 1);
        });
        let resolvedCursorState: monaco.Selection[] | null = null;
        pushEdits(ctx, edits, () => {
            if (!resolvedCursorState) {
                if (this.cursorAtNext) {
                    resolvedCursorState = cursorLines.map(x => monaco.Selection.fromPositions({lineNumber: x, column: 1}));
                }
                else {
                    resolvedCursorState = cursorLines.map(x => ctx.position.get(x, '^').toSelection());
                }
            }
            return resolvedCursorState;
        });
    }

    storeCharTexts(ctx: ICommandContext, ranges: monaco.IRange[], args: ICommandArgs) {
        let texts = ranges.map(x => ctx.model.getValueInRange(x));
        registerManager.storeText(texts, false, args.register || 'delete');
    }

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        const item = this.getRegisterItem(ctx, args);
        if (!item) {
            return;
        }
        this.storeCharTexts(ctx, ranges, args);
        let firstRange = ranges[0];
        ranges = ranges.sort((a, b) => monaco.Range.compareRangesUsingStarts(a, b));
        let primaryIndex = ranges.indexOf(firstRange);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let getLineCount = (text: string) => {
            let m = text.match(/\n/g);
            return m ? m.length + 1 : 1;
        }
        let getTargetText: (index: number) => [string, number];
        if (ranges.length > 1 && ranges.length === item.texts.length) {
            let repeatedTexts = item.repeatTextRespectively(args.count || 1);
            getTargetText = index => [repeatedTexts[index], getLineCount(repeatedTexts[index])];
        }
        else {
            let joinedText = item.getJoinedText(args.count || 1);
            const srcLineCount = getLineCount(joinedText);
            getTargetText = () => [joinedText, srcLineCount];
        }
        if (item.linewise) {
            let cursorLines: number[] = [];
            let lineDelta = 0;
            ranges.map((x, index) => {
                let range = monaco.Range.lift(x);
                let [srcText, srcLineCount] = getTargetText(index);
                let text = '\n' + srcText + '\n';
                edits.push({ range, text });
                let curosrLine = x.startLineNumber + (this.cursorAtNext ? srcLineCount + 1 : 1) + lineDelta;
                if (index === primaryIndex) {
                    cursorLines.unshift(curosrLine);
                }
                else {
                    cursorLines.push(curosrLine);
                }
                lineDelta += srcLineCount + 1 - (x.endLineNumber - x.startLineNumber);
            });
            let resolvedCursorState: monaco.Selection[] | null = null;
            pushEdits(ctx, edits, () => {
                if (!resolvedCursorState) {
                    if (this.cursorAtNext) {
                        resolvedCursorState = cursorLines.map(x => monaco.Selection.fromPositions({lineNumber: x, column: 1}));
                    }
                    else {
                        resolvedCursorState = cursorLines.map(x => ctx.position.get(x, '^').toSelection());
                    }
                }
                return resolvedCursorState;
            });
        }
        else {
            let endCursorState = new CursorState(ctx.model);
            ranges.map((x, index) => {
                let range = monaco.Range.lift(x);
                let [srcText, srcLineCount] = getTargetText(index);
                edits.push({ range, text: srcText });
                let rel = this.cursorAtNext ? srcText.length : (srcLineCount >  1 ? 0 : srcText.length - 1);
                endCursorState.setRelative(range.getStartPosition(), rel);
            });
            endCursorState.applyEdits(edits);
            pushEdits(ctx, edits, () => endCursorState.resolve());
        }
    }
}
register(new PutAfter(false), { ncmdCursor: 'p', vkey: 'p' });
register(new PutAfter(true), { ncmdCursor: 'gp', vkey: 'gp' });

//  sel     reg     then
//  none    line    [1); text append \n
//  none    char    [cursor)
class PutBefore extends PutAfter {
    runWithCursor(ctx: ICommandContext, posiitons: monaco.IPosition[], args: ICommandArgs) {
        const item = this.getRegisterItem(ctx, args);
        if (!item) {
            return;
        }
        let firstPos = posiitons[0];
        posiitons = posiitons.sort((a, b) => monaco.Position.compare(a, b));
        let primaryIndex = posiitons.indexOf(firstPos);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let getLineCount = (text: string) => {
            let m = text.match(/\n/g);
            return m ? m.length + 1 : 1;
        }
        let getTargetText: (index: number) => [string, number];
        if (posiitons.length > 1 && posiitons.length === item.texts.length) {
            let repeatedTexts = item.repeatTextRespectively(args.count || 1);
            getTargetText = index => [repeatedTexts[index], getLineCount(repeatedTexts[index])];
        }
        else {
            let joinedText = item.getJoinedText(args.count || 1);
            const srcLineCount = getLineCount(joinedText);
            getTargetText = () => [joinedText, srcLineCount];
        }
        if (item.linewise) {
            let cursorLines: number[] = [];
            let lineAdded = 0;
            posiitons.map((x, index) => {
                let pos = ctx.position.get(x.lineNumber, 1);
                let range = monaco.Range.fromPositions(pos, pos);
                let [srcText, srcLineCount] = getTargetText(index);
                let text = srcText + '\n';
                edits.push({ range, text });
                let curosrLine = x.lineNumber + (this.cursorAtNext ? srcLineCount : 0) + lineAdded
                if (index === primaryIndex) {
                    cursorLines.unshift(curosrLine);
                }
                else {
                    cursorLines.push(curosrLine);
                }
                lineAdded += srcLineCount;
            });
            let resolvedCursorState: monaco.Selection[] | null = null;
            pushEdits(ctx, edits, () => {
                if (!resolvedCursorState) {
                    if (this.cursorAtNext) {
                        resolvedCursorState = cursorLines.map(x => monaco.Selection.fromPositions({lineNumber: x, column: 1}));
                    }
                    else {
                        resolvedCursorState = cursorLines.map(x => ctx.position.get(x, '^').toSelection());
                    }
                }
                return resolvedCursorState;
            });
        }
        else {
            let endCursorState = new CursorState(ctx.model);
            posiitons.map((x, index) => {
                let range = monaco.Range.fromPositions(x);
                let [srcText, srcLineCount] = getTargetText(index);
                edits.push({ range, text: srcText });
                let rel = this.cursorAtNext ? srcText.length : (srcLineCount >  1 ? 0 : srcText.length - 1);
                endCursorState.setRelative(x, rel);
            });
            endCursorState.applyEdits(edits);
            pushEdits(ctx, edits, () => endCursorState.resolve());
        }
    }
}

register(new PutBefore(false), { ncmdCursor: 'P', vkey: 'P' });
register(new PutBefore(true), { ncmdCursor: 'gP', vkey: 'gP' });

class ReplaceChar implements Operator {
    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        const char = args.char;
        if (!char) {
            throw new Error();
        }
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        ranges.forEach(x => {
            helper.splitRangeByLineEnding(ctx.model, x).forEach(range => {
                let text = char.repeat(range.endColumn - range.startColumn);
                edits.push({range, text});
            });
        });
        let endCursors = ranges.map(x => monaco.Selection.fromPositions({lineNumber: x.startLineNumber, column: source === RangeSource.ByCount ? x.endColumn - 1 : x.startColumn}));
        pushEdits(ctx, edits, () => endCursors);
    }

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        let charRanges = ranges.map(x => charFromLine(ctx, x));
        this.runWithCharRange(ctx, charRanges, source, args);
    }
}

register(new ReplaceChar(), {ncmdCountChar: ['r', {kind: 'Char'}], vkey: ['r', {kind: 'Char'}]});

class DeleteAndInsert implements Operator {
    isInserting = true;

    runWithCharRange(ctx: ICommandContext, ranges: monaco.IRange[], source: RangeSource, args: ICommandArgs) {
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursorState = new CursorState(ctx.model);
        let texts: string[] = [];
        ranges.forEach(x => {
            let range = monaco.Range.lift(x);
            texts.push(ctx.model.getValueInRange(range));
            edits.push({range, text: null});
            endCursorState.setRelative(range.getStartPosition(), 0);
        });
        registerManager.storeText(texts, false, args.register || 'delete');
        endCursorState.applyEdits(edits);
        pushEdits(ctx, edits, () => endCursorState.resolve());
    }

    runWithLineRange(ctx: ICommandContext, ranges: LineRange[], source: RangeSource, args: ICommandArgs) {
        let firstRange = ranges[0];
        ranges = ranges.sort((a, b) => a.first - b.first);
        let primaryIndex = ranges.indexOf(firstRange);
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let endCursors: monaco.Selection[] = [];
        let lineRemoved = 0;
        let texts: string[] = [];
        ranges.map((x, index) => {
            let lineStart = ctx.position.get(x.first, 1);
            let start = lineStart.clone().shouldWrap(false);
            if (start.kind === CursorKind.Whitespace) {
                start.stepTo(x => x.kind !== CursorKind.Whitespace);
            }
            let end = ctx.position.get(x.last, 'eol');
            let range = monaco.Range.fromPositions(lineStart, end);
            texts.push(ctx.model.getValueInRange(range));
            range = monaco.Range.fromPositions(start, end);
            edits.push({ range, text: null });
            let cursor = monaco.Selection.fromPositions({ lineNumber: x.first - lineRemoved, column: start.column });
            if (index === primaryIndex) {
                endCursors.unshift(cursor);
            }
            else {
                endCursors.push(cursor);
            }
            lineRemoved += x.last - x.first;
        });
        registerManager.storeText(texts, true, args.register || 'delete');
        pushEdits(ctx, edits, () => endCursors);
    }
}

register(new DeleteAndInsert(), {
    nkey: 'c', nline: true, ncmdCountLine: 'S', vkey: 'c, s', vline: 'C, S, R', nsynonym: {
        'C': spMotion.EOL,
        's': spMotion.right,
    }
});
