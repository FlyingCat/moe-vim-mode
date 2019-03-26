import { ICommandContext } from "../boot/base";
import { TextPosition, CursorKind } from "./position";
import * as monaco from "monaco-editor";
import { isCommentOrStringAtPosition } from "../utils/token";

export class TextBracket {
    static findClosing(ctx: ICommandContext, position: monaco.IPosition, pair: [string, string], count: number): TextPosition | undefined {
        let pos = ctx.position.get(position);
        let strict: boolean | undefined;
        if (pos.char === pair[0]) {
            strict = !isCommentOrStringAtPosition(ctx.model, pos);
            if (!pos.forward()) {
                return undefined;
            }
        }
        let stack = 0;
        while (!pos.isEOF) {
            let char = pos.char;
            if (char === pair[1] && !(strict && isCommentOrStringAtPosition(ctx.model, pos))) {
                if (stack === 0) {
                    if (count === 1) {
                        return pos;
                    }
                    else {
                        count--;
                    }
                }
                else {
                    stack--;
                }
            }
            else if (char === pair[0] && !(strict && isCommentOrStringAtPosition(ctx.model, pos))) {
                stack++;
            }
            pos.forward();
        }
        return undefined;
    }

    static findOpening(ctx: ICommandContext, position: monaco.IPosition, pair: [string, string], count: number): TextPosition | undefined {
        let pos = ctx.position.get(position);
        let strict: boolean | undefined;
        if (pos.char === pair[1]) {
            strict = !isCommentOrStringAtPosition(ctx.model, pos);
            if (!pos.backward()) {
                return undefined;
            }
        }
        let stack = 0;
        do {
            let char = pos.char;
            if (char === pair[0] && !(strict && isCommentOrStringAtPosition(ctx.model, pos))) {
                if (stack === 0) {
                    if (count === 1) {
                        return pos;
                    }
                    else {
                        count--;
                    }
                }
                else {
                    stack--;
                }
            }
            else if (char === pair[1] && !(strict && isCommentOrStringAtPosition(ctx.model, pos))) {
                stack++;
            }
        } while (pos.backward())
        return undefined;
    }

    static findOuterPair(ctx: ICommandContext, pos: monaco.IPosition, pair: [string, string], count: number) {
        let from = TextBracket.findOpening(ctx, pos, pair, count);
        if (!from) {
            return null;
        }
        let to = TextBracket.findClosing(ctx, pos, pair, count);
        return from && to ? {from, to} : null;
    }

    static findInnerPair(ctx: ICommandContext, pos: monaco.IPosition, pair: [string, string], count: number) {
        let result = this.findOuterPair(ctx, pos, pair, count);
        if (result) {
            return TextBracket.getInnerPariRange(ctx, result.from, result.to);
        }
        return null;
    }

    private static getInnerPariRange(ctx: ICommandContext, from: TextPosition, to: TextPosition) {
        from.forward();
        if (!monaco.Position.isBefore(from, to)) {
            return null;
        }
        let linewise = false;
        if (from.kind === CursorKind.EOL && from.lineNumber + 1 < to.lineNumber) {
            let firstNonBlank = from.clone().setColumn('^');
            if (firstNonBlank.column === to.column) {
                from = ctx.position.get(from.lineNumber + 1, 1);
                to = ctx.position.get(to.lineNumber - 1, '$');
                linewise = true;
            }
        }
        if (!linewise) {
            to.backward(); // inclusive
        }
        return {from, to, linewise};
    }
}
