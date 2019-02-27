import { ISearchPattern } from "../types";
import { ICommandContext } from "../command";
import * as monaco from "monaco-editor";
import { configuration } from "../configuration";

let searchModelRegistry = new Map<string, SearchModel>();

let _noh = false;
let _isInc = false;

function isPatternEquals(a: ISearchPattern, b: ISearchPattern) {
    return a.searchString === b.searchString
        && a.isRegex === b.isRegex
        && a.matchCase === b.matchCase
        && a.wholeWord === b.wholeWord;
}

interface ISearchModelState {
    readonly versionId: number;

    readonly matchRanges?: monaco.Range[];

    readonly pattern?: ISearchPattern;
}

class SearchModel {
    readonly editorId: string;

    private versionId: number;

    private matchRanges?: monaco.Range[];

    private pattern?: ISearchPattern;

    private decorations: string[] = [];

    private constructor(readonly editor: monaco.editor.ICodeEditor) {
        this.editorId = this.editor.getId();
        this.versionId = this.model.getVersionId();
        this.editor.onDidDispose(() => {
            searchModelRegistry.delete(this.editorId);
        });
        this.editor.onDidChangeModelContent(e => {
            this.versionId = this.model.getVersionId();
            this.matchRanges = undefined;
            // this.pattern = undefined;
            if (this.pattern) {
                this.search(this.pattern);
            }
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

    getState(): ISearchModelState {
        return {
            versionId: this.versionId,
            matchRanges: this.matchRanges,
            pattern: this.pattern,
        }
    }

    restoreState(state: ISearchModelState) {
        if (this.versionId === state.versionId) {
            if (this.matchRanges !== state.matchRanges || this.matchRanges !== state.matchRanges) {
                this.matchRanges = state.matchRanges;
                this.pattern = state.pattern;
                this.updateHighlight();
            }
        }
    }

    reset() {
        this.matchRanges = undefined;
        this.pattern = undefined;
        this.updateHighlight();
    }

    search(pattern: ISearchPattern) {
        if (!this.matchRanges || !this.pattern || !isPatternEquals(this.pattern, pattern)) {
            let matches = this.model.findMatches(pattern.searchString, false, pattern.isRegex, pattern.matchCase, pattern.wholeWord ? this.editor.getConfiguration().wordSeparators : null, false);
            this.matchRanges = matches.map(x => x.range);
            this.pattern = pattern;
            this.updateHighlight();
        }
        return this.matchRanges;
    }

    updateHighlight() {
        if (!_isInc && (!configuration.highlightSearch || _noh)) {
            this.clearHighLight();
            return;
        }
        if ((this.matchRanges && this.matchRanges.length !== 0) || this.decorations.length !==0) {
            let ranges = this.matchRanges || [];
            this.decorations = this.editor.deltaDecorations(this.decorations, ranges.map(range => ({
                range,
                options: {
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                    className: 'findMatch',
                }
            })));
        }
    }

    clearHighLight() {
        if (this.decorations.length !== 0) {
            this.decorations = this.editor.deltaDecorations(this.decorations, []);
        }
    }
}

export class TextSearch {
    static get isInc() {
        return _isInc;
    }

    static set isInc(value: boolean) {
        if (_isInc !== value) {
            _isInc = value;
            searchModelRegistry.forEach(x => x.updateHighlight());
        }
    }

    static noHighLight() {
        _noh = true;
        searchModelRegistry.forEach(x => x.updateHighlight());
    }

    private static trunOffNoHightLight() {
        _noh = false;
        searchModelRegistry.forEach(x => x.updateHighlight());
    }

    static getSearchModel(editor: monaco.editor.ICodeEditor) {
        return SearchModel.create(editor);
    }

    static search(ctx: ICommandContext, pos: monaco.IPosition, pattern: ISearchPattern, direction: 'forward' | 'backward', count = 1, isActual = true): monaco.IPosition | null {
        if (direction === 'forward') {
            return this.searchNext(ctx, pos, pattern, count, isActual);
        }
        else {
            return this.searchPrev(ctx, pos, pattern, count, isActual);
        }
    }

    static searchNext(ctx: ICommandContext, pos: monaco.IPosition, pattern: ISearchPattern, count = 1, isActual = true): monaco.IPosition | null {
        if (isActual) {
            TextSearch.trunOffNoHightLight();
        }
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

    static searchPrev(ctx: ICommandContext, pos: monaco.IPosition, pattern: ISearchPattern, count = 1, isActual = true): monaco.IPosition | null {
        if (isActual) {
            TextSearch.trunOffNoHightLight();
        }
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

    static notifyHighlightSearchOptionChanged() {
        if (configuration.highlightSearch) {
            searchModelRegistry.forEach(x => x.updateHighlight());
        }
        else {
            searchModelRegistry.forEach(x => x.clearHighLight());
        }
    }
}

