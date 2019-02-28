import { createSeqMap, addSeqMapItem } from "./matching/seqMap";
import * as keyUtils from "./utils/key";
import * as P from "./matching/pattern";
import * as helper from "./utils/helper";
import { motionPattern, objectSelectionPattern, MotionFunction, spMotion } from "./motions";
import { applyMotion } from "./utils/helper";
import { registerManager } from "./registerManager";
import { ColumnValue, CursorKind } from "./text/position";
import { recorder } from "./recorder";
import { ICommandContext, ICommandArgs, createCommand, ICommand } from "./command";
import * as monaco from "monaco-editor";

const enum Source {
    Cursor, // empty char range [cursor, cursor)
    ByCount, // {count} chars or lines
    ByLine, // d3d
    Motion,
    Visual,
}

type OperatorArgUnion = {
    kind: 'CharRange';
    range: monaco.IRange;
} | {
    kind: 'LineRange';
    lines: [number, number]; // [first, last]
};

type OperatorArg = OperatorArgUnion & {
    source: Source;
    commandArgs: ICommandArgs
};

//#region utils

function linesFromRange(range: monaco.IRange): [number, number] {
    if (range.endColumn === 1 && range.startLineNumber !== range.endLineNumber) {
        return [range.startLineNumber, range.endLineNumber - 1];
    }
    else {
        return [range.startLineNumber, range.endLineNumber];
    }
}

function coveredLines(arg: OperatorArg): [number, number] {
    if (arg.kind === 'LineRange') {
        return arg.lines;
    }
    else if (arg.kind === 'CharRange') {
        return linesFromRange(arg.range);
    }
    else {
        throw new Error();
    }
}

function rangeFromLines(ctx: ICommandContext, lines: [number, number]) {
    let start = {lineNumber: lines[0], column: 1};
    let end = {lineNumber: lines[1], column: ctx.model.getLineMaxColumn(lines[1])};
    return monaco.Range.fromPositions(start, end);
}

function coveredRange(ctx: ICommandContext, arg: OperatorArg): monaco.Range {
    if (arg.kind === 'LineRange') {
        return rangeFromLines(ctx, arg.lines);
    }
    else if (arg.kind === 'CharRange') {
        return monaco.Range.lift(arg.range);
    }
    else {
        throw new Error();
    }
}

function createCharRangeArg(source: Source, commandArgs: ICommandArgs, range: monaco.IRange): OperatorArg {
    return {
        kind: 'CharRange',
        source,
        commandArgs,
        range,
    }
}

function createLineRangeArg(source: Source, commandArgs: ICommandArgs, what: [number, number] | monaco.IRange): OperatorArg {
    let lines: [number, number];
    if (Array.isArray(what)) {
        lines = what;
    }
    else {
        lines = linesFromRange(what);
    }
    return {
        kind: 'LineRange',
        source,
        commandArgs,
        lines,
    }
}

let FakeNLinesMotion: MotionFunction = (ctx, pos, count) => {
    let position = ctx.position.get(pos.lineNumber + count - 1, 1);
    return {
        position,
        linewise: true,
    }
}

type OperatorFunction = (this: ICommand, ctx: ICommandContext, arg: OperatorArg) => void | PromiseLike<void>;

function createRtlSelection(range: monaco.IRange) {
    return monaco.Selection.createWithDirection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn, monaco.SelectionDirection.RTL);
}

function cc(val: number, max: number) {
    return val < 1 ? 1 : (val > max ? max : val);
}

function executeEdits(ctx: ICommandContext, edits: monaco.editor.IIdentifiedSingleEditOperation | monaco.editor.IIdentifiedSingleEditOperation[], position: () => monaco.IPosition) {
    if (!Array.isArray(edits)) {
        edits = [edits];
    }
    let selections: monaco.Selection[];
    ctx.model.pushEditOperations(ctx.editor.getSelections()!, edits, () => {
        let pos = position();
        selections = [monaco.Selection.fromPositions(pos, pos)];
        return selections;
    })
    ctx.editor.setSelections(selections!);
}

//#endregion

//#region implements

