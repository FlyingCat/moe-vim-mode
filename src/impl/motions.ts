import { IMotion, MotionFunction, ICommandContext } from "../boot/base";
import { CursorKind } from "../text/position";
import { TextBound } from "../text/bound";
import { registerMotion, registerTextObject } from "../boot/registry";
import { TextBracket } from "../text/bracket";
import * as monaco from "monaco-editor";

export const spMotion: {[k in 'left' | 'right' | 'EOL' | 'word' | 'fullWord' | 'altWord' | 'altFullWord']: IMotion} = {
    left: { run(ctx, pos, count) {
        return pos.column === 1 ? null : ctx.position.get(pos.lineNumber, pos.column - count);
    }},
    right: { run(ctx, positin, count, source) {
        let pos = ctx.position.get(positin).shouldWrap(false);
        if (source === 'Move') {
            if (pos.isLineLastChar) {
                return null;
            }
        }
        else if (source === 'Select') {
            if (pos.kind === CursorKind.EOL) {
                return null;
            }
        }
        return ctx.position.get(pos.lineNumber, pos.column + count);
    }},
    EOL: { inclusive: true, desiredColumnAtEol: true, run(ctx, pos, count, source) {
        // vim doc: In Visual mode the cursor goes to just after the last character in the line.
        let position = ctx.position.get(pos.lineNumber + count - 1, source === 'Select' ? 'eol' : '$');
        return position;
    }},
    word: { run(ctx, pos, count, source) {
        return TextBound.findNextWordStart(ctx.editor, pos, count, false, false, source === 'Operator');
    }},
    fullWord: { run(ctx, pos, count, source) {
        return TextBound.findNextWordStart(ctx.editor, pos, count, true, false, source === 'Operator');
    }},
    altWord: { run(ctx, pos, count) {
        return TextBound.findNextWordStart(ctx.editor, pos, count, false, true);
    }},
    altFullWord: { run(ctx, pos, count) {
        return TextBound.findNextWordStart(ctx.editor, pos, count, true, true);
    }},
}

//#region left-right
registerMotion('h, <Left>, <BS>', spMotion.left);
registerMotion('l, <Right>, <Space>', spMotion.right);
let firstChar: MotionFunction = (ctx, pos, count) => {
    return {lineNumber: pos.lineNumber, column: 1};
};
registerMotion('<Home>', firstChar);
registerMotion('0', firstChar, 'no');
registerMotion('^', (ctx, pos, count) => {
    return ctx.position.get(pos.lineNumber, '^');
});
registerMotion('$, <End>', spMotion.EOL);
registerMotion('g_', {inclusive: true, run: (ctx, pos, count) => {
    let position = ctx.position.get(pos.lineNumber + count - 1, 'g_');
    return position;
}});
//#endregion


