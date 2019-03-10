import { CommandFunction, createCommand, ICommandArgs, ICommandContext } from "./command";
import * as monnaco from "monaco-editor";
import * as P from "./matching/pattern";
import * as keyUtils from "./utils/key";
import { RevealType, PositionLiveType, TextPosition } from "./text/position";
import { TextMark } from "./text/mark";

function scroll(ctx: ICommandContext, args: ICommandArgs, to: 'down' | 'up', by: 'line' | 'page') {
    let pos = ctx.position.get();
    let count = args.count || 1;
    ctx.editor.trigger('vim', 'editorScroll', { to, by, value: count });
    let visibleRanges = ctx.editor.getVisibleRanges();
    if (visibleRanges.length > 0) {
        let firstLine = visibleRanges[0].startLineNumber;
        let lastLine = visibleRanges[0].endLineNumber;
        if (!(pos.lineNumber >= firstLine && pos.lineNumber <= lastLine)) {
            pos = ctx.position.get(to === 'down' ? firstLine : lastLine, pos.column);
            let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
            pos.live(liveType);
        }
    }
}

function scrollHalfPage(ctx: ICommandContext, args: ICommandArgs, to: 'down' | 'up') {
        let pos = ctx.position.get();
        let lineOffset = 0;
        let visibleRanges = ctx.editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
            let firstLine = visibleRanges[0].startLineNumber;
            let lastLine = visibleRanges[0].endLineNumber;
            if (pos.lineNumber >= firstLine && pos.lineNumber < lastLine) {
                lineOffset = pos.lineNumber - firstLine;
            }
        }
        let count = args.count || 1;
        ctx.editor.trigger('vim', 'editorScroll', {to, by: 'halfPage', value: count});
        visibleRanges = ctx.editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
            pos = ctx.position.get(visibleRanges[0].startLineNumber + lineOffset, pos.column);
            let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
            pos.live(liveType);
        }
}

const commands: {[k: string]: CommandFunction} = {
    '<C-E>': (ctx, args) => {
        scroll(ctx, args, 'down', 'line');
    },
    '<C-D>': (ctx, args) => {
        scrollHalfPage(ctx, args, 'down');
    },
    '<C-F>': (ctx, args) => {
        scroll(ctx, args, 'down', 'page');
    },
    'z+': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let line = args.count || ctx.editor.getVisibleRanges()[0].endLineNumber + 1;
        let pos = ctx.position.get(line, '^');
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'top'});
        pos.reveal().live(liveType);
    },
    '<C-Y>': (ctx, args) => {
        scroll(ctx, args, 'up', 'line');
    },
    '<C-U>': (ctx, args) => {
        scrollHalfPage(ctx, args, 'up');
    },
    '<C-B>': (ctx, args) => {
        scroll(ctx, args, 'up', 'page');
    },
    'z^': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let line = args.count || ctx.editor.getVisibleRanges()[0].startLineNumber - 1;
        let pos = ctx.position.get(line, '^');
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'bottom'});
        pos.reveal().live(liveType);
    },
    'z<CR>': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, '^');
        }
        else {
            pos.setColumn('^');
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'top'});
        pos.reveal().live(liveType);
    },
    'zt': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, pos.column);
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'top'});
        pos.reveal().live(liveType);
    },
    'z.': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, '^');
        }
        else {
            pos.setColumn('^');
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'center'});
        pos.reveal().live(liveType);
    },
    'zz': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, pos.column);
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'center'});
        pos.reveal().live(liveType);
    },
    'z-': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, '^');
        }
        else {
            pos.setColumn('^');
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'bottom'});
        pos.reveal().live(liveType);
    },
    'zb': (ctx, args) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        let pos = ctx.position.get();
        if (args.count) {
            pos = ctx.position.get(args.count, pos.column);
        }
        ctx.editor.trigger('vim', 'revealLine', {lineNumber: pos.lineNumber - 1, at: 'bottom'});
        pos.reveal().live(liveType);
    },
    'm\'': (ctx, args) => {
        TextMark.set(ctx, 'LAST', ctx.position.get());
    },
    'm`': (ctx, args) => {
        TextMark.set(ctx, 'LAST', ctx.position.get());
    },
};

const list: P.Pattern[] = [];

for (let k in commands) {
    let cmd = P.setCommand(createCommand(commands[k]));
    list.push(P.concat(keyUtils.parseToPattern(k), cmd));
}

let setMarkPatt = P.concat(P.key('m'), P.capture(P.range('az'), (cap, inputs, idx) => {
    let ch = String.fromCharCode(inputs[idx]);
    cap.command = createCommand((ctx, cap) => {
        let cursor = ctx.position.get();
        TextMark.set(ctx, ch, cursor);
    });
}));

export const actionsPattern = P.alternate(P.alternateList(list), setMarkPatt);
