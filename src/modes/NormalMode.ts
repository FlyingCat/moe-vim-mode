import { IEventSink } from "../types";
import { Mode, ModeBase } from "./Mode";
import * as P from "../matching/pattern";
import * as keyUtils from "../utils/key";
import { KeyCode } from "../utils/KeyCode";
import { motionPattern } from "../motions";
import { Program } from "../matching/program";
import { normalOperatorPattern } from "../operations";
import { applyMotion } from "../utils/helper";
import { recorder } from "../recorder";
import { Remapping, configuration } from "../configuration";
import { TextSearch } from "../text/search";
import { CommandFunction, ICommandContext, ICommandArgs, createCommand, executeCommand } from "../command";
import * as monaco from "monaco-editor";
import { actionsPattern } from "../actions";

const escKey = keyUtils.pack(KeyCode.Escape);

export const commands: {[k: string]: CommandFunction} = {
    'i': function (ctx, args) {
        ctx.editor.revealPosition(ctx.editor.getPosition()!);
        ctx.vimState.toInsert({command: this, args}, 'text');
    },
    'I': function (ctx, args) {
        let cursor = ctx.editor.getPosition()!;
        let pos = ctx.position.get(cursor.lineNumber, '^');
        ctx.editor.setPosition(pos);
        ctx.editor.revealPosition(pos);
        ctx.vimState.toInsert({command: this, args}, 'text');
    },
    'a': function (ctx, args) {
        let cursor = ctx.editor.getPosition()!;
        let pos = ctx.position.get().shouldWrap(false).move(1);
        ctx.editor.setPosition(pos);
        ctx.editor.revealPosition(pos);
        ctx.vimState.toInsert({command: this, args}, 'text');
    },
    'A': function (ctx, args) {
        let cursor = ctx.editor.getPosition()!;
        let pos = ctx.position.get(cursor.lineNumber, 'eol');
        ctx.editor.setPosition(pos);
        ctx.editor.revealPosition(pos);
        ctx.vimState.desiredColumn = 'eol';
        ctx.vimState.toInsert({command: this, args}, 'text');
    },
    'o': function (ctx, args) {
        ctx.editor.getAction('editor.action.insertLineAfter').run();
        let cursor = ctx.editor.getPosition()!;
        ctx.vimState.toInsert({command: this, args}, 'command');
    },
    'O': function (ctx, args) {
        ctx.editor.getAction('editor.action.insertLineBefore').run();
        let cursor = ctx.editor.getPosition()!;
        ctx.vimState.toInsert({command: this, args}, 'command')
    },
    'v': (ctx, args) => {
        let count = args.count || 0;
        let pos = ctx.position.get();
        let end = pos.clone().shouldWrap(false).move(count);
        ctx.vimState.toVisual(monaco.Selection.fromPositions(pos, end));
    },
    'V': (ctx, args) => {
        let count = args.count || 1;
        let first = ctx.editor.getPosition()!.lineNumber;
        let last = first + count - 1;
        ctx.vimState.toVisualLine({first, last});
    },
    'gv': (ctx, args) => {
        let previous = ctx.vimState.previousVisual;
        if (previous === undefined) {
            ctx.vimState.beep();
        }
        else if (previous.kind === 'char') {
            let start = ctx.position.get(previous.start);
            let end = ctx.position.get(previous.end);
            ctx.vimState.toVisual(monaco.Selection.fromPositions(start, end));
        }
        else {
            ctx.vimState.toVisualLine(previous);
        }
    },
    'u': (ctx, mst) => {
        let n = mst.count || 1;
        let versionId = ctx.model.getAlternativeVersionId();
        while (n !== 0) {
            let altVersionId = ctx.vimState.undo();
            if (versionId === altVersionId) {
                ctx.vimState.beep();
                break;
            }
            else {
                versionId = altVersionId;
            }
            n--;
        }
        let sel = ctx.editor.getSelection();
        if (sel && !sel.isEmpty()) {
            let pos = ctx.position.get(sel.positionLineNumber, sel.positionColumn).soft();
            ctx.editor.setPosition(pos);
        }
    },
    '<C-R>': (ctx, mst) => {
        let n = mst.count || 1;
        let versionId = ctx.model.getAlternativeVersionId();
        while (n !== 0) {
            let altVersionId = ctx.vimState.redo();
            if (versionId === altVersionId) {
                ctx.vimState.beep();
                break;
            }
            else {
                versionId = altVersionId;
            }
            n--;
        }
    },
    '.': (ctx, mst) => {
        recorder.repeatLast(ctx, mst.count);
    },
    'gd': (ctx, mst) => {
        ctx.editor.trigger('vim', 'editor.action.goToDeclaration', null);
    },
    'gh': (ctx, mst) => {
        // BUG: once show context menu, then this never works
        ctx.editor.trigger('vim', 'editor.action.showHover', null);
        // let action = ctx.editor.getAction('editor.action.showHover');
        // if (action) {
        //     return action.run();
        // }
    },
    '/': (ctx, mst) => {
        searchPattern(ctx, mst, 'forward', '/');
    },
    '?': (ctx, mst) => {
        searchPattern(ctx, mst, 'backward', '?');
    },
};

