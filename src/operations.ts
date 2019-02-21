import { SeqMap, createSeqMap } from "./matching/seqMap";
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

type OperatorArgUnion = {
    kind: 'General',
} | {
    kind: 'CharRange',
    range: monaco.IRange;
} | {
    kind: 'LineRange',
    range?: monaco.IRange; // original from motion or selection
    lines: [number, number]; // [first, last]
};

type OperatorArg = OperatorArgUnion & {
    // count?: number; // command, visual indent/outdent
    // register?: number;
    commandArgs: ICommandArgs
};

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

function createGeneralArg(commandArgs: ICommandArgs): OperatorArg {
    return {
        kind: 'General',
        commandArgs,
    }
}

function createCharRangeArg(commandArgs: ICommandArgs, range: monaco.IRange): OperatorArg {
    return {
        kind: 'CharRange',
        commandArgs,
        range,
    }
}

function createLineRangeArg(commandArgs: ICommandArgs, what: [number, number] | monaco.IRange): OperatorArg {
    let lines: [number, number];
    let range: monaco.IRange | undefined;
    if (Array.isArray(what)) {
        lines = what;
    }
    else {
        lines = linesFromRange(what);
        range = what;
    }
    return {
        kind: 'LineRange',
        commandArgs,
        range,
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
    if (first === 1 && last === lineCount) {
        ctx.editor.setValue('');
        return 1;
    }
    let range: monaco.Range;
    if (last !== lineCount) {
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
        deleteAndInsertImpl(ctx, createLineRangeArg(args, [first, last]));
    });
}