//#region up-down
registerMotion('k, <Up>', { keepPrevDesiredColumn: true, linewise: true, run: (ctx, pos, count, source) => {
    if (pos.lineNumber === 1) {
        return null;
    }
    let position = ctx.position.get(pos.lineNumber - count, ctx.vimState.desiredColumn);
    return position;
}});
registerMotion('j, <Down>', { keepPrevDesiredColumn: true, linewise: true, run: (ctx, pos, count, source) => {
    if (pos.lineNumber === ctx.model.getLineCount()) {
        return null;
    }
    let position = ctx.position.get(pos.lineNumber + count, ctx.vimState.desiredColumn);
    return position;
}});
registerMotion('gk, g<Up>', (ctx, pos, count) => {
    ctx.editor.trigger('vim', 'cursorMove', { to: 'up', select: false, by: 'wrappedLine', value: count });
    return ctx.editor.getPosition()!;
});
registerMotion('gj, g<Down>', (ctx, pos, count) => {
    ctx.editor.trigger('vim', 'cursorMove', { to: 'down', select: false, by: 'wrappedLine', value: count });
    return ctx.editor.getPosition()!;
});
registerMotion('-', { linewise: true, run: (ctx, pos, count, source) => {
    let position = ctx.position.get(pos.lineNumber - count, '^');
    return position;
}});
registerMotion('+, <CR>, <C-M>', { linewise: true, run: (ctx, pos, count, source) => {
    let position = ctx.position.get(pos.lineNumber + count, '^');
    return position;
}});
registerMotion('_', { linewise: true, run: (ctx, pos, count, source) => {
    let position = ctx.position.get(pos.lineNumber + count - 1, '^');
    return position;
}});
registerMotion('G', { linewise: true, isJump: true, run: (ctx, pos, count, source, implicitCount) => {
    let position = ctx.position.get(implicitCount ? '$' : count, '^');
    return position;
}});
registerMotion('<C-End>', { inclusive: true, isJump: true, run: (ctx, pos, count, source, implicitCount) => {
    let position = ctx.position.get(implicitCount ? '$' : count, '$');
    return position;
}});
registerMotion('gg, <C-Home>', {linewise: true, isJump: true, run: (ctx, pos, count, source, implicitCount) => {
    let position = ctx.position.get(implicitCount ? 1 : count, '^');
    return position;
}});
registerMotion('%', { linewise: true, isJump: true, run: (ctx, pos, count) => {
    let lineCount = ctx.model.getLineCount();
    let ln = Math.floor((count * lineCount + 99) / 100);
    let position = ctx.position.get(ln, '^');
    return position;
}}, 'required');
//#endregion

//#region word
registerMotion('w', spMotion.word);
registerMotion('W', spMotion.fullWord);
registerMotion('e', { inclusive: true, run: (ctx, pos, count) => {
    return TextBound.findNextWordEnd(ctx.editor, pos, count);
}});
registerMotion('E', { inclusive: true, run: (ctx, pos, count) => {
    return TextBound.findNextWordEnd(ctx.editor, pos, count, true);
}});
registerMotion('b', (ctx, pos, count) => {
    return TextBound.findPrevWordStart(ctx.editor, pos, count);
});
registerMotion('B', (ctx, pos, count) => {
    return TextBound.findPrevWordStart(ctx.editor, pos, count, true);
});
registerMotion('ge', { inclusive: true, run: (ctx, pos, count) => {
    return TextBound.findPrevWordEnd(ctx.editor, pos, count);
}});
registerMotion('gE', { inclusive: true, run: (ctx, pos, count) => {
    return TextBound.findPrevWordEnd(ctx.editor, pos, count, true);
}});
//#endregion

//#region various
registerMotion('%', { inclusive: true, isJump: true, run: (ctx, _pos) => {
    let pos = ctx.position.get(_pos);
    let char = pos.char;
    let to: monaco.IPosition | undefined;
    let pairs: [string, string][] = [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
    ];
    pairs.forEach(x => {
        if (char === x[0]) {
            to = TextBracket.findClosing(ctx, pos, x, 1);
        }
        else if (char === x[1]) {
            to = TextBracket.findOpening(ctx, pos, x, 1);
        }
    });
    return to;
}}, 'no');
registerMotion('[(', (ctx, pos, count, source) => {
    return TextBracket.findOpening(ctx, pos, ['(', ')'], count);
});
registerMotion('[{', (ctx, pos, count, source) => {
    return TextBracket.findOpening(ctx, pos, ['{', '}'], count);
});
registerMotion('])', (ctx, pos, count, source) => {
    return TextBracket.findClosing(ctx, pos, ['(', ')'], count);
});
registerMotion(']}', (ctx, pos, count, source) => {
    return TextBracket.findClosing(ctx, pos, ['{', '}'], count);
});
registerMotion('H', { linewise: true, isJump: true, run: (ctx, pos, count, source) => {
    let ranges = ctx.editor.getVisibleRanges();
    let range = ranges[0];
    let lineNumber: number;
    if (range.startColumn === 1) {
        lineNumber = range.startLineNumber;
    }
    else if (range.startLineNumber !== range.endLineNumber) {
        lineNumber = range.startLineNumber + 1;
    }
    else {
        lineNumber = range.startLineNumber;
    }
    let ln = Math.min(range.endLineNumber, lineNumber + count - 1);
    let position = ctx.position.get(ln, '^');
    return position;
}});
registerMotion('M', { linewise: true, isJump: true, run: (ctx, pos, count, source) => {
    let ranges = ctx.editor.getVisibleRanges();
    let range = ranges[0];
    let first = range.startLineNumber;
    let last = range.endLineNumber;
    let lineNumber = first + Math.floor((last - first) / 2);
    let position = ctx.position.get(lineNumber, '^');
    return position;
}});
registerMotion('L', {linewise: true, isJump: true, run: (ctx, pos, count, source) => {
    let ranges = ctx.editor.getVisibleRanges();
    let range = ranges[0];
    let startLineNumber: number;
    if (range.startColumn === 1) {
        startLineNumber = range.startLineNumber;
    }
    else if (range.startLineNumber !== range.endLineNumber) {
        startLineNumber = range.startLineNumber + 1;
    }
    else {
        startLineNumber = range.startLineNumber;
    }
    let ln = Math.max(range.endLineNumber - count + 1, startLineNumber);
    let position = ctx.position.get(ln, '^');
    return position;
}});
//#endregion

