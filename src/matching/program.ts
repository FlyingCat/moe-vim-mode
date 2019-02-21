import { Pattern, CapAction, SeqAction, IMatchCapture } from "./pattern";
import { SeqMap } from "./seqMap";
import { isCharKey } from "../utils/key";
import { MotionFunction } from "../motions";
import { registerManager } from "../registerManager";
import { ICommand } from "../command";

class Registry {
    private list: any[] = [];
    private map = new Map<any, number>();

    put(value: any): number {
        let r = this.map.get(value);
        if (r !== undefined) {
            return r;
        }
        this.list.push(value);
        let idx = this.list.length - 1;
        this.map.set(value, idx);
        return idx;
    }

    get(id: number): any {
        return this.list[id];
    }
}

const registry = new Registry();

class ThreadState implements IMatchCapture
{
    private _ref = 1;

    // captures
    command?: ICommand;
    count?: number;
    motion?: MotionFunction;
    linewise?: boolean;
    register?: number;
    char?: string;

    // runtime props
    positions: number[] = [];
    keyMap?: SeqMap<number, number>;

    constructor() {
    }

    ref(): ThreadState {
        this._ref += 1;
        return this;
    }

    cloneIfNeed(): ThreadState {
        if (this._ref > 1) {
            let clone = new ThreadState();
            clone.command = this.command;
            clone.count = this.count;
            clone.motion = this.motion;
            clone.linewise = this.linewise;
            clone.positions = this.positions.slice();
            clone.keyMap = this.keyMap;
            clone.register = this.register;
            this._ref--;
            return clone;
        }
        else {
            return this;
        }
    }

    setCommand(value: ICommand): ThreadState {
        let obj = this.cloneIfNeed();
        obj.command = value;
        return obj;
    }

    setMotion(value: MotionFunction): ThreadState {
        let obj = this.cloneIfNeed();
        obj.motion = value;
        return obj;
    }

    setCount(value: number): ThreadState {
        let obj = this.cloneIfNeed();
        obj.count = value;
        return obj;
    }

    setLinewise(value: boolean): ThreadState {
        let obj = this.cloneIfNeed();
        obj.linewise = value;
        return obj;
    }

    setRegister(value: number): ThreadState {
        let obj = this.cloneIfNeed();
        obj.register = value;
        return obj;
    }

    pushPositon(value: number): ThreadState {
        let obj = this.cloneIfNeed();
        obj.positions.push(value);
        return obj;
    }

    popPositon(): {value: number, state: ThreadState} {
        let state = this.cloneIfNeed();
        let value = state.positions.pop();
        if (value === undefined) {
            throw new Error('Array.pop fail.')
        }
        return {value, state};
    }

    setMap(map: SeqMap<number, number>): ThreadState {
        let obj = this.cloneIfNeed();
        obj.keyMap = map;
        return obj;
    }

    resetMap(): ThreadState {
        let obj = this.cloneIfNeed();
        obj.keyMap = undefined;
        return obj;
    }
}

class Thread {
    constructor(public pc: number, public state: ThreadState) {
    }
}

export interface StepFail {
    kind: 'Fail';
    inputs: ReadonlyArray<number>;
}

export interface StepWaiting {
    kind: 'Waiting';
    inputs: ReadonlyArray<number>;
}

export interface StepMatched {
    kind: 'Matched';
    inputs: ReadonlyArray<number>;
    capture: Readonly<IMatchCapture>;
}

export type StepResult = StepFail | StepWaiting | StepMatched;

export class Program {
    private code: Int16Array;

    private inputs: number[] = [];

    private threads: Thread[] = [];

    private source: string | null = null;

    constructor(patt: Pattern) {
        this.code = new Int16Array(count(patt) + 1);
        let len = compile(this.code, 0, patt);
        this.code[len] = OpCode.End;
        this.execNextInst(new Thread(0, new ThreadState()));
    }

    getInputs(): ReadonlyArray<number> {
        return this.inputs;
    }

    getSource(): string | null {
        return this.source;
    }

