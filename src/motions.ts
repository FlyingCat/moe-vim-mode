import { SeqMap, createSeqMap } from "./matching/seqMap";
import * as keyUtils from "./utils/key";
import * as P from "./matching/pattern";
import { TextBound } from "./text/bound";
import { TextSearch } from "./text/search";
import { CursorKind } from "./text/position";
import { configuration } from "./configuration";
import { ICommandContext } from "./command";
import { TextBracket } from "./text/bracket";
import * as monaco from "monaco-editor";

export type MotionResultType = {
    position: monaco.IPosition;
    from?: monaco.IPosition;
    inclusive?: boolean;
    keepPrevDesiredColumn?: boolean;
    desiredColumnAtEol?: boolean;
    linewise?: boolean;
    isJump?: boolean;
}

export type MotionResult = monaco.IPosition | MotionResultType | false;

export type MotionFunction = (ctx: ICommandContext, pos: monaco.IPosition, count: number, source: MotionSource, implicitCount: boolean) => MotionResult;

type MotionDict = { [k: string]:  MotionFunction};
export type MotionSource = 'Move' | 'Select' | 'Operator';

// '0'
let firstChar: MotionFunction = (ctx, pos, count) => {
    return {lineNumber: pos.lineNumber, column: 1};
};

export const spMotion: {[k in 'left' | 'right' | 'EOL' | 'word' | 'fullWord' | 'altWord' | 'altFullWord']: MotionFunction} = {
    left: (ctx, pos, count) => {
        return pos.column === 1 ? false : ctx.position.get(pos.lineNumber, pos.column - count);
    },
    right: (ctx, positin, count, source) => {
        let pos = ctx.position.get(positin).shouldWrap(false);
        if (source === 'Move') {
            if (pos.isLineLastChar) {
                return false;
            }
        }
        else if (source === 'Select') {
            if (pos.kind === CursorKind.EOL) {
                return false;
            }
        }
        return ctx.position.get(pos.lineNumber, pos.column + count);
    },
    EOL: (ctx, pos, count, source) => {
        // vim doc: In Visual mode the cursor goes to just after the last character in the line.
        let position = ctx.position.get(pos.lineNumber + count - 1, source === 'Select' ? 'eol' : '$');
        return {
            position,
            inclusive: true,
            desiredColumnAtEol: true,
        }
    },
    word: (ctx, pos, count, source) => {
        return TextBound.findNextWordStart(ctx.editor, pos, count, false, false, source === 'Operator');
    },
    fullWord: (ctx, pos, count, source) => {
        return TextBound.findNextWordStart(ctx.editor, pos, count, true, false, source === 'Operator');
    },
    altWord: (ctx, pos, count) => {
        return TextBound.findNextWordStart(ctx.editor, pos, count, false, true);
    },
    altFullWord: (ctx, pos, count) => {
        return TextBound.findNextWordStart(ctx.editor, pos, count, true, true);
    },
}

