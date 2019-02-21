import { ISearchPattern } from "../types";
import { ICommandContext } from "../command";
import * as monaco from "monaco-editor";

let searchModelRegistry = new Map<string, SearchModel>();

function isPatternEquals(a: ISearchPattern, b: ISearchPattern) {
    return a.searchString === b.searchString
        && a.isRegex === b.isRegex
        && a.matchCase === b.matchCase
        && a.wholeWord === b.wholeWord;
}

class SearchModel {
    readonly editorId: string;

    private matchRanges?: monaco.Range[];

    private pattern?: ISearchPattern;

    private constructor(readonly editor: monaco.editor.ICodeEditor) {
        this.editorId = this.editor.getId();
        this.editor.onDidDispose(() => {
            searchModelRegistry.delete(this.editorId);
        });
        this.editor.onDidChangeModelContent(e => {
            this.matchRanges = undefined;
            this.pattern = undefined;
        })
    }

    get model() {
        let model = this.editor.getModel();
        if (!model) {
            throw new Error('ICodeEditor.getModel() returns null.');
        }
        return model;
    }

    static create(editor: monaco.editor.ICodeEditor) {
        let editorId = editor.getId();
        let instance = searchModelRegistry.get(editorId);
        if (!instance) {
            instance = new SearchModel(editor);
            searchModelRegistry.set(editorId, instance);
        }
        return instance;
    }

    search(pattern: ISearchPattern) {
        if (!this.matchRanges || !this.pattern || !isPatternEquals(this.pattern, pattern)) {
            let matches = this.model.findMatches(pattern.searchString, false, pattern.isRegex, pattern.matchCase, pattern.wholeWord ? this.editor.getConfiguration().wordSeparators : null, false);
            this.matchRanges = matches.map(x => x.range);
            this.pattern = pattern;
        }
        return this.matchRanges;
    }
}

export class TextSearch {
    static search(ctx: ICommandContext, pos: monaco.IPosition, pattern: ISearchPattern, direction: 'forward' | 'backward', count = 1): monaco.IPosition | null {
        if (direction === 'forward') {
            return this.searchNext(ctx, pos, pattern, count);
        }
        else {
            return this.searchPrev(ctx, pos, pattern, count);
        }
    }

    static searchNext(ctx: ICommandContext, pos: monaco.IPosition, pattern: ISearchPattern, count = 1): monaco.IPosition | null {
        let ranges = SearchModel.create(ctx.editor).search(pattern);
        if (ranges.length === 0) {
            return null;
        }
        while (count > 0) {
            let found = false;
            for (const range of ranges) {
                if (range.startLineNumber > pos.lineNumber || (range.startLineNumber === pos.lineNumber && range.startColumn > pos.column)) {
                    found = true;
                    pos = range.getStartPosition();
                    break;
                }
            }
            if (!found) {
                pos = ranges[0].getStartPosition();
            }
            count--;
        }
        return pos;
    }

    static searchPrev(ctx: ICommandContext, pos: monaco.IPosition, pattern: ISearchPattern, count = 1): monaco.IPosition | null {
        let ranges = SearchModel.create(ctx.editor).search(pattern);
        if (ranges.length === 0) {
            return null;
        }
        while (count > 0) {
            let found = false;
            for (let i = ranges.length - 1; i >=0; i--) {
                let range = ranges[i];
                if (range.startLineNumber < pos.lineNumber || (range.startLineNumber === pos.lineNumber && range.endColumn <= pos.column)) {
                    found = true;
                    pos = range.getStartPosition();
                    break;
                }
            }
            if (!found) {
                pos = ranges[ranges.length - 1].getStartPosition();
            }
            count--;
        }
        return pos;
    }
}

