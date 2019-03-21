
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