function deleteLines(ctx: ICommandContext, register: number | undefined, first: number, last: number) {
    let lineCount = ctx.model.getLineCount();
    first = cc(first, lineCount);
    last = cc(last, lineCount);
    let lastMaxColumn = ctx.model.getLineMaxColumn(last);
    if (lineCount === 1 && last === 1 && lastMaxColumn === 1) {
        return 1;
    }
    let rangeToCopy = monaco.Range.fromPositions({lineNumber: first, column: 1}, ctx.position.get(last, 'eol'));
    registerManager.storeText(ctx.model.getValueInRange(rangeToCopy), true, register || 'delete');
    let range: monaco.Range;
    if (first === 1 && last === lineCount) {
        range = monaco.Range.fromPositions(ctx.position.get(1, 1), ctx.position.get(last, 'eol'));
    }
    else if (last !== lineCount) {
        range = new monaco.Range(first, 1, last + 1, 1);
    }
    else {
        range = monaco.Range.fromPositions(ctx.position.get(first - 1, 'eol'), ctx.position.get(last, 'eol'));
    }
    let ln = last === lineCount ? first - 1 : first;
    executeEdits(ctx, {range, text: ''}, () => ctx.position.get(ln, '^'));
}

export const deleteText: OperatorFunction = (ctx, arg) => {
    if (arg.kind === 'LineRange') {
        deleteLines(ctx, arg.commandArgs.register, arg.lines[0], arg.lines[1]);
    }
    else if (arg.kind === 'CharRange') {
        registerManager.storeText(ctx.model.getValueInRange(arg.range), false, arg.commandArgs.register || 'delete');
        let pos = ctx.position.get(arg.range.startLineNumber, arg.range.startColumn);
        let end = ctx.position.get(arg.range.endLineNumber, arg.range.endColumn);
        if (end.kind === CursorKind.EOL) {
            pos.shouldWrap(false).move(-1);
        }
        executeEdits(ctx, { range: monaco.Range.lift(arg.range), text: '' }, () => pos);
    }
    else {
        throw new Error();
    }
}

function forRepeatLineRangeDeleteAndInsert(count: number): ICommand {
    return createCommand((ctx, args) => {
        let first = ctx.position.get().lineNumber;
        let last = Math.min(ctx.model.getLineCount(), first + count - 1);
        deleteAndInsertImpl(ctx, createLineRangeArg(Source.Visual, args, [first, last]));
    });
}

function forRepeatCharRangeDeleteAndInsert(length: number): ICommand {
    return createCommand((ctx, args) => {
        let start = ctx.position.get();
        let end = start.clone().move(length);
        let range = monaco.Range.fromPositions(start, end);
        deleteAndInsertImpl(ctx, createCharRangeArg(Source.Visual, args, range));
    });
}

const deleteAndInsertImpl = function (ctx: ICommandContext, arg: OperatorArg, command?: ICommand) {
    let mode = ctx.vimState.getMode();
    if (arg.kind === 'LineRange') {
        let lineStart = ctx.position.get(arg.lines[0], 1);
        let start = lineStart.clone().shouldWrap(false);
        if (start.kind === CursorKind.Whitespace) {
            start.stepTo(x => x.kind !== CursorKind.Whitespace);
        }
        let end = ctx.position.get(arg.lines[1], 'eol');
        let range = monaco.Range.fromPositions(lineStart, end);
        registerManager.storeText(ctx.model.getValueInRange(range), true, arg.commandArgs.register || 'delete')
        range = monaco.Range.fromPositions(start, end);
        if (command) {
            if (mode === 'Visual' || mode === 'VisualLine') {
                command = forRepeatLineRangeDeleteAndInsert(arg.lines[1] - arg.lines[0] + 1)
            }
        }
        executeEdits(ctx, {range, text: ''}, () => start);
        if (command) {
            ctx.vimState.toInsert({command, args: arg.commandArgs}, 'none');
        }
    }
    else if (arg.kind === 'CharRange') {
        const range = monaco.Range.lift(arg.range);
        registerManager.storeText(ctx.model.getValueInRange(range), false, arg.commandArgs.register || 'delete')
        if (command) {
            if (mode === 'Visual' || mode === 'VisualLine') {
                let len = ctx.model.getValueLengthInRange(range);
                command = forRepeatCharRangeDeleteAndInsert(len);
            }
        }
        executeEdits(ctx, {range, text: ''}, () => range.getStartPosition());
        if (command) {
            ctx.vimState.toInsert({command, args: arg.commandArgs}, 'none');
        }
    }
    else {
        throw new Error();
    }
}

const deleteAndInsert: OperatorFunction = function (ctx, arg) {
    deleteAndInsertImpl(ctx, arg, this);
}