function forRepeatCharRangeDeleteAndInsert(length: number): ICommand {
    return createCommand((ctx, args) => {
        let start = ctx.position.get();
        let end = start.clone().move(length);
        let range = monaco.Range.fromPositions(start, end);
        deleteAndInsertImpl(ctx, createCharRangeArg(args, range));
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
    if (arg.kind === 'General') {
        let start = ctx.position.get();
        let end = ctx.position.get(start.lineNumber, start.column + (arg.commandArgs.count || 1));
        let range = monaco.Range.fromPositions(start, end);
        executeEdits(ctx, [{range, text: char.repeat(end.column - start.column)}], () => end.move(-1));
    }
    else {
        let range = coveredRange(ctx, arg);
        let ranges = helper.splitRangeByLineEnding(ctx.model, range);
        let edits = ranges.map(x => ({range: x, text: char.repeat(x.endColumn - x.startColumn)}));
        executeEdits(ctx, edits, () => range.getStartPosition());
    }
}

const joinLines = (ctx: ICommandContext, arg: OperatorArg, preserveSpaces?: boolean) => {
    let lines = coveredLines(arg);
    let lineCount = ctx.model.getLineCount();
    if (lines[0] === lineCount) {
        return;
    }
    if (lines[0] === lines[1]) {
        lines[1] = lines[1] + 1;
    }
    let n = lines[1] - lines[0];
    let ln = lines[0];
    let col = 0;
    if (preserveSpaces) {
        while (n !== 0) {
            let pos = ctx.position.get(ln, 'eol');
            if (n === 1) {
                col = pos.column;
            }
            let range = monaco.Range.fromPositions(pos, {lineNumber: ln + 1, column: 1});
            ctx.editor.executeEdits('vim', [{range, text: ''}]);
            n--;
        }
        ctx.editor.setPosition(ctx.position.get(lines[0], col).soft());
    }
    else {
        /**
         * vim doc:
         * #1 insert one space in place of the <EOL> unless there is trailing white space
         * or the next line starts with a ')'
         * #2 delete any leading white space on the next line
         */
        while (n !== 0) {
            let pos = ctx.position.get(ln, '$');
            let endWithSpace = pos.isBlank;
            pos.setColumn('eol');
            if (n === 1) {
                col = pos.column;
            }
            let end = ctx.position.get(ln + 1, 1).shouldWrap(false);
            if (end.kind === CursorKind.Whitespace) {
                end.stepTo(x => x.kind !== CursorKind.Whitespace);
            }
            let range = monaco.Range.fromPositions(pos, end);
            let text = endWithSpace || end.char === ')' ? '' : ' ';
            ctx.editor.executeEdits('vim', [{range, text}])
            n--;
        }
        ctx.editor.setPosition(ctx.position.get(ln, col).soft());
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
    if (arg.kind === 'General') {
        let start = ctx.position.get();
        let end = ctx.position.get(start.lineNumber, start.column + (arg.commandArgs.count || 1));
        range = monaco.Range.fromPositions(start, end);
        pos = end.soft();
    }
    else {
        range = coveredRange(ctx, arg);
        pos = ctx.position.soften(range.getStartPosition());
    }
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
        let range = monaco.Range.fromPositions(ctx.position.get(), ctx.position.get(lines[1], 'eol'));
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
        range = monaco.Range.lift(arg.range);
        registerManager.storeText(ctx.model.getValueInRange(range), false, 'delete')
        if (item.linewise) {
            text = '\n' + text + '\n';
        }
    }
    else {
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

type OperatorEntry = {
    action: OperatorFunction,
    isEdit?: boolean, // true
    shouldRecord?: boolean, // true
    ncmd?: string | string[], // J
    nkey?: string, // d{motion}
    nline?: string[] | string | true, // d[count]d
    vkey?: string[] | string,
    vline?: string[] | string, // linewise arg from charwise visual
    synonym?: {[k: string]: MotionFunction},
};

let operators: OperatorEntry[] = [
    {action: deleteText, nkey: 'd', nline: true, vkey: ['d', 'x', '<Del>', '<BS>'], vline: ['X', 'D'], synonym: {
        'x': spMotion.right,
        '<Del>': spMotion.right,
        'X': spMotion.left,
        'D': spMotion.EOL,
    }},
    {action: joinLines, vkey: 'J', synonym: {
        'J': FakeNLinesMotion,
    }},
    {action: deleteAndInsert, shouldRecord: false, nkey: 'c', nline: true, vkey: ['c', 's'], vline: ['C', 'S', 'R'], synonym: {
        'C': spMotion.EOL,
        's': spMotion.right,
        'S': FakeNLinesMotion,
    }},
    {action: joinLinesPreserveSpaces, vkey: 'gJ', synonym: {
        'gJ': FakeNLinesMotion,
    }},
    {action: lowerCase, nkey: 'gu', nline: ['gu', 'u'], vkey: ['gu', 'u']},
    {action: upperCase, nkey: 'gU', nline: ['gU', 'U'], vkey: ['gU', 'U']},
    {action: toggleCase, ncmd: '~', nkey: 'g~', nline: ['g~', '~'], vkey: ['g~', '~']},
    {action: indent, nkey: '>', vkey: '>', nline: true},
    {action: outdent, nkey: '<', vkey: '<', nline: true},
    {action: format, nkey: '=', vkey: '=', nline: true},
    {action: yank, isEdit: false, nkey: 'y', nline: true, vkey: 'y', vline: 'Y', synonym: {
        'Y': FakeNLinesMotion,
    }},
    {action: putTextAfter, ncmd: 'p', vkey: 'p'},
    {action: putTextAfterAndCursorAtNext, ncmd: 'gp', vkey: 'gp'},
    {action: putTextBefore, ncmd: 'P'},
    {action: putTextBeforeAndCursorAtNext, ncmd: 'gP', vkey: 'gP'},
];

let nCmdList: {seq: number[], val: {action: OperatorFunction, isEdit: boolean, shouldRecord: boolean, acceptMotion: boolean | MotionFunction}}[] = [];
let nLineCmdList: [P.Pattern, P.Pattern, OperatorFunction, boolean, boolean][] = [];
let vCmdList: {seq: number[], val: {action: OperatorFunction, isEdit: boolean, shouldRecord: boolean, linewise: boolean}}[] = [];

for (const entry of operators) {
    let action = entry.action;
    let keyNumbers: number[];

    let isEdit = entry.isEdit !== false;
    let shouldRecord = isEdit && entry.shouldRecord !== false;

    if (entry.ncmd) {
        let val = {action, isEdit, shouldRecord, acceptMotion: false};
        if (typeof entry.ncmd === 'string') {
            nCmdList.push({seq: keyUtils.parse(entry.ncmd), val});
        }
        else if (Array.isArray(entry.ncmd)) {
            entry.ncmd.forEach(x => nCmdList.push({seq: keyUtils.parse(x), val}));
        }
    }

    if (entry.nkey) {
        keyNumbers = keyUtils.parse(entry.nkey);
        nCmdList.push({seq: keyNumbers, val: {action, isEdit, shouldRecord, acceptMotion: true}});
        let nline = entry.nline;
        if (nline) {
            let p = P.keyList(keyNumbers);
            if (nline === true) {
                nLineCmdList.push([p, p, action, isEdit, shouldRecord]);
            }
            else if (typeof nline === 'string') {
                nLineCmdList.push([p, keyUtils.parseToPattern(nline), action, isEdit, shouldRecord]);
            }
            else {
                nline.forEach(x => {
                    nLineCmdList.push([p, keyUtils.parseToPattern(x), action, isEdit, shouldRecord]);
                });
            }
        }
    }

    if (entry.synonym) {
        for (let key in entry.synonym) {
            let motion = entry.synonym[key];
            nCmdList.push({seq: keyUtils.parse(key), val: {action, isEdit, shouldRecord, acceptMotion: motion}});
        }
    }

    if (entry.vkey) {
        if (typeof entry.vkey === 'string') {
            vCmdList.push({seq: keyUtils.parse(entry.vkey), val: {action, isEdit, shouldRecord, linewise: false}});
        }
        else {
            entry.vkey.forEach(x => vCmdList.push({seq: keyUtils.parse(x), val: {action, isEdit, shouldRecord, linewise: false}}));
        }
    }

    if (entry.vline) {
        if (typeof entry.vline === 'string') {
            vCmdList.push({seq: keyUtils.parse(entry.vline), val: {action, isEdit, shouldRecord, linewise: true}});
        }
        else {
            entry.vline.forEach(x => vCmdList.push({seq: keyUtils.parse(x), val: {action, isEdit, shouldRecord, linewise: true}}));
        }
    }
}

let nCmdPatt = P.seq(createSeqMap(nCmdList), (cap, val) => {
    let item = val as {action: OperatorFunction; shouldRecord: boolean; isEdit: boolean; acceptMotion: boolean | MotionFunction};
    let shouldRecord = item.shouldRecord;
    cap.command = createCommand({shouldRecord, run(ctx, args) {
        if (typeof item.acceptMotion !== 'boolean') {
            args.motion = item.acceptMotion;
        }
        let arg: OperatorArg;
        if (item.acceptMotion !== false) {
            if (item.action === deleteAndInsert && args.motion === spMotion.word) {
                args.motion = spMotion.altWord;
            }
            else if (item.action === deleteAndInsert && args.motion === spMotion.fullWord) {
                args.motion = spMotion.altFullWord;
            }
            let result = applyMotion('Operator', ctx, args);
            if (!result.to) {
                return;
            }
            let linewise = args.linewise !== undefined ? args.linewise : (result.linewise === true);
            if (linewise) {
                arg = createLineRangeArg(args, [result.from.lineNumber, result.to.lineNumber]);
            }
            else {
                let range = monaco.Range.fromPositions(result.from,  result.inclusive ? ctx.position.get(result.to).move(1) : result.to);
                arg = createCharRangeArg(args, range);
            }
        }
        else {
            arg = createGeneralArg(args);
        }
        if (item.isEdit) {
            ctx.editor.pushUndoStop();
        }
        return doOperator(this, item.action, ctx, arg, () => {
            if (item.isEdit) {
                ctx.editor.pushUndoStop();
            }
            ctx.editor.revealPosition(ctx.position.get());
        });
    }});
    return item.acceptMotion !== true;
});
nCmdPatt = P.concatList([nCmdPatt, P.common.linewisePart, P.alternate(motionPattern, objectSelectionPattern)]);

let lineCommandForOperator = (fn: OperatorFunction, isEdit: boolean, shouldRecord: boolean): ICommand => {
    return createCommand({shouldRecord,  run(ctx, args) {
        let first = ctx.position.get().lineNumber;
        let last = Math.min(ctx.model.getLineCount(),  first + (args.count || 1) - 1);
        if (isEdit) {
            ctx.editor.pushUndoStop();
        }
        let arg = createLineRangeArg(args, [first, last]);
        return doOperator(this, fn, ctx, arg, () => {
            if (isEdit) {
                ctx.editor.pushUndoStop();
            }
            ctx.editor.revealPosition(ctx.position.get());
        });
    }});
}
let nLineCmdPatt = P.alternateList(nLineCmdList.map(x => P.concatList([x[0], P.common.countPart, x[1], P.setCommand(lineCommandForOperator(x[2], x[3], x[4]))])));

let nRCharPatt = P.concat(P.key('r'), P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.command = createCommand({shouldRecord: true, run(ctx, cap) {
        let arg = createGeneralArg(cap);
        ctx.editor.pushUndoStop();
        replaceText(ctx, arg, ch);
        ctx.editor.pushUndoStop();
        ctx.editor.revealPosition(ctx.position.get());
    }});
}));

export const normalOperatorPattern = P.alternateList([nCmdPatt, nLineCmdPatt, nRCharPatt]);

let vRCharPatt = P.concat(P.key('r'), P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.command = createCommand((ctx, cap) => {
        let cursor = ctx.position.get();
        let sel = ctx.editor.getSelection();
        if (!sel) { throw new Error(); }
        let arg = ctx.vimState.getMode() === 'VisualLine' ? createLineRangeArg(cap, sel) : createCharRangeArg(cap, sel);
        ctx.editor.pushUndoStop();
        replaceText(ctx, arg, ch);
        ctx.editor.pushUndoStop();
        ctx.editor.revealPosition(ctx.position.get());
    });
}));