function searchPattern(ctx: ICommandContext, args: ICommandArgs, direction: 'forward' | 'backward', prefix: string) {
    ctx.vimState.requestExternalInput(prefix, () => {}).then(searchString => {
        if (!searchString) {
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
            return;
        }
        let pattern = {searchString, wholeWord: false, isRegex: true, matchCase};
        ctx.globalState.lastSearch = {direction, pattern};
        let start = ctx.editor.getPosition()!;
        let result = TextSearch.searchNext(ctx, start, pattern, args.count);
        if (result) {
            let pos = ctx.position.soften(result);
            ctx.editor.setPosition(pos);
            ctx.editor.revealPosition(pos);
        }
        else {
            ctx.vimState.outputError('找不到模式: ' + searchString);
        }
    });
}

let moveCursor = createCommand((ctx, mst) => {
    ctx.vimState.isMovingCursorByMotion = true;
    let result = applyMotion('Move', ctx, mst);
    if (result.to) {
        let pos = ctx.position.get(result.to.lineNumber, result.to.column).soft();
        ctx.editor.setPosition(pos);
        ctx.editor.revealPosition(pos);
        if (result.keepPrevDesiredColumn !== true) {
            ctx.vimState.desiredColumn = result.desiredColumnAtEol ? 'eol' : result.to.column;
        }
    }
    else {
        ctx.vimState.beep();
    }
    ctx.vimState.isMovingCursorByMotion = false;
});

function createProgram() {
    let altList: P.Pattern[] = [];
    for (let k in commands) {
        let cmd = P.setCommand(createCommand(commands[k]));
        altList.push(P.concat(keyUtils.parseToPattern(k), cmd));
    }
    let patt = P.alternate(
        P.concat(motionPattern, P.setCommand(moveCursor)),
        P.concat(P.common.countPart, P.alternateList([
            P.alternateList(altList),
            normalOperatorPattern,
            actionsPattern,
        ])),
    );
    return new Program(P.concat(P.common.registerPart, patt));
}

const program = createProgram();

export class NormalMode extends ModeBase {
    private subscriptions: monaco.IDisposable[] = [];

    constructor(context: ICommandContext) {
        super('Normal', 'Normal', context);
    }

    get program() {
        return program;
    }

    get mapper() {
        return configuration.nmap;
    }

    enter() {
        this.context.editor.updateOptions({cursorStyle: 'block'});
        let pos = this.context.position.get().soft();
        this.context.editor.setPosition(pos);
        this.subscriptions.push(this.context.editor.onDidChangeCursorPosition(e => this.onCursorChanged(e)));
        this.subscriptions.push(this.context.editor.onDidChangeCursorSelection(e => this.onSelectionChanged(e)));
    }

    leave() {
        this.dispose();
    }

    dispose() {
        super.dispose();

        for (const item of this.subscriptions) {
            item.dispose();
        }
        this.subscriptions = []
    }

    onCursorChanged(e: monaco.editor.ICursorPositionChangedEvent) {
        // console.log(`#cur source: ${e.source}, reason: ${monaco.editor.CursorChangeReason[e.reason]}`);
        // if (!this.context.vimState.isExecutingCommand) {
        //     let pos = this.context.position.soften(e.position);
        //     this.context.editor.setPosition(pos);
        // }
    }

    onSelectionChanged(e: monaco.editor.ICursorSelectionChangedEvent) {
        // console.log(`#sel source: ${e.source}, reason: ${monaco.editor.CursorChangeReason[e.reason]}`);
        // if (e.reason === monaco.editor.CursorChangeReason.Explicit && !e.selection.isEmpty()) {
        //     this.context.vimState.toInsert();
        // }
        if (e.reason === monaco.editor.CursorChangeReason.Undo || e.reason === monaco.editor.CursorChangeReason.Redo) {
            let pos = this.context.position.soften(e.selection.getPosition()!);
            this.context.editor.setPosition(pos);
            return;
        }
        if (!this.context.vimState.isExecutingCommand) {
            if (e.selection.isEmpty()) {
                let pos = this.context.position.soften(e.selection.getStartPosition());
                this.context.editor.setPosition(pos);
            }
            else {
                this.context.vimState.toInsert();
            }
        }
    }
}

