import * as monaco from "monaco-editor";

const s_separators = '/\\()"\':,.;<>~!@#$%^&*|+=[]{}`?-';
const s_whitespaces = ' \f\n\r\t\v​\u00a0\u1680​\u180e\u2000​\u2001​\u2002​\u2003​\u2004\u2005​\u2006​\u2007​\u2008\u2009​\u200a​\u2028\u2029\u202f\u205f​\u3000\ufeff';

const separators = new Set<number>();
for (let i = 0; i< s_separators.length; i++) {
    separators.add(s_separators.charCodeAt(i));
}

const whitespaces = new Set<number>();
for (let i = 0; i< s_whitespaces.length; i++) {
    whitespaces.add(s_whitespaces.charCodeAt(i));
}

function isWordChar(char: number) {
    return (char >= 'a'.charCodeAt(0) && char <= 'z'.charCodeAt(0))
        || (char >= 'A'.charCodeAt(0) && char <= 'Z'.charCodeAt(0))
        || (char >= '0'.charCodeAt(0) && char <= '9'.charCodeAt(0))
        || (char === '_'.charCodeAt(0));
}

export const enum CursorKind {
    Whitespace,
    Word,
    Separator,
    OtherChar,
    EOL,
}

export function getCharKind(char: number): CursorKind {
    if (isWordChar(char)) {
        return CursorKind.Word;
    }
    else if (whitespaces.has(char)) {
        return CursorKind.Whitespace;
    }
    else if (separators.has(char)) {
        return CursorKind.Separator;
    }
    else {
        return CursorKind.OtherChar;
    }
}

export type ColumnValue = number | '^' | '$' | 'g_' | 'eol';

export const enum PositionLiveType {
    Cursor,
    PrimaryCursor,
    PrimarySelectionActive,
}

export const enum RevealType {
    Simple,
    Center,
    CenterIfOutsideViewport,
    Top,
    Bottom,
}

export class TextPosition {
    readonly model: monaco.editor.ITextModel;

    public wrap = true;
    private _lineCount!: number;
    private _line!: number;
    private _index!: number;
    private _lineLength!: number;
    private _lineText?: string;
    private _char?: string;
    private _kind?: CursorKind;

    private constructor(readonly editor: monaco.editor.ICodeEditor) {
        let model = editor.getModel();
        if (!model) {
            throw new Error();
        }
        this.model = model;
    }

    static create(editor: monaco.editor.ICodeEditor, ln: number | '$', col: ColumnValue) {
        let obj = new TextPosition(editor);
        obj._lineCount = obj.model.getLineCount();
        obj._line = ln === '$' ? obj._lineCount : obj.cc(ln, obj._lineCount);
        obj._lineLength = obj.model.getLineLength(obj._line);
        obj.setColumn(col);
        return obj;
    }

    clone() {
        let obj = new TextPosition(this.editor)
        obj.wrap = this.wrap;
        obj._lineCount = this._lineCount;
        obj._line = this._line;
        obj._index = this._index;
        obj._lineLength = this._lineLength;
        obj._lineText = this._lineText;
        obj._char = this._char;
        obj._kind = this._kind;
        return obj;
    }

    assign(rhs: TextPosition) {
        this.wrap = rhs.wrap;
        this._lineCount = rhs._lineCount;
        this._line = rhs._line;
        this._index = rhs._index;
        this._lineLength = rhs._lineLength;
        this._lineText = rhs._lineText;
        this._char = rhs._char;
        this._kind = rhs._kind;
        return this;
    }

    get lineNumber() { return this._line; }
    get index() { return this._index; }
    get column() { return this._index + 1; }
    get lineLength() { return this._lineLength; }
    get lineCount() { return this._lineCount; }

    get lineText() {
        if (this._lineText === undefined) {
            this._lineText = this.model.getLineContent(this._line);
        }
        return this._lineText;
    }

    get char() {
        if (this._char === undefined) {
            this._char =  this._index === this._lineLength ? '' : this.lineText[this._index];
        }
        return this._char;
    }

