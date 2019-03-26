import { ModeName, IEventSink } from "../src/types";
import { Dispatcher } from "../src/Dispatcher";
import { assert } from "chai";
import * as monaco from "monaco-editor";

interface EditorState {
    text?: string | string[];
    line?: [number, string];
    mode?: ModeName;
    cursor?: [number, number];
    cursors?: [number, number][];
    selection?: [number, number, number, number];
}

function getText(state: EditorState) {
    if (state.text === undefined) {
        return "";
    }
    return Array.isArray(state.text) ? state.text.join('\n') : state.text;
}

function toPositon(tuple: [number, number]) {
    return new monaco.Position(tuple[0], tuple[1]);
}

function toSelction(tuple: [number, number, number, number]) {
    return new monaco.Selection(tuple[0], tuple[1], tuple[2], tuple[3]);
}

function toTuple(value: monaco.IPosition): [number, number];
function toTuple(value: monaco.ISelection): [number, number, number, number];
function toTuple(value: {}) {
    if (monaco.Position.isIPosition(value)) {
        return [value.lineNumber, value.column];
    }
    else if (monaco.Selection.isISelection(value)) {
        return [value.selectionStartLineNumber, value.selectionStartColumn, value.positionLineNumber, value.positionColumn];
    }
    else {
        throw new Error('Invalid argument.');
    }
}

function toTupleArray(value: monaco.Selection[]): [number, number][] {
    if (!value.every(x => x.isEmpty())) {
        throw new Error('should be all empty selections');
    }
    return value.map(x => toTuple(x.getPosition()));
}

class EditorBox {
    static nextId  = 1;

    elementId: string

    editor: monaco.editor.ICodeEditor;

    private dispatcher: Dispatcher;

    checkCount = 0;

    private constructor(text: string) {
        this.elementId = '__EditorBox__' + EditorBox.nextId++
        let el = document.createElement('div')
        el.id = this.elementId;
        el.style.width = '600px';
        el.style.height = '300px';
        el.style.border = '1px solid #ccc';
        document.body.appendChild(el);
        this.editor = monaco.editor.create(el, {
            value: text,
            minimap: {enabled: false},
            wordWrap: 'on',
        });
        this.dispatcher = Dispatcher.create(this.editor);
    }

    static async create(text: string, cursor?: [number, number], cursors?: [number, number][], selection?: [number, number, number, number], mode?: ModeName) {
        let instance = new EditorBox(text);
        if (cursor) {
            instance.editor.setPosition(toPositon(cursor));
        }
        if (cursors) {
            instance.editor.setSelections(cursors.map(x => monaco.Selection.fromPositions(toPositon(x))));
        }
        if (selection) {
            instance.editor.setSelection(toSelction(selection));
        }
        if (mode) {
            switch(mode) {
                case 'Normal':
                    instance.dispatcher.toNormal();
                    break;
                case 'Insert':
                    instance.dispatcher.toInsert();
                    break;
                default:
                    break;
            }
        }
        instance.editor.focus();
        return instance;
    }

    async dispose() {
        this.editor.dispose();
        let el = document.getElementById(this.elementId)!;
        el.parentNode!.removeChild(el);
    }

    async sendInput(keys: string) {
        let r = await this.dispatcher.sendInput(keys);
        return r;
    }

    async executeExCommand(text: string) {
        return await this.dispatcher.executeExCommand(text);
    }

    check(state: EditorState) {
        let idx = ++this.checkCount;
        if (state.text !== undefined) {
            assert.equal(this.editor.getValue(), getText(state), `#${idx}:text`);
        }
        if (state.line !== undefined) {
            assert.equal(this.editor.getModel()!.getLineContent(state.line[0]), state.line[1], `#${idx}:text`);
        }
        if (state.cursor !== undefined) {
            assert.deepEqual(toTuple(this.editor.getPosition()!), state.cursor, `#${idx}:cursor`);
        }
        if (state.cursors !== undefined) {
            assert.deepEqual(toTupleArray(this.editor.getSelections()!), state.cursors, `#${idx}:cursors`);
        }
        if (state.selection !== undefined) {
            assert.deepEqual(toTuple(this.editor.getSelection()!), state.selection, `#${idx}:selection`);
        }
        if (state.mode !== undefined) {
            assert.equal(this.dispatcher.getMode(), state.mode, `#${idx}:mode`);
        }
    }

}

type ActionGroup = {
    title: string;
    before: () => Promise<void>,
    actions: (() => Promise<void>)[]
}

class Wrapper {
    private groups: ActionGroup[] = [];

    private suit: string;

    private _box?: EditorBox;

    get box() {
        if (!this._box) {
            throw new Error('get box before initializing');
        }
        return this._box;
    }

    constructor(readonly state: EditorState & {suit: string}) {
        this.suit = state.suit;
    }

    private pushAction(f: ()=>Promise<void>) {
        this.groups[this.groups.length - 1].actions.push(f);
    }

    next(what: string | EditorState & ({input: string, skipKeyCheck?: boolean} | {ex: string})) {
        if (this.groups.length === 0) {
            throw new Error('TEST(...) is needed.')
        }
        this.pushAction(async () => {
            if (typeof what === 'string') {
                let r = await this.box.sendInput(what);
                assert.isTrue(r, `Fail to match "${what}".`)
            }
            else if (what['input']) {
                what = what as EditorState & {input: string, skipKeyCheck?: boolean};
                let r = await this.box.sendInput(what.input);
                if (what.skipKeyCheck !== true) {
                    assert.isTrue(r, `Fail to match "${what.input}".`)
                }
                this.box.check(what);
            }
            else {
                what = what as EditorState & {ex: string};
                await this.box.executeExCommand(what.ex);
                this.box.check(what);
            }
        });
        return this;
    }

    cursor(ln: number, col: number) {
        this.pushAction(async () => {
            this.box.editor.setPosition(toPositon([ln, col]));
        });
        return this;
    }

    cursors(...value: [number, number][]) {
        this.pushAction(async () => {
            this.box.editor.setSelections(value.map(x => monaco.Selection.fromPositions(toPositon(x))));
        });
        return this;
    }

    text(s: string) {
        this.pushAction(async () => {
            this.box.editor.setValue(s);
        });
        return this;
    }

    restore() {
        let action = this.groups[this.groups.length - 1].before;
        this.pushAction(async () => {
            let checkCount = 0;
            if (this.box) {
                checkCount = this.box.checkCount;
                await this.box.dispose();
            }
            await action();
            this.box.checkCount = checkCount;
        })
        return this;
    }

    TEST(section: string, patch?: EditorState) {
        this.groups.push({
            title: section,
            actions: [],
            before: async () => {
                let text = patch && patch.text ? getText(patch) : getText(this.state);
                let cursor = patch && patch.cursor ? patch.cursor : this.state.cursor;
                let cursors = patch && patch.cursors ? patch.cursors : this.state.cursors;
                let selection = patch && patch.selection ? patch.selection : this.state.selection;
                let mode = patch && patch.mode ? patch.mode : this.state.mode;
                this._box = await EditorBox.create(text, cursor, cursors, selection, mode);
            },
        });
        return this;
    }

    RUN() {
        let self = this
        suite(this.suit, function() {
            this.afterEach(async () => {
                if (self.box) {
                    await self.box.dispose();
                }
            });
            for (let group of self.groups) {
                test(group.title, async function() {
                    await group.before();
                    for (let action of group.actions) {
                        await action();
                    }
                });
            }
        });
    }
}

export function FROM(state: EditorState & {suit: string}) {
    return new Wrapper(state);
}
