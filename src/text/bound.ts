import { TextPosition, CursorKind } from "../text/position";
import * as monaco from "monaco-editor";

type ObjectSelectResult = false | { from: monaco.IPosition, position: monaco.IPosition };

export class TextBound {

    static findNextWordStart(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, count: number, fullWord = false, stopAtNext = false, trim = false): false | monaco.IPosition {
        const model = editor.getModel()!;
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column);
        let startInWord = !cursor.isBlank;
        // if (cursor.isLastChar) {
        //     return false;
        // }
        if (fullWord) {
            while (count && !cursor.isEOF) {
                if (!cursor.isBlank) {
                    cursor.stepTo(x => x.isBlank);
                }
                if (!(startInWord && count === 1 && stopAtNext)) {
                    cursor.stepTo(x => !x.isBlank || x.isEmptyLine);
                }
                count--;
            }
        }
        else {
            while (count && !cursor.isEOF) {
                if (!cursor.isBlank) {
                    cursor.stepTo(x => x.kind != cursor.kind);
                }
                if (!(startInWord && count === 1 && stopAtNext)) {
                    if (cursor.isBlank) {
                        cursor.stepTo(x => !x.isBlank || x.isEmptyLine);
                    }
                }
                count--;
            }
        }
        if (trim && cursor.lineNumber !== pos.lineNumber) {
            let flag = true;
            let cur = cursor.clone();
            while (cur.backward()) {
                if (cur.kind !== CursorKind.Whitespace) {
                    if (cur.kind !== CursorKind.EOL) {
                        flag = false;
                    }
                    break;
                }
            }
            return flag ? cur : cursor;
        }
        return cursor;
    }

    static findNextWordEnd(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, count: number, fullWord = false): false | monaco.IPosition {
        const model = editor.getModel()!;
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column);
        // if (cursor.isLastChar) {
        //     return false;
        // }
        while (count && !cursor.isEOF) {
            cursor.forward();
            // if next is blank col, skip all blanks
            if (cursor.isBlank) {
                cursor.stepTo(x => !x.isBlank);
            }
            // either inner a word or moved to begin of another
            cursor.stepIf(fullWord ? x => !x.isBlank : x => x.kind === cursor.kind);
            count--;
        }
        return cursor;
    }

    static findPrevWordStart(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, count: number, fullWord = false): false | monaco.IPosition {
        const model = editor.getModel();
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column);
        if (cursor.isBOF) {
            return false;
        }
        while (count && !cursor.isBOF) {
            cursor.backward();
            // if prev is space col, skip all spaces except empty line
            if (cursor.isBlank) {
                cursor.backTo(x => !x.isBlank || x.isEmptyLine);
            }
            // if empty line, done; then either inner a word or moved to end of another
            if (!cursor.isEmptyLine) {
                cursor.backIf(fullWord ? x => !x.isBlank : x => x.kind === cursor.kind);
            }
            count--;
        }
        return cursor;
    }

    static findPrevWordEnd(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, count: number, fullWord = false): false | monaco.IPosition {
        const model = editor.getModel()!;
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column);
        if (cursor.isBOF) {
            return false;
        }
        if (fullWord) {
            while (count && !cursor.isBOF) {
                if (!cursor.isBlank || cursor.isEmptyLine) {
                    cursor.backTo(x => x.isBlank);
                }
                if (!cursor.isEmptyLine) {
                    cursor.backTo(x => !x.isBlank || x.isEmptyLine);
                }
                count--;
            }
        }
        else {
            while (count && !cursor.isBOF) {
                if (!cursor.isBlank || cursor.isEmptyLine) {
                    cursor.backTo(x => x.kind != cursor.kind);
                }
                if (cursor.isBlank && !cursor.isEmptyLine) {
                    cursor.backTo(x => !x.isBlank || x.isEmptyLine);
                }
                count--;
            }
        }
        return cursor;
    }



    static findOuterWord(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, count: number, fullWord = false): ObjectSelectResult {
        const model = editor.getModel();
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column);
        let n = 1;
        let fromLeading = false;
        let begin = cursor.clone();;
        while (n <= count && !cursor.isEOF) {
            if (n === 1) {
                if (cursor.kind === CursorKind.Whitespace) {
                    cursor.backIf(x => x.kind === CursorKind.Whitespace)
                    fromLeading = true;
                }
                else {
                    cursor.backIf(fullWord ? x => x.kind !== CursorKind.Whitespace : x => x.kind === cursor.kind);
                }
                begin.assign(cursor);
            }
            else {
                cursor.forward();
            }

            if (cursor.kind === CursorKind.Whitespace) {
                cursor.stepTo(x => !x.isBlank);
            }
            else {
                fromLeading = false;
            }

            cursor.stepIf(fullWord ? x => !x.isBlank : x => x.kind === cursor.kind);

            if (!fromLeading && n === count) {
                if (cursor.stepIf(x => x.kind === CursorKind.Whitespace) === 0 && begin.kind !== CursorKind.Whitespace) {
                    begin.shouldWrap(false).backTill(x => !x.isBlank, false)
                }
            }

            n++;
        }

        return { from: begin, position: cursor.soft() };
    }



    static findInnerWord(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, count: number, fullWord = false): ObjectSelectResult {
        const model = editor.getModel();
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column);
        let n = 1;
        let begin = cursor.clone();
        begin.shouldWrap(false).backIf(begin.isBlank ? x => x.isBlank : (fullWord ? x => !x.isBlank : x => x.kind === cursor.kind));
        while (n <= count && !cursor.isEOF) {
            if (n !== 1) {
                cursor.forward();
            }
            cursor.stepIf(cursor.isBlank ? x => x.kind === CursorKind.Whitespace : (fullWord ? x => !x.isBlank : x => x.kind === cursor.kind));
            n++;
        }
        return { from: begin, position: cursor.soft() };
    }

    private static markQuotePairs(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, qs: string) {
        const model = editor.getModel();
        let cursor = TextPosition.create(editor, pos.lineNumber, pos.column).shouldWrap(false).setColumn(1);
        let pairs: [number, number][] = [];
        let opening: number | undefined;
        while (cursor.forward()) {
            let char = cursor.char;
            if (char === qs) {
                if (opening === undefined) {
                    opening = cursor.column;
                }
                else {
                    pairs.push([opening, cursor.column]);
                    opening = undefined;
                }
            }
            else if (char === '\\') {
                cursor.forward();
            }
        }
        return pairs;
    }

    static findOuterQuote(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, qs: string): ObjectSelectResult {
        const model = editor.getModel()!;
        let column = pos.column;
        let pairs: [number, number][] = TextBound.markQuotePairs(editor, pos, qs);
        for (const pair of pairs) {
            if (pair[1] >= column) {
                let lineNumber = pos.lineNumber;
                return { from: { lineNumber, column: pair[0] }, position: { lineNumber, column: pair[1] } };
            }
        }
        return false;
    }

    static findInnerQuote(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition, qs: string): ObjectSelectResult {
        let column = pos.column;
        let pairs: [number, number][] = TextBound.markQuotePairs(editor, pos, qs);
        for (const pair of pairs) {
            if (pair[1] >= column) {
                let lineNumber = pos.lineNumber;
                let col1 = pair[0];
                let col2 = pair[1];
                if (col1 + 1 !== col2) {
                    col1++;
                    col2--;
                }
                return { from: { lineNumber, column: col1 }, position: { lineNumber, column: col2 } };
            }
        }
        return false;
    }

    static getWordToSearch(editor: monaco.editor.ICodeEditor, pos: monaco.IPosition) {
        const model = editor.getModel()!;
        let searchString: string | undefined;
        let curpos = TextPosition.create(editor, pos.lineNumber, pos.column).shouldWrap(false);
        let start = curpos.clone();
        if (start.kind === CursorKind.Word) {
            let end = start.clone();
            start.backIf(x => x.kind === CursorKind.Word);
            end.stepTo(x => x.kind !== CursorKind.Word);
            searchString = model.getValueInRange(monaco.Range.fromPositions(start, end));
        }
        else {
            if (start.stepTo(x => x.kind === CursorKind.Word, false)) {
                let end = start.clone();
                end.stepTo(x => x.kind !== CursorKind.Word);
                searchString = model.getValueInRange(monaco.Range.fromPositions(start, end));
            }
            else {
                if (!start.isBlank) {
                    let end = start.clone();
                    start.backIf(x => !x.isBlank);
                    end.stepTo(x => x.isBlank);
                    searchString = model.getValueInRange(monaco.Range.fromPositions(start, end));
                }
                else {
                    if (start.stepTo(x => !x.isBlank)) {
                        let end = start.clone();
                        end.stepTo(x => x.isBlank);
                        searchString = model.getValueInRange(monaco.Range.fromPositions(start, end));
                    }
                }
            }
        }
        return { start, searchString };
    }

}
