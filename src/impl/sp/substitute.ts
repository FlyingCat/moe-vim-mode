import { addExRangeCommand } from "../../exCommand";
import { executeEdits, rangeFromLines } from "../../utils/helper";
import * as monaco from "monaco-editor";
import { ICommandContext } from "../../boot/base";
import { configuration } from "../../configuration";
import { registerCommand } from "../../boot/registry";

type ReplacePiece = {
    kind: 'text',
    text: string,
} | {
    kind: 'submatch',
    index: number;
}

export class TextReplacePattern {
    private pieces?: ReplacePiece[];

    constructor(replaceString: string) {
        if (replaceString.length !== 0) {
            this.pieces = buildPieces(replaceString);
        }
    }

    run(matches: string[]): string {
        if (!this.pieces) {
            return '';
        }
        else {
            let result = '';
            for (const p of this.pieces) {
                if (p.kind === 'text') {
                    result += p.text;
                }
                else {
                    result += this._substitute(p.index, matches);
                }
            }
            return result;
        }
    }

    private _substitute(matchIndex: number, matches: string[]): string {
        if (matchIndex === 0) {
            return matches[0];
        }

        let remainder = '';
        while (matchIndex > 0) {
            if (matchIndex < matches.length) {
                // A match can be undefined
                let match = (matches[matchIndex] || '');
                return match + remainder;
            }
            remainder = String(matchIndex % 10) + remainder;
            matchIndex = Math.floor(matchIndex / 10);
        }
        return '$' + remainder;
    }
}

const codeBackslash = '\\'.charCodeAt(0);
const codeSlash = '/'.charCodeAt(0);
const codeDollar = '$'.charCodeAt(0);
const codeAnd = '&'.charCodeAt(0);
const code0 = '0'.charCodeAt(0);
const code1 = '1'.charCodeAt(0);
const code9 = '9'.charCodeAt(0);
const codeT = 't'.charCodeAt(0);
const codeN = 'n'.charCodeAt(0);

function buildPieces(str: string) {
    let pieces: ReplacePiece[] = [];
    let anchor = 0;
    let cur = 0;
    const len = str.length;
    while (true) {
        if (cur === len) {
            pushPart(cur);
            break;
        }
        let ch = str.charCodeAt(cur++)
        if (cur === len) {
            pushPart(cur);
            break;
        }
        if (ch === codeBackslash) {
            let curCh = str.charCodeAt(cur++);
            if (curCh === codeN) {
                meetEscape('\n');
            }
            else if (curCh === codeT) {
                meetEscape('\t');
            }
            else if (curCh === codeBackslash) {
                meetEscape('\\');
            }
            else if (curCh === codeSlash) {
                meetEscape('/');
            }
        }
        else if (ch === codeDollar) {
            let curCh = str.charCodeAt(cur++);
            if (curCh === codeDollar) {
                meetEscape('$');
            }
            else if (curCh === codeAnd || curCh === code0) {
                meetIndex(0);
            }
            else if (curCh >= code1 && curCh <= code9) {
                let index = curCh - code0;
                if (cur !== len) {
                    let nextCh = str.charCodeAt(cur);
                    if (nextCh >= code0 && nextCh <= code9) {
                        index = index * 10 + (nextCh - code0);
                        cur++;
                    }
                }
                meetIndex(index);
            }
        }
    }
    return pieces;
    function pushPart(end: number) {
        if (end > anchor) {
            pieces.push({kind: 'text', text: str.substring(anchor, end)});
            // anchor = end;
        }
    }
    function meetEscape(text: string) {
        pushPart(cur - 2);
        pieces.push({kind: 'text', text});
        anchor = cur;
    }
    function meetIndex(index: number) {
        pushPart(cur - (index < 10 ? 2 : 3));
        pieces.push({kind: 'submatch', index});
        anchor = cur;
    }
}

let lastSubstituteRecord = null as {
    searchString: string;
    replaceString: string;
    flags: string,
} | null;