const replaceText = (ctx: ICommandContext, arg: OperatorArg, char: string) => {
    let ret: monaco.IPosition;
    let range = coveredRange(ctx, arg);
    let ranges = helper.splitRangeByLineEnding(ctx.model, range);
    let edits = ranges.map(x => ({range: x, text: char.repeat(x.endColumn - x.startColumn)}));
    let pos = arg.source === Source.ByCount ? ctx.position.get(range.getEndPosition()).move(-1) : range.getStartPosition();
    executeEdits(ctx, edits, () => pos);
}

const joinLines = (ctx: ICommandContext, arg: OperatorArg, preserveSpaces?: boolean) => {
    let lines = coveredLines(arg);
    let lineCount = ctx.model.getLineCount();
    if (lines[0] === lineCount) {
        ctx.vimState.beep();
        return;
    }
    if (lines[0] === lines[1]) {
        lines[1] = lines[1] + 1;
    }
    if (preserveSpaces) {
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let len = 0;
        for (let ln = lines[0]; ln < lines[1]; ln++) {
            let pos = ctx.position.get(ln, 'eol');
            len += ctx.model.getLineLength(ln);
            let range = monaco.Range.fromPositions(pos, {lineNumber: ln + 1, column: 1});
            edits.push({ range, text: null });
        }
        let lineNumber = lines[0];
        let column = ctx.model.getLineLength(lines[1]) === 0 ? len : len + 1;
        executeEdits(ctx, edits, () => ({lineNumber, column}));
    }
    else {
        /**
         * vim doc:
         * #1 insert one space in place of the <EOL> unless there is trailing white space
         * or the next line starts with a ')'
         * #2 delete any leading white space on the next line
         */

        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let ln = lines[0];
        let resultingLineLength = ctx.model.getLineLength(ln);
        let column = 1;
        // do not insert space if empty line
        let resultingLineEndWithSpace = ctx.position.get(ln, '$').isBlank;
        for (ln = ln + 1; ln <= lines[1]; ln++) {
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
        executeEdits(ctx, edits, () => ({lineNumber: lines[0], column}));
    }
}

const joinLinesPreserveSpaces: OperatorFunction = (ctx, arg) => {
    joinLines(ctx, arg, true);
}

export const lowerCase: OperatorFunction = (ctx, arg) => {
    let range = coveredRange(ctx, arg);
    let text = ctx.model.getValueInRange(range);
    text = text.toLowerCase();
    executeEdits(ctx, { range, text }, () => ctx.position.soften(range.getStartPosition()));
}

export const upperCase: OperatorFunction = (ctx, arg) => {
    let range = coveredRange(ctx, arg);
    let text = ctx.model.getValueInRange(range);
    text = text.toUpperCase();
    executeEdits(ctx, { range, text }, () => ctx.position.soften(range.getStartPosition()));
}

export const toggleCase: OperatorFunction = (ctx, arg) => {
    let range: monaco.Range;
    let pos: monaco.IPosition;
    range = coveredRange(ctx, arg);
    pos = arg.source === Source.ByCount ? ctx.position.soften(range.getEndPosition()) : range.getStartPosition();
    let text = '';
    let oriText = ctx.model.getValueInRange(range);
    for (let i = 0; i < oriText.length; i++) {
        let char = oriText[i];
        let newChar = char.toLowerCase();
        if (newChar === char) {
            newChar = char.toUpperCase();
        }
        text += newChar;
    }
    executeEdits(ctx, { range, text }, () => pos);
}

function isDigit(s: string) {
    let c = s.charCodeAt(0);
    return c >= '0'.charCodeAt(0) && c <= '9'.charCodeAt(0);
}

function findNumberRange(ctx: ICommandContext, range: monaco.IRange) {
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

function numberToText(value: number, padLength: number) {
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

function changeNumber(ctx: ICommandContext, arg: OperatorArg, type: 'add' | 'subtract', sequence: boolean) {
    let count = arg.commandArgs.count || 1;
    if (type === 'subtract') {
        count = -count;
    }
    if (arg.source === Source.Cursor) {
        let pos = ctx.position.get().shouldWrap(false);
        if (isDigit(pos.char)) {
            let foundMinus = false;
            pos.backIf(x => !foundMinus && (isDigit(x.char) || (x.char === '-' && (foundMinus = true))));
        }
        let r = findNumberRange(ctx, monaco.Range.fromPositions(pos, pos.clone().setColumn('eol')));
        if (!r) {
            ctx.vimState.beep();
            return;
        }
        let { range, value, length } = r;
        let text = numberToText(value + count, length);
        let cursorPos = {lineNumber: range.startLineNumber, column: range.startColumn + text.length - 1};
        executeEdits(ctx, {range, text}, () => cursorPos);
    }
    else if (arg.source === Source.Visual) {
        let sel = coveredRange(ctx, arg);
        let cursorPos = sel.getStartPosition();
        let edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
        let n = 1;
        helper.splitRangeByLineEnding(ctx.model, sel).forEach(rng => {
            let r = findNumberRange(ctx, rng);
            if (r) {
                let { range, value, length } = r;
                let newValue = value + (sequence ? n++ : 1) * count;
                let text = numberToText(newValue, length);
                edits.push({ range, text });
            }
        });
        if (edits.length > 0) {
            executeEdits(ctx, edits, () => cursorPos);
        }
    }
    else {
        throw new Error();
    }
}

const addNumber: OperatorFunction = (ctx, arg) => {
    changeNumber(ctx, arg, 'add', false);
}

const subtractNumber: OperatorFunction = (ctx, arg) => {
    changeNumber(ctx, arg, 'subtract', false);
}

const addNumberBySequence: OperatorFunction = (ctx, arg) => {
    if (arg.source !== Source.Visual) {
        throw new Error();
    }
    changeNumber(ctx, arg, 'add', true);
}

const subtractNumberBySequence: OperatorFunction = (ctx, arg) => {
    if (arg.source !== Source.Visual) {
        throw new Error();
    }
    changeNumber(ctx, arg, 'subtract', true);
}

export const indent: OperatorFunction = (ctx, arg) => {
    let beforeVersionId = ctx.model.getAlternativeVersionId();
    let beforeCursor = ctx.position.get();
    let mode = ctx.vimState.getMode();
    let lines = coveredLines(arg);
    if (mode !== 'Visual' && mode !== 'VisualLine') {
        let range = monaco.Range.fromPositions(ctx.position.get(), ctx.position.get(lines[1], 'eol'));
        ctx.editor.setSelection(createRtlSelection(range));
    }
    let n = 1;
    if (mode === 'Visual' || mode === 'VisualLine') {
        n = arg.commandArgs.count || 1;
    }
    while (n !== 0) {
        ctx.editor.trigger('vim', 'editor.action.indentLines', null);
        n--;
    }
    let afterVersionId = ctx.model.getAlternativeVersionId();
    let pos = ctx.position.get(lines[0], '^');
    ctx.editor.setPosition(pos);
    ctx.vimState.addHistoryPatch(beforeVersionId, afterVersionId, beforeCursor, pos);
};

export const outdent: OperatorFunction = (ctx, arg) => {
    let beforeVersionId = ctx.model.getAlternativeVersionId();
    let beforeCursor = ctx.position.get();
    let mode = ctx.vimState.getMode();
    let lines = coveredLines(arg);
    if (mode !== 'Visual' && mode !== 'VisualLine') {
        let range = monaco.Range.fromPositions(ctx.position.get(), ctx.position.get(lines[1], 'eol'));
        ctx.editor.setSelection(createRtlSelection(range));
    }
    let n = 1;
    if (mode === 'Visual' || mode === 'VisualLine') {
        n = arg.commandArgs.count || 1;
    }
    while (n !== 0) {
        ctx.editor.trigger('vim', 'editor.action.outdentLines', null);
        n--;
    }
    let afterVersionId = ctx.model.getAlternativeVersionId();
    let pos = ctx.position.get(lines[0], '^');
    ctx.editor.setPosition(pos);
    ctx.vimState.addHistoryPatch(beforeVersionId, afterVersionId, beforeCursor, pos);
};

export const format: OperatorFunction = (ctx, arg) => {
    let mode = ctx.vimState.getMode();
    let lines = coveredLines(arg);
    if (mode !== 'Visual' && mode !== 'VisualLine') {
        let range = monaco.Range.fromPositions(ctx.position.get(lines[0], 1), ctx.position.get(lines[1], 'eol'));
        ctx.editor.setSelection(createRtlSelection(range));
    }
    let action = ctx.editor.getAction('editor.action.formatSelection')
    if (!action) {
        throw new Error();
    }
    return action.run().then(() => {
        ctx.editor.setPosition(ctx.position.get(lines[0], '^'));
    });
};

const putTextAfter = (ctx: ICommandContext, arg: OperatorArg, cursorAtNext?: boolean) => {
    const item = registerManager.getText(arg.commandArgs.register);
    if (!item) {
        return;
    }
    let lineCount = ctx.model.getLineCount();
    let modelLength = ctx.model.getValueLength();
    let text = item.repeatText(arg.commandArgs.count || 1);
    let range: monaco.Range;
    //  sel     reg     then
    //  line    line    [{first, 1}, {last, eol})
    //  line    char    [{first, 1}, {last, eol})
    //  char    line    text prepend and append \n
    //  char    char    -
    //  none    line    [eol); text prepend \n
    //  none    char    [cursor+1)
    if (arg.kind === 'LineRange') {
        let start = ctx.position.get(arg.lines[0], 0);
        let end = ctx.position.get(arg.lines[1], 'eol');
        range = monaco.Range.fromPositions(start, end);
        registerManager.storeText(ctx.model.getValueInRange(range), true, 'delete')
    }
    else if (arg.kind === 'CharRange') {
        // the only exception: ignore the passed range in normal mode
        if (arg.source === Source.Cursor) {
            let cursor = ctx.position.get();
            if (item.linewise) {
                let pos = ctx.position.get(cursor.lineNumber, 'eol');
                range = monaco.Range.fromPositions(pos, pos);
                text = '\n' + text;
            }
            else {
                let pos = ctx.position.get(cursor.lineNumber, cursor.column + 1);
                range = monaco.Range.fromPositions(pos, pos);
            }
        }
        else {
            range = monaco.Range.lift(arg.range);
            registerManager.storeText(ctx.model.getValueInRange(range), false, 'delete')
            if (item.linewise) {
                text = '\n' + text + '\n';
            }
        }
    }
    else {
        throw new Error();
    }
    executeEdits(ctx, {range, text}, () => {
        let startPos = range.getStartPosition();
        let position: monaco.IPosition;
        if (item.linewise) {
            let ln = startPos.lineNumber + 1;
            let col: ColumnValue = '^';
            if (cursorAtNext === true) {
                let newLineCount = ctx.model.getLineCount();
                ln += newLineCount - lineCount;
                col = 1;
            }
            position = ctx.position.get(ln, col);
        }
        else {
            let offset = ctx.model.getOffsetAt(startPos);
            let insertedLength = ctx.model.getValueLength() - modelLength;
            if (cursorAtNext === true) {
                offset += insertedLength + 1;
            }
            else {
                // change within single line -> new text last char; else -> first char
                if (ctx.model.getLineCount() === lineCount) {
                    offset += insertedLength;
                }
                else {
                    offset += 1;
                }
            }
            position = ctx.model.getPositionAt(offset - 1);
        }
        return position;
    });
}

const putTextAfterAndCursorAtNext: OperatorFunction = (ctx, arg) => {
    putTextAfter(ctx, arg, true);
}

const putTextBefore = (ctx: ICommandContext, arg: OperatorArg, cursorAtNext?: boolean) => {
    let item = registerManager.getText(arg.commandArgs.register);
    if (!item) {
        return;
    }
    let cursor = ctx.position.get();
    let lineCount = ctx.model.getLineCount();
    let modelLength = ctx.model.getValueLength();
    let count = arg.commandArgs.count || 1;
    if (item.linewise) {
        let text = '';
        while (count > 0) {
            text += item.text + '\n';
            count--;
        }
        let pos = {lineNumber: cursor.lineNumber, column: 1};
        let range = monaco.Range.fromPositions(pos, pos);
        executeEdits(ctx, {range, text}, () => {
            let ln = cursor.lineNumber;
            let col: ColumnValue = '^';
            if (cursorAtNext === true) {
                let newLineCount = ctx.model.getLineCount();
                ln += newLineCount - lineCount;
                col = 1;
            }
            let posiiton = ctx.position.get(ln, col).soft();
            return posiiton;
        });
    }
    else {
        let text = '';
        let count = arg.commandArgs.count || 1;
        while (count > 0) {
            text += item.text;
            count--;
        }
        let range = monaco.Range.fromPositions(cursor, cursor);
        executeEdits(ctx, {range, text}, () => {
            let offset = ctx.model.getOffsetAt(cursor);
            offset += ctx.model.getValueLength() - modelLength;
            if (cursorAtNext === true) {
                offset += 1;
            }
            let position = ctx.position.soften(ctx.model.getPositionAt(offset - 1));
            return position;
        });
    }
}

const putTextBeforeAndCursorAtNext: OperatorFunction = (ctx, arg) => {
    putTextBefore(ctx, arg, true);
}

const yank: OperatorFunction = (ctx, arg) => {
    let range = coveredRange(ctx, arg);
    let text = ctx.model.getValueInRange(range);
    registerManager.storeText(text, arg.kind === 'LineRange', arg.commandArgs.register || 'yank');
    if (ctx.vimState.getMode() === 'Visual' || ctx.vimState.getMode() === 'VisualLine') {
        ctx.editor.setPosition(range.getStartPosition());
    }
}

//#endregion

type OperatorEntry = {
    action: OperatorFunction,
    isEdit?: boolean, // default true
    shouldRecord?: boolean, // default true
    ncmdCountChar?: string | string[], // {count}~
    ncmdCountLine?: string | string[], // {count}J
    ncmdCursor?: string | string[], // p
    nkey?: string, // d{motion}
    nline?: string[] | string | true, // d{count}d
    nsynonym?: {[k: string]: MotionFunction},
    vkey?: string[] | string,
    vline?: string[] | string, // linewise arg from charwise visual
};

let operators: OperatorEntry[] = [
    {action: deleteText, nkey: 'd', nline: true, vkey: ['d', 'x', '<Del>', '<BS>'], vline: ['X', 'D'], nsynonym: {
        'x': spMotion.right,
        '<Del>': spMotion.right,
        'X': spMotion.left,
        'D': spMotion.EOL,
    }},
    {action: joinLines, ncmdCountLine: 'J', vkey: 'J'},
    {action: deleteAndInsert, shouldRecord: false, nkey: 'c', nline: true, ncmdCountLine: 'S', vkey: ['c', 's'], vline: ['C', 'S', 'R'], nsynonym: {
        'C': spMotion.EOL,
        's': spMotion.right,
    }},
    {action: joinLinesPreserveSpaces, ncmdCountLine: 'gJ', vkey: 'gJ'},
    {action: lowerCase, nkey: 'gu', nline: ['gu', 'u'], vkey: ['gu', 'u']},
    {action: upperCase, nkey: 'gU', nline: ['gU', 'U'], vkey: ['gU', 'U']},
    {action: toggleCase, ncmdCountChar: '~', nkey: 'g~', nline: ['g~', '~'], vkey: ['g~', '~']},
    {action: addNumber, ncmdCursor: '<C-A>', vkey: '<C-A>'},
    {action: subtractNumber, ncmdCursor: '<C-X>', vkey: '<C-X>'},
    {action: addNumberBySequence, vkey: 'g<C-A>'},
    {action: subtractNumberBySequence, vkey: 'g<C-X>'},
    {action: indent, nkey: '>', vkey: '>', nline: true},
    {action: outdent, nkey: '<', vkey: '<', nline: true},
    {action: format, nkey: '=', vkey: '=', nline: true},
    {action: yank, isEdit: false, nkey: 'y', nline: true, ncmdCountLine: 'Y', vkey: 'y', vline: 'Y'},
    {action: putTextAfter, ncmdCursor: 'p', vkey: 'p'},
    {action: putTextAfterAndCursorAtNext, ncmdCursor: 'gp', vkey: 'gp'},
    {action: putTextBefore, ncmdCursor: 'P'},
    {action: putTextBeforeAndCursorAtNext, ncmdCursor: 'gP', vkey: 'gP'},
];


//#region construct commands

type NormalSeqValue = {
    command: ICommand,
    motion?: MotionFunction,
    matchNext?: boolean,
}

let normalSeqMap = createSeqMap<number, NormalSeqValue>([]);
let normalCmdPatterns = P.seq(normalSeqMap, (cap, val) => {
    let value = val as NormalSeqValue;
    cap.command = value.command;
    cap.motion = value.motion;
    return value.matchNext !== true;
});
normalCmdPatterns = P.concatList([normalCmdPatterns, P.common.linewisePart, P.alternate(motionPattern, objectSelectionPattern)]);

let normalLinePatterns: P.Pattern[] = [];

let visualSeqMap = createSeqMap<number, ICommand>([]);
let visualCmdPatterns = P.seq(visualSeqMap, (cap, val) => void(cap.command = val));

function each<T>(what: T | T[], callback: (x: T)=>void) {
    if (Array.isArray(what)) {
        what.forEach(x => callback(x));
    }
    else {
        callback(what);
    }
}

function doOperator(cmd: ICommand, fn: OperatorFunction, ctx: ICommandContext, arg: OperatorArg, cb: ()=>void): void | PromiseLike<void> {
    return helper.doThen(fn.apply(cmd, [ctx, arg]), cb);
}

for (const entry of operators) {
    let action = entry.action;
    let isEdit = entry.isEdit !== false;
    let shouldRecord = isEdit && entry.shouldRecord !== false;

    if (entry.ncmdCountChar) {
        let command = createCommand({shouldRecord, run(ctx, args) {
            let start = ctx.position.get();
            let end = ctx.position.get().setColumn(start.column + (args.count || 1));
            let arg = createCharRangeArg(Source.ByCount, args, monaco.Range.fromPositions(start, end));
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            return doOperator(this, action, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());
            });
        }});
        each(entry.ncmdCountChar, x => addSeqMapItem(normalSeqMap, keyUtils.parse(x), { command }));
    }

    if (entry.ncmdCountLine) {
        let command = createCommand({shouldRecord, run(ctx, args) {
            let first = ctx.position.get().lineNumber;
            let last = Math.min(ctx.model.getLineCount(),  first + (args.count || 1) - 1);
            let arg = createLineRangeArg(Source.ByCount, args, [first, last]);
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            return doOperator(this, action, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());
            });
        }});
        each(entry.ncmdCountLine, x => addSeqMapItem(normalSeqMap, keyUtils.parse(x), { command }));
    }

    if (entry.ncmdCursor) {
        let command = createCommand({shouldRecord, run(ctx, args) {
            let range = ctx.position.get().toRange();
            let arg = createCharRangeArg(Source.Cursor, args, range);
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            return doOperator(this, action, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());
            });
        }});
        each(entry.ncmdCursor, x => addSeqMapItem(normalSeqMap, keyUtils.parse(x), { command }));
    }

    if (entry.nkey) {
        let command = createCommand({shouldRecord, run(ctx, args) {
            if (action === deleteAndInsert && args.motion === spMotion.word) {
                args.motion = spMotion.altWord;
            }
            else if (action === deleteAndInsert && args.motion === spMotion.fullWord) {
                args.motion = spMotion.altFullWord;
            }
            let result = applyMotion('Operator', ctx, args);
            if (!result.to) {
                return;
            }
            let arg: OperatorArg;
            let linewise = args.linewise !== undefined ? args.linewise : (result.linewise === true);
            if (linewise) {
                arg = createLineRangeArg(Source.Motion, args, [result.from.lineNumber, result.to.lineNumber]);
            }
            else {
                let range = monaco.Range.fromPositions(result.from,  result.inclusive ? ctx.position.get(result.to).move(1) : result.to);
                arg = createCharRangeArg(Source.Motion, args, range);
            }
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            return doOperator(this, action, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());
            });
        }});
        addSeqMapItem(normalSeqMap, keyUtils.parse(entry.nkey), { command, matchNext: true });
    }

    if (entry.nsynonym) {
        let command = createCommand({shouldRecord, run(ctx, args) {
            let result = applyMotion('Operator', ctx, args);
            if (!result.to) {
                return;
            }
            let arg: OperatorArg;
            let linewise = args.linewise !== undefined ? args.linewise : (result.linewise === true);
            if (linewise) {
                arg = createLineRangeArg(Source.Motion, args, [result.from.lineNumber, result.to.lineNumber]);
            }
            else {
                let range = monaco.Range.fromPositions(result.from,  result.inclusive ? ctx.position.get(result.to).move(1) : result.to);
                arg = createCharRangeArg(Source.Motion, args, range);
            }
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            return doOperator(this, action, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());
            });
        }});
        for (let k in entry.nsynonym) {
            addSeqMapItem(normalSeqMap, keyUtils.parse(k), { command, motion: entry.nsynonym[k] });
        }
    }

    if (entry.nkey && entry.nline) {
        if (entry.nline === true) {
            entry.nline = entry.nkey;
        }
        let command = createCommand({shouldRecord,  run(ctx, args) {
            let first = ctx.position.get().lineNumber;
            let last = Math.min(ctx.model.getLineCount(),  first + (args.count || 1) - 1);
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            let arg = createLineRangeArg(Source.ByLine, args, [first, last]);
            return doOperator(this, action, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());
            });
        }});
        each(entry.nline, x => {
            let first = keyUtils.parseToPattern(entry.nkey!);
            let second = keyUtils.parseToPattern(x);
            normalLinePatterns.push(P.concatList([first, P.common.countPart, second, P.setCommand(command)]));
        });
    }

    let vcommand = (linewise: boolean) => {
        return createCommand(function (ctx, args) {
            let command = this;
            let fn = action as OperatorFunction;
            let cursor = ctx.position.get();
            let sel = ctx.editor.getSelection();
            if (!sel) { throw new Error(); }
            let arg: OperatorArg;
            if (ctx.vimState.getMode() === 'VisualLine') {
                arg = createLineRangeArg(Source.Visual, args, [sel.startLineNumber, sel.endLineNumber]);
            }
            else if (linewise === true) {
                arg = createLineRangeArg(Source.Visual, args, sel);
            }
            else {
                arg = createCharRangeArg(Source.Visual, args, sel);
            }
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            if (fn !== deleteAndInsert) {
                let capToRepeat = Object.assign({}, args);
                let command: ICommand;
                if (arg.kind === 'LineRange') {
                    command = forRepeatLineRange(arg.lines[1] - arg.lines[0] + 1)
                }
                else if (arg.kind === 'CharRange') {
                    command = forRepeatCharRange(ctx.model.getValueLengthInRange(arg.range));
                }
                else {
                    throw new Error();
                }
                recorder.setLast(command, capToRepeat);
            }
            return doOperator(this, fn, ctx, arg, () => {
                if (isEdit) {
                    ctx.editor.pushUndoStop();
                }
                ctx.editor.revealPosition(ctx.position.get());

                if (fn !== deleteAndInsert) {
                    ctx.vimState.toNormal();
                }

            });

            function forRepeatLineRange(count: number): ICommand {
                return createCommand((ctx, cap) => {
                    let first = ctx.position.get().lineNumber;
                    let last = Math.min(ctx.model.getLineCount(), first + count - 1);
                    return fn.apply(command, [ctx, createLineRangeArg(Source.Visual, cap, [first, last])]);
                });
            }

            function forRepeatCharRange(length: number): ICommand {
                return createCommand((ctx, cap) => {
                    let start = ctx.position.get();
                    let end = start.clone().move(length);
                    let range = monaco.Range.fromPositions(start, end);
                    return fn.apply(command, [ctx, createCharRangeArg(Source.Visual, cap, range)]);
                });
            }
        });
    }

    if (entry.vkey) {
        let command = vcommand(false);
        each(entry.vkey, x => addSeqMapItem(visualSeqMap, keyUtils.parse(x), command));
    }

    if (entry.vline) {
        let command = vcommand(true);
        each(entry.vline, x => addSeqMapItem(visualSeqMap, keyUtils.parse(x), command));
    }
}