    isWaiting() {
        return this.inputs.length !== 0;
    }

    step(source: string, key: number): StepResult {
        if (this.source && this.source !== source) {
            this.reset();
            this.source = source;
        }
        this.inputs.push(key);
        let clist = this.threads;
        this.threads = [];
        for (let i = 0; i < clist.length; i++) {
            let t = clist[i];
            switch (this.code[t.pc]) {
                case OpCode.Key:
                    if (this.code[t.pc + 1] === key) {
                        t.pc += 2;
                        if (this.execNextInst(t)) {
                            return this.matched(t);
                        }
                    }
                    break;
                case OpCode.Digit:
                    if (key >= '0'.charCodeAt(0) && key <= '9'.charCodeAt(0)) {
                        t.pc += 1;
                        if (this.execNextInst(t)) {
                            return this.matched(t);
                        }
                    }
                    break;
                case OpCode.NonZeroDigit:
                    if (key >= '1'.charCodeAt(0) && key <= '9'.charCodeAt(0)) {
                        t.pc += 1;
                        if (this.execNextInst(t)) {
                            return this.matched(t);
                        }
                    }
                    break;
                case OpCode.Char:
                    if (isCharKey(key)) {
                        t.pc += 1;
                        if (this.execNextInst(t)) {
                            return this.matched(t);
                        }
                    }
                    break;
                case OpCode.Register:
                    let rid = registerManager.convertToId(key);
                    if (rid !== undefined) {
                        t.state = t.state.setRegister(rid);
                        t.pc += 1;
                        if (this.execNextInst(t)) {
                            return this.matched(t);
                        }
                    }
                    break;
                case OpCode.Seq:
                    let map = t.state.keyMap || (registry.get(this.code[t.pc + 1]) as SeqMap<number, number>);
                    let r = map.get(key);
                    if (r !== undefined) {
                        if (r instanceof Map) {
                            t.state = t.state.setMap(r);
                            this.threads.push(t);
                        }
                        else {
                            t.state = t.state.resetMap();
                            if ((registry.get(this.code[t.pc + 2]) as SeqAction)(t.state, r) === true) {
                                return this.matched(t);
                            }
                            t.pc += 3;
                            if (this.execNextInst(t)) {
                                return this.matched(t);
                            }
                        }
                    }
                    break;
                default:
                    throw new Error('Unexpected behavior.');
            }
        }
        let inputs = this.inputs;
        if (this.threads.length === 0) {
            this.reset();
            return {kind: 'Fail', inputs};
        }
        else {
            return {kind: 'Waiting', inputs};
        }
    }

    reset() {
        this.inputs = [];
        this.threads = [];
        this.source = null;
        this.execNextInst(new Thread(0, new ThreadState()));
    }

    private matched(t: Thread): StepResult {
        let inputs = this.inputs;
        this.reset();
        return { kind: 'Matched', inputs, capture: t.state };
    }

    private execNextInst(t: Thread): boolean {
        let pos = t.pc;
        switch (this.code[pos]) {
            case OpCode.End:
                return true;
            case OpCode.Key:
            case OpCode.Digit:
            case OpCode.Char:
            case OpCode.NonZeroDigit:
            case OpCode.Register:
            case OpCode.Seq:
                this.threads.push(t);
                break;
            case OpCode.SetCommand:
                t.state = t.state.setCommand(registry.get(this.code[pos + 1]));
                t.pc += 2;
                return this.execNextInst(t);
            case OpCode.SetMotion:
                t.state = t.state.setMotion(registry.get(this.code[pos + 1]));
                t.pc += 2;
                return this.execNextInst(t);
            case OpCode.SetLinewise:
                t.state = t.state.setLinewise(this.code[pos + 1] === 1);
                t.pc += 2;
                return this.execNextInst(t);
            case OpCode.Push:
                t.state = t.state.pushPositon(this.inputs.length);
                t.pc += 1;
                return this.execNextInst(t);
            case OpCode.Pop:
                let r = t.state.popPositon();
                t.state = r.state;
                (registry.get(this.code[pos + 1]) as CapAction)(t.state, this.inputs, r.value);
                t.pc += 2;
                return this.execNextInst(t);
            case OpCode.Jump:
                t.pc = pos + this.code[pos + 1];
                return this.execNextInst(t);
            case OpCode.Split:
                t.pc += 2;
                let r1 = this.execNextInst(t);
                let r2 = this.execNextInst(new Thread(pos + this.code[pos + 1], t.state.ref()));
                if (r1 || r2) {
                    throw new Error('"Split" direct to end state.')
                }
                break;
        }
        return false;
    }
}