//#region left-right char motion
type CharMotionKind = 'f' | 'F' | 't' | 'T';

let lastCharMotion: undefined | {
    kind: CharMotionKind;
    char: string;
};

function isCharMotionInclusive(k: CharMotionKind) {
    return k === 'f' || k === 't';
}

function oppositeDirection(k: CharMotionKind): CharMotionKind {
    let opposite: {[k in CharMotionKind]: CharMotionKind} = {
        f: 'F',
        F: 'f',
        t: 'T',
        T: 't',
    };
    return opposite[k];
}

const charMotion: {[k in CharMotionKind]: (ctx: ICommandContext, pos: monaco.IPosition, count: number, ch: string) => monaco.IPosition | null} = {
    f(ctx, pos, count, ch) {
        lastCharMotion = {
            kind: 'f',
            char: ch,
        }
        let lineNumber = pos.lineNumber;
        let column = pos.column;
        let text = ctx.model.getLineContent(lineNumber);
        if (pos.column >= text.length) {
            return null;
        }
        let index = pos.column - 1;
        while (count && index !== -1) {
            index = text.indexOf(ch, index + 1);
            count--;
        }
        if (index === -1) {
            return null;
        }
        column = index + 1;
        return {lineNumber, column};
    },
    F(ctx, pos, count, ch) {
        lastCharMotion = {
            kind: 'F',
            char: ch,
        }
        let lineNumber = pos.lineNumber;
        let column = pos.column;
        let text = ctx.model.getLineContent(lineNumber);
        if (pos.column === 1) {
            return null;
        }
        let index = pos.column - 1;
        while (count && index !== -1) {
            index = index === 0 ? -1 : text.lastIndexOf(ch, index - 1);
            count--;
        }
        if (index === -1) {
            return null;
        }
        column = index + 1;
        return {lineNumber, column};
    },
    t(ctx, pos, count, ch) {
        lastCharMotion = {
            kind: 't',
            char: ch,
        }
        let lineNumber = pos.lineNumber;
        let column = pos.column;
        let text = ctx.model.getLineContent(lineNumber);
        if (column >= text.length) {
            return null;
        }
        let index = pos.column - 1;
        while (count && index !== -1) {
            index = text.indexOf(ch, index + 1);
            count--;
        }
        if (index === -1) {
            return null;
        }
        column = index + 1 - 1;
        return {lineNumber, column};
    },
    T(ctx, pos, count, ch) {
        lastCharMotion = {
            kind: 'T',
            char: ch,
        }
        let lineNumber = pos.lineNumber;
        let column = pos.column;
        let text = ctx.model.getLineContent(lineNumber);
        let index = pos.column - 1;
        while (count && index !== -1) {
            index = index === 0 ? -1 : text.lastIndexOf(ch, index - 1);
            count--;
        }
        if (index === -1) {
            return null;
        }
        column = index + 1 + 1;
        return {lineNumber, column};
    }
}