    get kind() {
        if (this._kind === undefined) {
            this._kind = this._index === this._lineLength ? CursorKind.EOL : getCharKind(this.lineText.charCodeAt(this._index));
        }
        return this._kind;
    }

    shouldWrap(value: boolean) {
        this.wrap = value;
        return this;
    }

    get isBlank() {
        return this.kind === CursorKind.Whitespace || this.kind === CursorKind.EOL;
    }

    get isEmptyLine() {
        return this._lineLength === 0;
    }

    get isEOF() {
        return this._line === this._lineCount && this._index == this._lineLength;
    }

    get isBOF() {
        return this._line === 1 && this._index === 0;
    }

    get isFileLastChar() {
        return this._line === this._lineCount && this._index + 1 >= this._lineLength;
    }

    get isLineLastChar() {
        return this._index + 1 >= this._lineLength;
    }

    private cc(val: number, max: number) {
        return val < 1 ? 1 : (val > max ? max : val);
    }

    private resetCache(lineChanged: boolean) {
        this._char = undefined;
        this._kind = undefined;
        if (lineChanged) {
            this._lineText = undefined;
        }
    }

    setColumn(col: ColumnValue) {
        let column: number;
        if (col === '^') {
            column = this.model.getLineFirstNonWhitespaceColumn(this._line);
            if (column === 0) {
                column = Math.max(1, this.model.getLineLength(this._line));
            }
        }
        else if (col === 'g_') {
            column = Math.max(1, this.model.getLineLastNonWhitespaceColumn(this._line) - 1);
        }
        else if (col === '$') {
            column = Math.max(1, this.model.getLineLength(this._line));
        }
        else if (col === 'eol') {
            column = this.model.getLineMaxColumn(this._line);
        }
        else {
            column = this.cc(col, this._lineLength + 1);
        }
        let newIndex = column - 1;
        if (this._index !== newIndex) {
            this._index = newIndex;
            this.resetCache(false);
        }
        return this;
    }

    forward(): boolean {
        if (this._lineLength === 0 || this._index === this._lineLength) {
            if (this._line === this.lineCount || !this.wrap) {
                return false;
            }
            else {
                this._line += 1;
                this._index = 0;
                this._lineLength = this.model.getLineLength(this._line);
                this.resetCache(true);
            }
        }
        else {
            this._index++;
            this.resetCache(false);
        }
        return true;
    }

    backward(): boolean {
        if (this._index === 0) {
            if (this._line === 1 || !this.wrap) {
                return false;
            }
            else {
                this._line -= 1;
                this._lineLength = this.model.getLineLength(this._line);
                this._index = this._lineLength;
                this.resetCache(true);
            }
        }
        else {
            this._index--;
            this.resetCache(false);
        }
        return true;
    }

    move(n: number) {
        if (n > 0) {
            while (n !== 0 && this.forward()) {
                n--;
            }
        }
        else if (n < 0) {
            while (n !== 0 && this.backward()) {
                n++;
            }
        }
        return this;
    }

    soft() {
        let newIndex = this._index === this._lineLength ? Math.max(0, this._lineLength - 1) : this._index;
        if (this._index !== newIndex) {
            this._index = newIndex;
            this.resetCache(false);
        }
        return this;
    }

    stepIf(predicate: (x: TextPosition) => boolean): number {
        let p = this.clone();
        let cur = this.clone();
        let n = 0;
        while (cur.forward()) {
            if (predicate(cur)) {
                p.assign(cur);
                n++;
            }
            else {
                break;
            }
        }
        this.assign(p);
        return n;
    }

    stepTo(predicate: (x: TextPosition) => boolean, alwaysMove = true) {
        let p = this.clone();
        let cur = this.clone();
        let found = false;
        while (cur.forward()) {
            p.assign(cur)
            if (predicate(cur)) {
                found = true;
                break;
            }
        }
        if (found || alwaysMove) {
            this.assign(p);
        }
        return found;
    }

    stepTill(predicate: (x: TextPosition) => boolean, alwaysMove = true) {
        let p = this.clone();
        let cur = this.clone();
        let found = false;
        while (cur.forward()) {
            if (predicate(cur)) {
                found = true;
                break;
            }
            else {
                p.assign(cur);
            }
        }
        if (found || alwaysMove) {
            this.assign(p);
        }
        return found;
    }

