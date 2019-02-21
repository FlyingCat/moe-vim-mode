import { ICommand, ICommandArgs, ICommandContext, executeCommand } from "./command";
import { cloneCommandArgs, doThen } from "./utils/helper";

export interface IRepeatableAction {
    setCount(value: number): void;
    execute(ctx: ICommandContext): void | PromiseLike<void>;
}

export class CommonRepeatableAction implements IRepeatableAction {
    constructor(readonly command: ICommand, readonly args: ICommandArgs) {
    }

    setCount(value: number) {
        this.args.count = value;
    }

    execute(ctx: ICommandContext) {
        return executeCommand(this.command, ctx, this.args);
    }
}

class Record {
    private last?: IRepeatableAction;

    setLast(cmd: ICommand, args: ICommandArgs) {
        this.last = new CommonRepeatableAction(cmd, args);
    }

    setLastAction(action: IRepeatableAction) {
        this.last = action;
    }

    repeatLast(ctx: ICommandContext, count?: number) {
        if (!this.last) {
            return;
        }
        if (count !== undefined) {
            this.last.setCount(count);
        }
        ctx.vimState.isRepeating = true;
        return doThen(this.last.execute(ctx), () => {
            ctx.vimState.isRepeating = false;
        });
    }
}

export const recorder = new Record();
