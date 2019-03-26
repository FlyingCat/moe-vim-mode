import { ModeName } from "../types";
import { Remapping, Mapper } from "../configuration";
import { ICommandContext, executeCommand } from "../boot/base";
import * as keyUtils from "../utils/key"
import { KeyCode } from "../utils/KeyCode";
import { Program } from "../matching/program";

const escKey = keyUtils.pack(KeyCode.Escape);

type Job = () => (void | PromiseLike<void>);

export type HandleInputResult = {
    handled: boolean;
    failed?: boolean;
    job?: Job;
} | boolean;

export abstract class Mode {
    readonly name: ModeName;
    readonly displayName: string;

    constructor(name: ModeName, displayName: string) {
        this.name = name;
        this.displayName = displayName;
    }

    abstract leave(): void;

    abstract dispose(): void;

    abstract handleInput(key: number, isFromKeyboard: boolean): HandleInputResult;

    abstract discardInputBuffer(): void;
}

export abstract class ModeBase extends Mode {
    protected inputs: number[] = [];

    protected remapping: Remapping | null = null;

    protected abstract get program(): Program;

    protected abstract get mapper(): Mapper;

    constructor(name: ModeName, displayName: string, readonly context: ICommandContext) {
        super(name, displayName);
    }

    dispose() {
        this.program.reset();
    }

    protected reset() {
        this.inputs = [];
        this.remapping = null;
        this.program.reset();
    }

    discardInputBuffer() {
        this.reset();
    }

    handleInput(key: number, isFromKeyboard: boolean): HandleInputResult {
        const hasBuffer = this.inputs.length !== 0;
        if (key === escKey) {
            if (hasBuffer) {
                this.context.vimState.notifyKeyCanceled(this.inputs);
                this.reset();
                this.context.vimState.notifyKeyBufferChanged('');
                return true;
            }
        }

        this.inputs.push(key);

        if (!hasBuffer || !this.remapping) {
            this.remapping = this.mapper.getRemapping(key);
        }
        else if (this.remapping.status === 'Waiting') {
            this.remapping.next(key);
        }

        if (this.remapping.status === 'End') {
            let mappedKeys = this.remapping.value;
            this.reset();
            if (hasBuffer) {
                this.context.vimState.notifyKeyBufferChanged('');
            }
            this.context.vimState.sendInput(mappedKeys)
            return true;
        }
        if (this.remapping.status === 'UserAction') {
            let action = this.remapping.userAction;
            this.reset();
            if (hasBuffer) {
                this.context.vimState.notifyKeyBufferChanged('');
            }
            return {handled: true, job: () => action(this.context.editor)};
        }
        else {
            let handled = true;
            let failed = false;
            let job: (() => void | PromiseLike<void>) | undefined = undefined;
            let r = this.program.step(this.context.editor.getId(), key);
            if (r.kind === 'Fail' && this.remapping.status === 'Failed') {
                const inputs = this.inputs;
                this.reset();
                if (hasBuffer) {
                    failed = true;
                    this.context.vimState.notifyKeyFailed(inputs)
                }
                else {
                    handled = keyUtils.shouldPreventDefault(key);
                    if (handled) {
                        failed = true;
                        this.context.vimState.notifyKeyFailed(inputs)
                    }
                }
                if (hasBuffer) {
                    this.context.vimState.notifyKeyBufferChanged('');
                }
            }
            else if (r.kind === 'Waiting' || this.remapping.status === 'Waiting') {
                this.context.vimState.notifyKeyWaiting(this.inputs);
                this.context.vimState.notifyKeyBufferChanged(this.inputs);
            }
            else {
                if (r.kind !== 'Matched') {
                    throw new Error();
                }
                this.context.vimState.notifyKeyMatched(this.inputs);
                this.reset();
                if (hasBuffer) {
                    this.context.vimState.notifyKeyBufferChanged('');
                }
                let cap = r.capture;
                let command = cap.command;
                if (!command) {
                    throw new Error('No command is set.')
                }
                job = () => executeCommand(command!, this.context, cap);
            }
            return {handled, failed, job};
        }
    }
}
