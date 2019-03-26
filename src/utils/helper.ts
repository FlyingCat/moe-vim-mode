import { ICommandArgs, ICommandContext } from "../boot/base";
import * as monaco from "monaco-editor";

type ApplyMotionResult = {
    from: monaco.IPosition;
    to?: monaco.IPosition;
    inclusive?: boolean;
    keepPrevDesiredColumn?: boolean;
    desiredColumnAtEol?: boolean;
    linewise?: boolean;
    isJump?: boolean;
}

export function rangeFromLines(ctx: ICommandContext, lines: [number, number]) {
    let start = {lineNumber: lines[0], column: 1};
    let end = {lineNumber: lines[1], column: ctx.model.getLineMaxColumn(lines[1])};
    return monaco.Range.fromPositions(start, end);
}

export function mergePositions(positions: ReadonlyArray<monaco.IPosition>): monaco.IPosition[] {
    if (positions.length === 0) {
        return [];
    }
    let list = positions.map(x => ({lineNumber: x.lineNumber, column: x.column}));
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; ) {
            if (monaco.Position.equals(list[i], list[j])) {
                list.splice(j, 1);
            }
            else {
                j++;
            }
        }
    }
    return list;
}

export function mergeRanges(ranges: ReadonlyArray<monaco.IRange>): monaco.Range[] {
    if (ranges.length === 0) {
        return [];
    }
    let list = ranges.map(x => monaco.Range.lift(x));
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; ) {
            let r = monaco.Range.intersectRanges(list[i], list[j]);
            if (r) {
                list[i] = monaco.Range.plusRange(list[i], list[j]);
                list.splice(j, 1);
            }
            else {
                j++;
            }
        }
    }
    return list;
}

type LineRange = { first: number; last: number; }
export function mergeLineRanges(ranges: ReadonlyArray<LineRange>, touched?: boolean): LineRange[] {
    if (ranges.length === 0) {
        return [];
    }
    let list = Array.from(ranges);
    const delta = touched ? 1 : 0;
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; ) {
            if (list[j].first <= list[i].last + delta && list[j].last >= list[i].first - delta) {
                let first = Math.min(list[i].first, list[j].first);
                let last = Math.max(list[i].last, list[j].last);
                list[i] = {first, last};
                list.splice(j, 1);
            }
            else {
                j++;
            }
        }
    }
    return list;
}

type LineSelection = { start: number; target: number; }
export function mergeLineSelections(selections: ReadonlyArray<LineSelection>): LineSelection[] {
    let list = selections.map(x => {
        let inverse = x.target < x.start;
        return {
            inverse,
            first: inverse ? x.target : x.start,
            last: inverse ? x.start : x.target,
            get start() { return this.inverse ? this.last : this.first},
            get target() { return this.inverse ? this.first : this.last},
        }
    });
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; ) {
            if (list[j].first - 1 <= list[i].last && list[j].last + 1 >= list[i].first) {
                list[i].first = Math.min(list[i].first, list[j].first);
                list[i].last = Math.max(list[i].last, list[j].last);
                list.splice(j, 1);
            }
            else {
                j++;
            }
        }
    }
    return list;
}

export function mergeSelections(selections: ReadonlyArray<monaco.Selection>): monaco.Selection[] {
    if (selections.length === 0) {
        return [];
    }
    let list = Array.from(selections);
    for (let i = 0; i < list.length; i++) {
        let direction = list[i].getDirection();
        for (let j = i + 1; j < list.length; ) {
            let r = monaco.Range.intersectRanges(list[i], list[j]);
            if (r) {
                let range = monaco.Range.plusRange(list[i], list[j]);
                list[i] = monaco.Selection.createWithDirection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn, direction);
                list.splice(j, 1);
            }
            else {
                j++;
            }
        }
    }
    return list;
}

export function executeEdits(ctx: ICommandContext, edits: monaco.editor.IIdentifiedSingleEditOperation | monaco.editor.IIdentifiedSingleEditOperation[], position: () => monaco.IPosition) {
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

export function cloneCommandArgs(args: ICommandArgs, setter?: Partial<ICommandArgs>) {
    return Object.assign({
        count: args.count,
        motion: args.motion,
        register: args.register,
        linewise: args.linewise,
        char: args.char,
    }, setter);
}

export function splitRangeByLineEnding(model: monaco.editor.ITextModel, range: monaco.IRange): monaco.Range[] {
    if (range.startLineNumber == range.endLineNumber) {
        return [monaco.Range.lift(range)];
    }
    let result: monaco.Range[] = [];
    let ln = range.startLineNumber;
    result.push(new monaco.Range(ln, range.startColumn, ln, model.getLineMaxColumn(ln)))
    for (ln = ln + 1; ln < range.endLineNumber; ln++) {
        result.push(new monaco.Range(ln, 1, ln, model.getLineMaxColumn(ln)));
    }
    if (range.endColumn !== 1) {
        result.push(new monaco.Range(ln, 1, ln, range.endColumn));
    }
    return result;
}

function isPromiseLike<T>(v): v is PromiseLike<T> {
    if (typeof v === 'object' && (v as PromiseLike<T>).then) {
        return true;
    }
    else {
        return false;
    }
}

export function doThen<T, R>(result: T | PromiseLike<T>, fn: (value: T) => R): R | PromiseLike<R> {
    if (isPromiseLike(result)) {
        return result.then(fn);
    }
    else {
        return fn(result);
    }
}