const motions: MotionDict = {
    //#region left-right
    'h, <Left>, <BS>': spMotion.left,
    'l, <Right>, <Space>': spMotion.right,
    '<Home>': firstChar,
    '^': (ctx, pos, count) => {
        return ctx.position.get(pos.lineNumber, '^');
    },
    '$, <End>': spMotion.EOL,
    'g_': (ctx, pos, count) => {
        let position = ctx.position.get(pos.lineNumber + count - 1, 'g_');
        return {
            position,
            inclusive: true,
        }
    },
    //#endregion

    //#region up-down
    'k, <Up>': (ctx, pos, count, source) => {
        if (pos.lineNumber === 1) {
            return false;
        }
        let position = ctx.position.get(pos.lineNumber - count, ctx.vimState.desiredColumn);
        return {
            position,
            keepPrevDesiredColumn: true,
            linewise: true,
        }
    },
    'j, <Down>': (ctx, pos, count, source) => {
        if (pos.lineNumber === ctx.model.getLineCount()) {
            return false;
        }
        let position = ctx.position.get(pos.lineNumber + count, ctx.vimState.desiredColumn);
        return {
            position,
            keepPrevDesiredColumn: true,
            linewise: true,
        }
    },
    'gk, g<Up>': (ctx, pos, count) => {
        ctx.editor.trigger('vim', 'cursorMove', { to: 'up', select: false, by: 'wrappedLine', value: count });
        return ctx.editor.getPosition()!;
    },
    'gj, g<Down>': (ctx, pos, count) => {
        ctx.editor.trigger('vim', 'cursorMove', { to: 'down', select: false, by: 'wrappedLine', value: count });
        return ctx.editor.getPosition()!;
    },
    '-': (ctx, pos, count, source) => {
        let position = ctx.position.get(pos.lineNumber - count, '^');
        return {
            position,
            linewise: true,
        }
    },
    '+, <CR>, <C-M>': (ctx, pos, count, source) => {
        let position = ctx.position.get(pos.lineNumber + count, '^');
        return {
            position,
            linewise: true,
        }
    },
    '_': (ctx, pos, count, source) => {
        let position = ctx.position.get(pos.lineNumber + count - 1, '^');
        return {
            position,
            linewise: true,
        }
    },
    'G': (ctx, pos, count, source, implicitCount) => {
        let position = ctx.position.get(implicitCount ? '$' : count, '^');
        return {
            position,
            linewise: true,
        }
    },
    '<C-End>': (ctx, pos, count, source, implicitCount) => {
        let position = ctx.position.get(implicitCount ? '$' : count, '$');
        return {
            position,
            inclusive: true,
        }
    },
    'gg, <C-Home>': (ctx, pos, count, source, implicitCount) => {
        let position = ctx.position.get(implicitCount ? 1 : count, '^');
        return {
            position,
            linewise: true,
        }
    },
    //#endregion

    //#region word
    'w': spMotion.word,
    'W': spMotion.fullWord,
    'e': (ctx, pos, count) => {
        let r = TextBound.findNextWordEnd(ctx.editor, pos, count);
        if (r) {
            return {
                position: r,
                inclusive: true,
            }
        }
        else {
            return false;
        }
    },
    'E': (ctx, pos, count) => {
        let r = TextBound.findNextWordEnd(ctx.editor, pos, count, true);
        if (r) {
            return {
                position: r,
                inclusive: true,
            }
        }
        else {
            return false;
        }
    },
    'b': (ctx, pos, count) => {
        return TextBound.findPrevWordStart(ctx.editor, pos, count);
    },
    'B': (ctx, pos, count) => {
        return TextBound.findPrevWordStart(ctx.editor, pos, count, true);
    },
    'ge': (ctx, pos, count) => {
        let r = TextBound.findPrevWordEnd(ctx.editor, pos, count);
        if (r) {
            return {
                position: r,
                inclusive: true,
            }
        }
        else {
            return false;
        }
    },
    'gE': (ctx, pos, count) => {
        let r = TextBound.findPrevWordEnd(ctx.editor, pos, count, true);
        if (r) {
            return {
                position: r,
                inclusive: true,
            }
        }
        else {
            return false;
        }
    },
    //#endregion

    //#region various
    'H': (ctx, pos, count, source) => {
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
        return {
            position,
            linewise: true,
        }
    },
    'M': (ctx, pos, count, source) => {
        let ranges = ctx.editor.getVisibleRanges();
		let range = ranges[0];
        let first = range.startLineNumber;
        let last = range.endLineNumber;
        let lineNumber = first + Math.floor((last - first) / 2);
        let position = ctx.position.get(lineNumber, '^');
        return {
            position,
            linewise: true,
        }
    },
    'L': (ctx, pos, count, source) => {
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
        return {
            position,
            linewise: true,
        }
    },
    //#endregion

    //#region pattern
    '*': (ctx, pos, count) => {
        let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
        if (searchString) {
            let pattern = {searchString, wholeWord: true, isRegex: false, matchCase: !configuration.ignoreCase};
            ctx.globalState.lastSearch = {direction: 'forward', pattern};
            let result = TextSearch.searchNext(ctx, start, pattern, count);
            if (result) {
                return result;
            }
        }
        return false;
    },
    'g*': (ctx, pos, count) => {
        let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
        if (searchString) {
            let pattern = {searchString, wholeWord: false, isRegex: false, matchCase: !configuration.ignoreCase};
            ctx.globalState.lastSearch = {direction: 'forward', pattern};
            let result = TextSearch.searchNext(ctx, start, pattern, count);
            if (result) {
                return result;
            }
        }
        return false;
    },
    '#': (ctx, pos, count) => {
        let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
        if (searchString) {
            let pattern = {searchString, wholeWord: true, isRegex: false, matchCase: !configuration.ignoreCase};
            ctx.globalState.lastSearch = {direction: 'backward', pattern};
            let result = TextSearch.searchPrev(ctx, start, pattern, count);
            if (result) {
                return result;
            }
        }
        return false;
    },
    'g#': (ctx, pos, count) => {
        let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
        if (searchString) {
            let pattern = {searchString, wholeWord: false, isRegex: false, matchCase: !configuration.ignoreCase};
            ctx.globalState.lastSearch = {direction: 'backward', pattern};
            let result = TextSearch.searchPrev(ctx, start, pattern, count);
            if (result) {
                return result;
            }
        }
        return false;
    },
    'n': (ctx, pos, count) => {
        let lastSearch = ctx.globalState.lastSearch;
        if (!lastSearch) {
            ctx.vimState.outputError('No previous regular expression')
            return false;
        }
        let result = TextSearch.search(ctx, pos, lastSearch.pattern, lastSearch.direction === 'forward' ? 'forward' : 'backward', count);
        if (result) {
            return result;
        }
        return false;
    },
    'N': (ctx, pos, count) => {
        let lastSearch = ctx.globalState.lastSearch;
        if (!lastSearch) {
            ctx.vimState.outputError('No previous regular expression')
            return false;
        }
        let result = TextSearch.search(ctx, pos, lastSearch.pattern, lastSearch.direction === 'forward' ? 'backward' : 'forward', count);
        if (result) {
            return result;
        }
        return false;
    },
    //#endregion
}

