import { MotionSource } from "../motions";
import { ICommandContext, ICommandArgs } from "../command";
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

export function cloneCommandArgs(args: ICommandArgs, setter?: Partial<ICommandArgs>) {
    return Object.assign({
        count: args.count,
        motion: args.motion,
        register: args.register,
        linewise: args.linewise,
        char: args.char,
    }, setter);
}

export function applyMotion(source: MotionSource, ctx: ICommandContext, mst: ICommandArgs, from?: monaco.IPosition): ApplyMotionResult {
    if (!from) {
        from = ctx.editor.getPosition()!;
    }
    let ret = mst.motion!(ctx, from, mst.count || 1, source, mst.count === undefined);
    if (ret === false) {
        return { from };
    }
    else if (monaco.Position.isIPosition(ret)) {
        return { from, to: ret };
    }
    else {
        return Object.assign(ret, {from: ret.from || from, to: ret.position});
    }
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
