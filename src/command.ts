import { TextPositionFactory } from "./text/position";
import { Dispatcher, GlobalState } from "./Dispatcher";
import { MotionFunction } from "./motions";
import { recorder } from "./recorder";
import { doThen } from "./utils/helper";
import * as monaco from "monaco-editor";

export interface ICommandContext {
    readonly editor: monaco.editor.ICodeEditor;
    readonly model: monaco.editor.ITextModel;
    readonly position: TextPositionFactory;
    readonly vimState: Dispatcher;
    readonly globalState: GlobalState;
}

export interface ICommandArgs {
    count?: number;
    motion?: MotionFunction;
    register?: number;
    linewise?: boolean;
    char?: string;
}

export type CommandFunction = (this: ICommand, ctx: ICommandContext, args: ICommandArgs) => void | PromiseLike<void>;

export interface ICommand {
    readonly shouldRecord: boolean;
    readonly run: CommandFunction;
}

export type CommandConfig = CommandFunction | (Partial<ICommand> & Pick<ICommand, 'run'>);

export function createCommand(arg: CommandConfig): ICommand {
    let cmd = typeof arg === 'function' ? { run: arg } : arg;
    let def = {
        shouldRecord: false,
    };
    return Object.assign(def, cmd);
}

export function executeCommand(command: ICommand, ctx: ICommandContext, args: ICommandArgs): void | PromiseLike<void> {
    ctx.vimState.isExecutingCommand = true;
    return doThen(command.run(ctx, args), () => {
        ctx.vimState.isExecutingCommand = false;
        if (command.shouldRecord !== false) {
            recorder.setLast(command, args);
        }
    });
}

