import { ICommandContext } from "../command";
import { TextPosition, CursorKind } from "./position";
import * as monaco from "monaco-editor";

export class TextBracket {
    static findClosing(ctx: ICommandContext, position: monaco.IPosition, pair: [string, string], count: number): TextPosition | undefined {
        let pos = ctx.position.get(position);
        if (pos.char === pair[0]) {
            if (!pos.forward()) {
                return undefined;
            }
        }
        let stack = 0;
        while (!pos.isEOF) {
            let char = pos.char;
            if (char === pair[1]) {
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
            else if (char === pair[0]) {
                stack++;
            }
            pos.forward();
        }
        return undefined;
    }

    static findOpening(ctx: ICommandContext, position: monaco.IPosition, pair: [string, string], count: number): TextPosition | undefined {
        let pos = ctx.position.get(position);
        if (pos.char === pair[1]) {
            if (!pos.backward()) {
                return undefined;
            }
        }
        let stack = 0;
        do {
            let char = pos.char;
            if (char === pair[0]) {
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
            else if (char === pair[1]) {
                stack++;
            }
        } while (pos.backward())
        return undefined;
    }

    static findOuterPair(ctx: ICommandContext, pos: monaco.IPosition, pair: [string, string], count: number) {
        let from = TextBracket.findOpening(ctx, pos, pair, count);
        if (!from) {
            return false;
        }
        let position = TextBracket.findClosing(ctx, pos, pair, count);
        return from && position ? {from, position} : false;
    }

    static findInnerPair(ctx: ICommandContext, pos: monaco.IPosition, pair: [string, string], count: number) {
        let result = this.findOuterPair(ctx, pos, pair, count);
        if (result) {
            return TextBracket.getInnerPariRange(result.from, result.position);
        }
        return false;
    }

    private static getInnerPariRange(from: TextPosition, position: TextPosition) {
        from.forward();
        if (!monaco.Position.isBefore(from, position)) {
            return false;
        }
        let linewise = false;
        if (from.kind === CursorKind.EOL && from.lineNumber + 1 < position.lineNumber) {
            let firstNonBlank = from.clone().setColumn('^');
            if (firstNonBlank.column === position.column) {
                from.forward();
                position.setColumn(1);
                linewise = true;
            }
        }
        position.backward(); // inclusive
        return {from, position, linewise};
    }
}