function buildMotionMap(dict: MotionDict): SeqMap<number, MotionFunction> {
    let list: { seq: number[], val: MotionFunction }[] = [];
    for (let k in dict) {
        let val = dict[k];
        k.split(', ').map(x => keyUtils.parse(x)).forEach(seq => list.push({seq, val}));
    }
    let map = createSeqMap(list);
    return map;
}

const motionMap = buildMotionMap(motions);

//#region char motion
const charMotion: {[k in 'f' | 'F' | 't' | 'T']: (ch: string) => MotionFunction} = {
    f(ch) {
        return (ctx, pos, count, source) => {
            ctx.globalState.lastCharMotion = {
                kind: 'f',
                char: ch,
            }
            let lineNumber = pos.lineNumber;
            let column = pos.column;
            let text = ctx.model.getLineContent(lineNumber);
            if (pos.column >= text.length) {
                return false;
            }
            let index = pos.column - 1;
            while (count && index !== -1) {
                index = text.indexOf(ch, index + 1);
                count--;
            }
            if (index === -1) {
                return false;
            }
            column = index + 1;
            return {
                position: {lineNumber, column},
                inclusive: true,
            };
        }
    },
    F(ch) {
        return (ctx, pos, count, source) => {
            ctx.globalState.lastCharMotion = {
                kind: 'F',
                char: ch,
            }
            let lineNumber = pos.lineNumber;
            let column = pos.column;
            let text = ctx.model.getLineContent(lineNumber);
            if (pos.column === 1) {
                return false;
            }
            let index = pos.column - 1;
            while (count && index !== -1) {
                index = index === 0 ? -1 : text.lastIndexOf(ch, index - 1);
                count--;
            }
            if (index === -1) {
                return false;
            }
            column = index + 1;
            return {lineNumber, column};
        }
    },
    t(ch) {
        return (ctx, pos, count, source) => {
            ctx.globalState.lastCharMotion = {
                kind: 't',
                char: ch,
            }
            let lineNumber = pos.lineNumber;
            let column = pos.column;
            let text = ctx.model.getLineContent(lineNumber);
            if (column >= text.length) {
                return false;
            }
            let index = pos.column - 1;
            while (count && index !== -1) {
                index = text.indexOf(ch, index + 1);
                count--;
            }
            if (index === -1) {
                return false;
            }
            column = index + 1 - 1;
            return {
                position: {lineNumber, column},
                inclusive: true,
            };
        }
    },
    T(ch) {
        return (ctx, pos, count, source) => {
            ctx.globalState.lastCharMotion = {
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
                return false;
            }
            column = index + 1 + 1;
            return {lineNumber, column};
        }
    }
}

const findChar = P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.motion = charMotion.f(ch);
});

let backwardFindChar = P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.motion = charMotion.F(ch);
});

const tillChar = P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.motion = charMotion.t(ch);
});

let backwardTillChar = P.capture({kind: 'Char'}, (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.motion = charMotion.T(ch);
});

let repeatLastChar = P.setMotion((ctx, pos, count, source, implicitCount) => {
    let last = ctx.globalState.lastCharMotion;
    if (!last) {
        return false;
    }
    return charMotion[last.kind](last.char)(ctx, pos, count, source, implicitCount);
});

let RepeatLastCharOpposite = P.setMotion((ctx, pos, count, source) => {
    let last = ctx.globalState.lastCharMotion;
    if (!last) {
        return false;
    }
    let opposite = {
        f: 'F',
        F: 'f',
        t: 'T',
        T: 't',
    };
    return charMotion[opposite[last.kind]](last.char)(ctx, pos, count, source);
});
//#endregion


