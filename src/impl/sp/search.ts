import { ISearchPattern } from "../../types";
import { ICommandContext, ICommandArgs } from "../../boot/base";
import * as monaco from "monaco-editor";
import { configuration } from "../../configuration";
import { registerMotion, registerCommand } from "../../boot/registry";
import { TextBound } from "../../text/bound";
import { addExCommand } from "../../exCommand";

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

class TextSearch {
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

configuration.onOptionChanged('highlightSearch', () => TextSearch.notifyHighlightSearchOptionChanged());

let gLastSearch: {
    direction: 'forward' | 'backward';
    pattern: ISearchPattern;
} | undefined = undefined;

//#region pattern motion
registerMotion('*', (ctx, pos, count) => {
    let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
    if (searchString) {
        let pattern = {searchString, wholeWord: true, isRegex: false, matchCase: !configuration.ignoreCase};
        gLastSearch = {direction: 'forward', pattern};
        let result = TextSearch.searchNext(ctx, start, pattern, count);
        return result;
    }
    return null;
});
registerMotion('g*', (ctx, pos, count) => {
    let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
    if (searchString) {
        let pattern = {searchString, wholeWord: false, isRegex: false, matchCase: !configuration.ignoreCase};
        gLastSearch = {direction: 'forward', pattern};
        let result = TextSearch.searchNext(ctx, start, pattern, count);
        return result;
    }
    return null;
});
registerMotion('#', (ctx, pos, count) => {
    let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
    if (searchString) {
        let pattern = {searchString, wholeWord: true, isRegex: false, matchCase: !configuration.ignoreCase};
        gLastSearch = {direction: 'backward', pattern};
        let result = TextSearch.searchPrev(ctx, start, pattern, count);
        return result;
    }
    return null;
});
registerMotion('g#', (ctx, pos, count) => {
    let {start, searchString} = TextBound.getWordToSearch(ctx.editor, pos);
    if (searchString) {
        let pattern = {searchString, wholeWord: false, isRegex: false, matchCase: !configuration.ignoreCase};
        gLastSearch = {direction: 'backward', pattern};
        let result = TextSearch.searchPrev(ctx, start, pattern, count);
        return result;
    }
    return null;
});
registerMotion('n', {isJump: true, run: (ctx, pos, count) => {
    let lastSearch = gLastSearch;
    if (!lastSearch) {
        ctx.vimState.outputError('No previous regular expression')
        return null;
    }
    let result = TextSearch.search(ctx, pos, lastSearch.pattern, lastSearch.direction === 'forward' ? 'forward' : 'backward', count);
    return result;
}});
registerMotion('N', {isJump: true, run: (ctx, pos, count) => {
    let lastSearch = gLastSearch;
    if (!lastSearch) {
        ctx.vimState.outputError('No previous regular expression')
        return null;
    }
    let result = TextSearch.search(ctx, pos, lastSearch.pattern, lastSearch.direction === 'forward' ? 'backward' : 'forward', count);
    return result;
}});
//#endregion

function searchPattern(ctx: ICommandContext, args: ICommandArgs, direction: 'forward' | 'backward', prefix: string) {
    const scrollLeft = ctx.editor.getScrollLeft();
    const scrollTop = ctx.editor.getScrollTop();
    let viewportChanged = false;
    let searchModel = TextSearch.getSearchModel(ctx.editor);
    let state = searchModel.getState();
    function restoreEditorView(searchState = false) {
        if (viewportChanged) {
            ctx.editor.setScrollLeft(scrollLeft);
            ctx.editor.setScrollTop(scrollTop);
            viewportChanged = false;
        }
        if (searchState) {
            searchModel.restoreState(state);
        }
    }
    function incSearch(searchString: string) {
        let matchCase = !configuration.ignoreCase;
        if (searchString.startsWith('\\c')) {
            matchCase = false;
            searchString = searchString.substring(2);
        }
        else if (searchString.startsWith('\\C')) {
            matchCase = true;
            searchString = searchString.substring(2);
        }
        else if (configuration.ignoreCase && configuration.smartCase) {
            for (let i = 0; i< searchString.length; i++) {
                let ch = searchString.charCodeAt(i);
                if (ch === '\\'.charCodeAt(0)) {
                    i++;
                }
                else {
                    if (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0)) {
                        matchCase = true;
                        break;
                    }
                }
            }
        }
        if (searchString.length === 0) {
            return null;
        }
        let pattern = {searchString, wholeWord: false, isRegex: true, matchCase};
        let start = ctx.editor.getPosition()!;
        return TextSearch.searchNext(ctx, start, pattern, args.count, false);
    }
    function onTextChange(text: string) {
        TextSearch.isInc = true;
        if (!configuration.incrementalSearch) {
            return;
        }
        if (text.length === 0) {
            restoreEditorView();
            searchModel.reset();
        }
        let r = incSearch(text);
        if (r) {
            ctx.editor.revealRangeInCenterIfOutsideViewport(monaco.Range.fromPositions(r, r));
            viewportChanged = true;
        }
        else {
            restoreEditorView();
        }
    }
    ctx.vimState.requestExternalInput(prefix, '', onTextChange).then(searchString => {
        TextSearch.isInc = false;
        if (!searchString) {
            restoreEditorView(true);
            return;
        }
        let matchCase = !configuration.ignoreCase;
        if (searchString.startsWith('\\c')) {
            matchCase = false;
            searchString = searchString.substring(2);
        }
        else if (searchString.startsWith('\\C')) {
            matchCase = true;
            searchString = searchString.substring(2);
        }
        else if (configuration.ignoreCase && configuration.smartCase) {
            for (let i = 0; i< searchString.length; i++) {
                let ch = searchString.charCodeAt(i);
                if (ch === '\\'.charCodeAt(0)) {
                    i++;
                }
                else {
                    if (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0)) {
                        matchCase = true;
                        break;
                    }
                }
            }
        }
        if (searchString.length === 0) {
            restoreEditorView(true);
            return;
        }
        let pattern = {searchString, wholeWord: false, isRegex: true, matchCase};
        gLastSearch = {direction, pattern};
        let start = ctx.editor.getPosition()!;
        let result = TextSearch.searchNext(ctx, start, pattern, args.count);
        if (result) {
            let pos = ctx.position.soften(result);
            ctx.editor.setPosition(pos);
            ctx.editor.revealPosition(pos);
        }
        else {
            restoreEditorView();
            ctx.vimState.outputError('Pattern not found: ' + searchString);
        }
    });
}

registerCommand('/', 'n', (ctx, mst) => {
    searchPattern(ctx, mst, 'forward', '/');
});
registerCommand('?', 'n', (ctx, mst) => {
    searchPattern(ctx, mst, 'backward', '?');
});

addExCommand({
    matcher: /^noh(?:l|ls|lse|lsea|lsear|lsearc|lsearch)?\s*$/,
    handler() {
        TextSearch.noHighLight();
    }
});