let nRCharPatt = P.concat(P.key('r'), P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.command = createCommand({shouldRecord: true, run(ctx, args) {
        let start = ctx.position.get();
        let end = ctx.position.get().setColumn(start.column + (args.count || 1));
        let arg = createCharRangeArg(Source.ByCount, args, monaco.Range.fromPositions(start, end));
        ctx.editor.pushUndoStop();
        replaceText(ctx, arg, ch);
        ctx.editor.pushUndoStop();
        ctx.editor.revealPosition(ctx.position.get());
    }});
}));


let vRCharPatt = P.concat(P.key('r'), P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.command = createCommand((ctx, cap) => {
        let cursor = ctx.position.get();
        let sel = ctx.editor.getSelection();
        if (!sel) { throw new Error(); }
        let arg = ctx.vimState.getMode() === 'VisualLine' ? createLineRangeArg(Source.Visual, cap, sel) : createCharRangeArg(Source.Visual, cap, sel);
        ctx.editor.pushUndoStop();
        replaceText(ctx, arg, ch);
        ctx.editor.pushUndoStop();
        ctx.editor.revealPosition(ctx.position.get());
    });
}));

export const normalOperatorPattern = P.alternateList([normalCmdPatterns, P.alternateList(normalLinePatterns), nRCharPatt]);
export const visualOperatorPattern = P.alternateList([visualCmdPatterns, vRCharPatt]);

//#endregion