    backIf(predicate: (x: TextPosition) => boolean) {
        let p = this.clone();
        let cur = this.clone();
        let n = 0;
        while (cur.backward()) {
            if (predicate(cur)) {
                p.assign(cur);
                n++;
            }
            else {
                break;
            }
        }
        this.assign(p);
        return n;
    }

    backTo(predicate: (x: TextPosition) => boolean, alwaysMove = true) {
        let p = this.clone();
        let cur = this.clone();
        let found = false;
        while (cur.backward()) {
            p.assign(cur)
            if (predicate(cur)) {
                found = true;
                break;
            }
        }
        if (found || alwaysMove) {
            this.assign(p);
        }
        return found;
    }

    backTill(predicate: (x: TextPosition) => boolean, alwaysMove = true) {
        let p = this.clone();
        let cur = this.clone();
        let found = false;
        while (cur.backward()) {
            if (predicate(cur)) {
                found = true;
                break;
            }
            else {
                p.assign(cur);
            }
        }
        if (found || alwaysMove) {
            this.assign(p);
        }
        return found;
    }

    toRange(): monaco.Range {
        return monaco.Range.fromPositions(this, this);
    }

    toSelection(anchor?: monaco.IPosition): monaco.Selection {
        anchor = anchor || this;
        return monaco.Selection.fromPositions(anchor, this);
    }

    reveal(type = RevealType.Simple) {
        let range = this.toRange();
        switch (type) {
            case RevealType.Simple:
                this.editor.revealRange(range);
                break;
            case RevealType.Center:
                this.editor.revealRangeInCenter(range);
                break;
            case RevealType.CenterIfOutsideViewport:
                this.editor.revealRangeInCenterIfOutsideViewport(range);
                break;
            case RevealType.Top:
                this.editor.revealRangeAtTop(range);
                break;
            case RevealType.Bottom:
                // private api
                this.editor['_revealRange'](range, 4, true, 0);
                break;
            default:
                break;
        }
        return this;
    }

    live(type = PositionLiveType.Cursor) {
        switch (type) {
            case PositionLiveType.Cursor:
                this.editor.setPosition(this);
                break;
            case PositionLiveType.PrimaryCursor:
                this.setEditorPrimaryCurosr();
                break;
            case PositionLiveType.PrimarySelectionActive:
                this.setEditorPrimarySelectionActive();
                break;
            default:
                break;
        }
        return this;
    }

    setEditorPrimaryCurosr() {
        let selections = this.editor.getSelections();
        if (!selections || selections.length === 0) {
            return;
        }
        selections[0] = this.toSelection();
        this.editor.setSelections(selections);
    }

    setEditorPrimarySelectionActive() {
        let selections = this.editor.getSelections();
        if (!selections || selections.length === 0) {
            return;
        }
        let anchor: monaco.IPosition = {
            lineNumber: selections[0].selectionStartLineNumber,
            column: selections[0].selectionStartColumn
        };
        selections[0] = this.toSelection(anchor);
        this.editor.setSelections(selections);
    }
}

export class TextPositionFactory {
    constructor(readonly editor: monaco.editor.ICodeEditor) {
    }

    get model() {
        let model = this.editor.getModel();
        if (!model) { throw new Error(); }
        return model;
    }

    get(): TextPosition;
    get(pos: monaco.IPosition): TextPosition;
    get(ln: number | '$', col: ColumnValue): TextPosition;
    get(a?: any, b?: any) {
        if (a === undefined) {
            let curosr = this.editor.getPosition();
            if (!curosr) { throw new Error(); }
            return TextPosition.create(this.editor, curosr.lineNumber, curosr.column)
        }
        else if (a !== undefined && b !== undefined) {
            return TextPosition.create(this.editor, a, b)
        }
        else {
            return TextPosition.create(this.editor, a.lineNumber, a.column);
        }
    }

    soften(pos: monaco.IPosition) {
        return TextPosition.create(this.editor, pos.lineNumber, pos.column).soft();
    }
}