export enum OpCode {
    End,
    Key,
    Digit,
    NonZeroDigit,
    Char,
    Register,
    Split,
    Jump,
    Push,
    Pop,
    Seq,
    SetCommand,
    SetMotion,
    SetLinewise,
}

function count(patt: Pattern): number {
    switch (patt.kind) {
        case 'Key':
            return 2;
        case 'Digit':
        case 'Char':
        case 'Reg':
            return 1;
        case 'Cat':
            return count(patt.left) + count(patt.right);
        case 'Alt':
            return 4 + count(patt.left) + count(patt.right);
        case 'Opt':
            return 2 + count(patt.child);
        case 'Plus':
            return 2 + count(patt.child);
        case 'Star':
            return 4 + count(patt.child);
        case 'Seq':
            return 3;
        case 'Set':
            return 2;
        case 'Cap':
            return 3 + count(patt.child);
    }
}

function compile(store: Int16Array, pos: number, patt: Pattern): number {
    let len: number;
    let len2: number;
    switch (patt.kind) {
        case 'Key':
            store[pos] = OpCode.Key;
            store[pos + 1] = patt.key;
            return 2;
        case 'Digit':
            store[pos] = patt.nonZero ? OpCode.NonZeroDigit : OpCode.Digit;
            return 1;
        case 'Char':
            store[pos] = OpCode.Char;
            return 1;
        case 'Reg':
            store[pos] = OpCode.Register;
            return 1;
        case 'Cat':
            len = compile(store, pos, patt.left);
            return len + compile(store, pos + len, patt.right);
        case 'Alt':
            len = compile(store, pos + 2, patt.left);
            len2 = compile(store, pos + len + 4, patt.right);
            store[pos] = OpCode.Split;
            store[pos + 1] = len + 4;
            store[pos + len  + 2] = OpCode.Jump;
            store[pos + len  + 3] = len2 + 2;
            return len + len2 + 4;
        case 'Opt':
            len = compile(store, pos + 2, patt.child);
            store[pos] = OpCode.Split;
            store[pos + 1] = len + 2;
            return len + 2;
        case 'Plus':
            len = compile(store, pos, patt.child);
            store[pos + len] = OpCode.Split;
            store[pos + len + 1] = -len;
            return len + 2;
        case 'Star':
            len = compile(store, pos + 2, patt.child);
            store[pos] = OpCode.Split;
            store[pos + 1] = len + 4;
            store[pos + len  + 2] = OpCode.Jump;
            store[pos + len  + 3] = -(len + 2);
            return len + 4;
        case 'Seq':
            store[pos] = OpCode.Seq;
            store[pos + 1] = registry.put(patt.target);
            store[pos + 2] = registry.put(patt.action);
            return 3;
        case 'Set':
            switch (patt.target.which) {
                case 'command':
                    store[pos] = OpCode.SetCommand;
                    store[pos + 1] = registry.put(patt.target.value);
                    break;
                case 'motion':
                    store[pos] = OpCode.SetMotion;
                    store[pos + 1] = registry.put(patt.target.value);
                    break;
                case 'linewise':
                    store[pos] = OpCode.SetLinewise;
                    store[pos + 1] = patt.target.value ? 1 : 0;
                    break;
            }
            return 2;
        case 'Cap':
            store[pos] = OpCode.Push;
            len = compile(store, pos + 1, patt.child);
            store[pos + len + 1] = OpCode.Pop;
            store[pos + len + 2] = registry.put(patt.action);
            return len + 3;
    }
}