registerMotion(['f', {kind: 'Char'}], { inclusive: true, run(ctx, pos, count, _a, _b, args) {
    if (!args.char) {
        throw new Error();
    }
    return charMotion.f(ctx, pos, count, args.char);
}});

registerMotion(['F', {kind: 'Char'}], { run(ctx, pos, count, _a, _b, args) {
    if (!args.char) {
        throw new Error();
    }
    return charMotion.F(ctx, pos, count, args.char);
}});

registerMotion(['t', {kind: 'Char'}], { inclusive: true, run(ctx, pos, count, _a, _b, args) {
    if (!args.char) {
        throw new Error();
    }
    return charMotion.t(ctx, pos, count, args.char);
}});

registerMotion(['T', {kind: 'Char'}], { run(ctx, pos, count, _a, _b, args) {
    if (!args.char) {
        throw new Error();
    }
    return charMotion.T(ctx, pos, count, args.char);
}});

registerMotion(';', {
    get inclusive() {
        if (lastCharMotion) {
            return isCharMotionInclusive(lastCharMotion.kind);
        }
        return undefined;
    },
    run(ctx, pos, count, source) {
        if (!lastCharMotion) {
            return null;
        }
        return charMotion[lastCharMotion.kind](ctx, pos, count, lastCharMotion.char);
    },
});

registerMotion(',', {
    get inclusive() {
        if (lastCharMotion) {
            return isCharMotionInclusive(oppositeDirection(lastCharMotion.kind));
        }
        return undefined;
    },
    run(ctx, pos, count, source) {
        if (!lastCharMotion) {
            return null;
        }
        return charMotion[oppositeDirection(lastCharMotion.kind)](ctx, pos, count, lastCharMotion.char);
    },
});
//#endregion


//#region text object
registerTextObject('aw', { inclusive: true, run:  (ctx, pos, count) => {
    return TextBound.findOuterWord(ctx.editor, pos, count);
}});
registerTextObject('aW', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBound.findOuterWord(ctx.editor, pos, count, true));
}});
registerTextObject('iw', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBound.findInnerWord(ctx.editor, pos, count));
}});
registerTextObject('iW', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBound.findInnerWord(ctx.editor, pos, count, true));
}});
registerTextObject('a\'', { inclusive: true, run: (ctx, pos) => {
    return (TextBound.findOuterQuote(ctx.editor, pos, '\''));
}});
registerTextObject('a"', { inclusive: true, run:  (ctx, pos) => {
    return (TextBound.findOuterQuote(ctx.editor, pos, '"'));
}});
registerTextObject('a`', { inclusive: true, run:  (ctx, pos) => {
    return (TextBound.findOuterQuote(ctx.editor, pos, '`'));
}});
registerTextObject('i\'', { inclusive: true, run: (ctx, pos) => {
    return (TextBound.findInnerQuote(ctx.editor, pos, '\''));
}});
registerTextObject('i"', { inclusive: true, run:  (ctx, pos) => {
    return (TextBound.findInnerQuote(ctx.editor, pos, '"'));
}});
registerTextObject('i`', { inclusive: true, run:  (ctx, pos) => {
    return (TextBound.findInnerQuote(ctx.editor, pos, '`'));
}});
registerTextObject('a(, a), ab', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findOuterPair(ctx, pos, ['(', ')'], count));
}});
registerTextObject('i(, i), ib', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findInnerPair(ctx, pos, ['(', ')'], count));
}});
registerTextObject('a{, a}, aB', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findOuterPair(ctx, pos, ['{', '}'], count));
}});
registerTextObject('i{, i}, iB', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findInnerPair(ctx, pos, ['{', '}'], count));
}});
registerTextObject('a[, a]', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findOuterPair(ctx, pos, ['[', ']'], count));
}});
registerTextObject('i[, i]', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findInnerPair(ctx, pos, ['[', ']'], count));
}});
registerTextObject('a<, a>', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findOuterPair(ctx, pos, ['<', '>'], count));
}});
registerTextObject('i<, i>', { inclusive: true, run:  (ctx, pos, count) => {
    return (TextBracket.findInnerPair(ctx, pos, ['<', '>'], count));
}});
//#endregion