function doSubstitute(ctx: ICommandContext, range: {first: number, last: number}, searchString: string, replaceString: string, flags: string, count?: number) {
    let replacePattern = new TextReplacePattern(replaceString);

    let matchCase = !configuration.ignoreCase;
    if (searchString.startsWith('\\c')) {
        matchCase = false;
        searchString = searchString.substring(2);
    }
    else if (searchString.startsWith('\\C')) {
        matchCase = true;
        searchString = searchString.substring(2);
    }

    flags = flags.replace(/^&+/, lastSubstituteRecord ? lastSubstituteRecord.flags : '');

    let global = false;

    for (const c of flags) {
        if (c === 'g') {
            global = true;
        }
        else if (c === 'I') {
            matchCase = true;
        }
        else if (c === 'i') {
            matchCase = false;
        }
    }

    lastSubstituteRecord = { searchString, replaceString, flags };

    if (count) {
        range = {first: range.last, last: range.last + count - 1};
    }

    range.last = Math.min(range.last, ctx.model.getLineCount());

    let edits: monaco.editor.IIdentifiedSingleEditOperation[];
    if (global) {
        let matches = ctx.model.findMatches(searchString, rangeFromLines(ctx, [range.first, range.last]), true, matchCase, null, true);
        if (matches.length === 0) {
            return;
        }
        edits = matches.map(m => (
            {
                range: m.range,
                text: replacePattern.run(m.matches!)
            }
        ));
    }
    else {
        edits = [];
        for (let ln = range.first; ln <= range.last; ln++) {
            let matches = ctx.model.findMatches(searchString, rangeFromLines(ctx, [ln, ln]), true, matchCase, null, true, 1);
            if (matches.length !== 0) {
                let m = matches[0];
                edits.push({range: m.range, text: replacePattern.run(m.matches!)});
            }
        }
    }
    if (edits.length === 0) {
        ctx.vimState.outputError('Pattern not found: ' + searchString);
        return;
    }
    ctx.editor.pushUndoStop();
    executeEdits(ctx, edits, () => ctx.position.get(range.last, '^'));
    ctx.editor.pushUndoStop();
    ctx.vimState.toNormal();
}

addExRangeCommand({
    matcher: /^(?:s(?:u|ub|ubs|ubst|ubsti|ubstit|ubstitu|ubstitut|ubstitute)?\s+|&)(?:([&a-zA-Z]*))?(?:\s*(\d+))?\s*$/,
    handler(ctx, range, cap: string[]) {
        if (!lastSubstituteRecord) {
            ctx.vimState.outputError('No previous substitute regular expression');
            return;
        }
        let {searchString, replaceString} = lastSubstituteRecord;
        let flags = cap[1] || '';
        let count = cap[2] ? parseInt(cap[2]) : undefined;
        return doSubstitute(ctx, range, searchString, replaceString, flags, count);
    }
});

addExRangeCommand({
    matcher: /^s(?:u|ub|ubs|ubst|ubsti|ubstit|ubstitu|ubstitut|ubstitute)?\/([^\/\\]*(?:\\.[^\\\/]*)*)\/([^\/\\]*(?:\\.[^\\\/]*)*)(?:\/([a-zA-Z]*))?(?:\s*(\d+))?\s*$/,
    handler(ctx, range, cap: string[]) {
        let searchString = cap[1];
        let replaceString = cap[2];
        let flags = cap[3] || '';
        let count = cap[4] ? parseInt(cap[4]) : undefined;
        return doSubstitute(ctx, range, searchString, replaceString, flags, count);
    }
});

registerCommand('&', 'n', (ctx, args) => {
    if (!lastSubstituteRecord) {
        ctx.vimState.outputError('No previous substitute regular expression');
        return;
    }
    let {searchString, replaceString} = lastSubstituteRecord;
    let flags = '';
    let count = args.count || 1;
    let ln = ctx.editor.getPosition()!.lineNumber;
    return doSubstitute(ctx, {first: ln, last: ln}, searchString, replaceString, flags, count);
});