export const visualOperatorPattern = P.alternate(vRCharPatt, P.seq(createSeqMap(vCmdList), (cap, val) => {
    let isEdit: boolean = val.isEdit;
    cap.command = createCommand(function (ctx, cap) {
        let command = this;
        let fn = val.action as OperatorFunction;
        let cursor = ctx.position.get();
        let sel = ctx.editor.getSelection();
        if (!sel) { throw new Error(); }
        let arg: OperatorArg;
        if (ctx.vimState.getMode() === 'VisualLine') {
            arg = createLineRangeArg(cap, [sel.startLineNumber, sel.endLineNumber]);
        }
        else if (val.linewise === true) {
            arg = createLineRangeArg(cap, sel);
        }
        else {
            arg = createCharRangeArg(cap, sel);
        }
        if (isEdit) {
            ctx.editor.pushUndoStop();
        }
        if (fn !== deleteAndInsert) {
            let capToRepeat = Object.assign({}, cap);
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
                return fn.apply(command, [ctx, createLineRangeArg(cap, [first, last])]);
            });
        }

        function forRepeatCharRange(length: number): ICommand {
            return createCommand((ctx, cap) => {
                let start = ctx.position.get();
                let end = start.clone().move(length);
                let range = monaco.Range.fromPositions(start, end);
                return fn.apply(command, [ctx, createCharRangeArg(cap, range)]);
            });
        }
    });
}));

function doOperator(cmd: ICommand, fn: OperatorFunction, ctx: ICommandContext, arg: OperatorArg, cb: ()=>void): void | PromiseLike<void> {
    return helper.doThen(fn.apply(cmd, [ctx, arg]), cb);
}
