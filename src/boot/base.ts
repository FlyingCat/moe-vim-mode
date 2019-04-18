import * as monaco from "monaco-editor";
import { TextPositionFactory } from "../text/position";
import { Dispatcher } from "../Dispatcher";
import { doThen } from "../utils/helper";
import { recorder } from "../recorder";

export type MotionSource = 'Move' | 'Select' | 'Operator';

export type MotionFunction = (ctx: ICommandContext, from: monaco.IPosition, count: number, source: MotionSource, implicitCount: boolean, commandArgs: ICommandArgs) => monaco.IPosition | {from: monaco.IPosition, to: monaco.IPosition, linewise?: boolean} | null | undefined;

export interface IMotion {
    readonly inclusive?: boolean;
    readonly keepPrevDesiredColumn?: boolean;
    readonly desiredColumnAtEol?: boolean;
    readonly linewise?: boolean;
    readonly isJump?: boolean;
    readonly makeSelection?: boolean;
    readonly run: MotionFunction;
}

export interface MotionResult {
    from: monaco.IPosition;
    to: monaco.IPosition;
    inclusive?: boolean;
    keepPrevDesiredColumn?: boolean;
    desiredColumnAtEol?: boolean;
    linewise?: boolean;
    isJump?: boolean;
}

export function applyMotion(source: MotionSource, ctx: ICommandContext, args: ICommandArgs, from?: monaco.IPosition): MotionResult | null {
    let motion = args.motion;
    if (!motion) {
        throw new Error();
    }
    let count = args.count;
    if (!from) {
        from = ctx.editor.getPosition()!;
    }
    let linewise = motion.linewise;
    let to: monaco.IPosition;
    let ret = motion.run(ctx, from, count || 1, source, count === undefined, args);
    if (!ret) {
        return null;
    }
    else if (monaco.Position.isIPosition(ret)) {
        to = ret;
    }
    else {
        from = ret.from;
        to = ret.to;
        if (ret.linewise !== undefined) {
            linewise = ret.linewise;
        }
    }
    let result: MotionResult = {
        from,
        to,
        linewise,
        inclusive: motion.inclusive,
        keepPrevDesiredColumn: motion.keepPrevDesiredColumn,
        desiredColumnAtEol: motion.desiredColumnAtEol,
        isJump: motion.isJump,
    };
    return result;
}

export interface ICommandContext {
    readonly editor: monaco.editor.ICodeEditor;
    readonly model: monaco.editor.ITextModel;
    readonly position: TextPositionFactory;
    readonly vimState: Dispatcher;
}

export interface ICommandArgs {
    count?: number;
    motion?: IMotion;
    register?: number;
    linewise?: boolean;
    char?: string;
    mark?: string;
}

export type CommandFunction = (this: ICommand, ctx: ICommandContext, args: ICommandArgs) => (boolean | void) | PromiseLike<boolean | void>;

export interface ICommand {
    readonly shouldRecord?: boolean;
    readonly run: CommandFunction;
}

export function executeCommand(command: ICommand, ctx: ICommandContext, args: ICommandArgs): void | PromiseLike<void> {
    ctx.vimState.isExecutingCommand = true;
    return doThen(command.run(ctx, args), () => {
        ctx.vimState.isExecutingCommand = false;
        if (command.shouldRecord) {
            recorder.setLast(command, args);
        }
    });
}