let gotoPercent: MotionFunction = (ctx, pos, count) => {
    let lineCount = ctx.model.getLineCount();
    let ln = Math.floor((count * lineCount + 99) / 100);
    let position = ctx.position.get(ln, '^');
    return {
        position,
        linewise: true,
    }
}

export const motionPattern = P.alternateList([
    P.concat(P.key('0'), P.setMotion(firstChar)),
    P.concat(P.common.countPart, P.alternateList([
        P.seq(motionMap, (c, v) => c.motion = v),
        P.concat(P.key('f'), findChar),
        P.concat(P.key('F'), backwardFindChar),
        P.concat(P.key('t'), tillChar),
        P.concat(P.key('T'), backwardTillChar),
        P.concat(P.key(';'), repeatLastChar),
        P.concat(P.key(','), RepeatLastCharOpposite),
    ])),
    P.concatList([P.common.explicitCountPart, P.key('%'), P.setMotion(gotoPercent)]),
]);

function inclusive(v: false | MotionResultType): false | MotionResultType {
    if (v === false) {
        return false;
    }
    else {
        v.inclusive = true;
        return v;
    }
}

let objectSelections: MotionDict = {
    'aw': (ctx, pos, count) => {
        return inclusive(TextBound.findOuterWord(ctx.editor, pos, count));
    },
    'aW': (ctx, pos, count) => {
        return inclusive(TextBound.findOuterWord(ctx.editor, pos, count, true));
    },
    'iw': (ctx, pos, count) => {
        return inclusive(TextBound.findInnerWord(ctx.editor, pos, count));
    },
    'iW': (ctx, pos, count) => {
        return inclusive(TextBound.findInnerWord(ctx.editor, pos, count, true));
    },
    'a\'': (ctx, pos) => {
        return inclusive(TextBound.findOuterQuote(ctx.editor, pos, '\''));
    },
    'a"': (ctx, pos) => {
        return inclusive(TextBound.findOuterQuote(ctx.editor, pos, '"'));
    },
    'a`': (ctx, pos) => {
        return inclusive(TextBound.findOuterQuote(ctx.editor, pos, '`'));
    },
    'i\'': (ctx, pos) => {
        return inclusive(TextBound.findInnerQuote(ctx.editor, pos, '\''));
    },
    'i"': (ctx, pos) => {
        return inclusive(TextBound.findInnerQuote(ctx.editor, pos, '"'));
    },
    'i`': (ctx, pos) => {
        return inclusive(TextBound.findInnerQuote(ctx.editor, pos, '`'));
    },
    'a(, a), ab': (ctx, pos, count) => {
        return inclusive(TextBracket.findOuterPair(ctx, pos, ['(', ')'], count));
    },
    'i(, i), ib': (ctx, pos, count) => {
        return inclusive(TextBracket.findInnerPair(ctx, pos, ['(', ')'], count));
    },
    'a{, a}, aB': (ctx, pos, count) => {
        return inclusive(TextBracket.findOuterPair(ctx, pos, ['{', '}'], count));
    },
    'i{, i}, iB': (ctx, pos, count) => {
        return inclusive(TextBracket.findInnerPair(ctx, pos, ['{', '}'], count));
    },
    'a[, a]': (ctx, pos, count) => {
        return inclusive(TextBracket.findOuterPair(ctx, pos, ['[', ']'], count));
    },
    'i[, i]': (ctx, pos, count) => {
        return inclusive(TextBracket.findInnerPair(ctx, pos, ['[', ']'], count));
    },
    'a<, a>': (ctx, pos, count) => {
        return inclusive(TextBracket.findOuterPair(ctx, pos, ['<', '>'], count));
    },
    'i<, i>': (ctx, pos, count) => {
        return inclusive(TextBracket.findInnerPair(ctx, pos, ['<', '>'], count));
    },
};

function buildObjectSelectionMap(dict: MotionDict): SeqMap<number, MotionFunction> {
    let list: { seq: number[], val: MotionFunction }[] = [];
    for (let k in dict) {
        let val = dict[k];
        k.split(', ').map(x => keyUtils.parse(x)).forEach(seq => list.push({seq, val}));
    }
    let map = createSeqMap(list);
    return map;
}

export const objectSelectionPattern = P.concat(P.common.countPart, P.seq(buildObjectSelectionMap(objectSelections), (c, v) => c.motion = v));
