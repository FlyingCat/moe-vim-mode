import { Pattern, CapAction, IMatchCapture } from "./pattern";
import { isCharKey } from "../utils/key";
import { registerManager } from "../registerManager";
import { ICommand, IMotion } from "../boot/base";
import { convertToMarkId } from "../impl/sp/markCommon";

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
    private _ref: number | null;

    // captures
    command?: ICommand;
    count?: number;
    motion?: IMotion;
    linewise?: boolean;
    register?: number;
    char?: string;
    mark?: string;

    // runtime props
    positions: number[] = [];
    callStack: number[] = [];

    constructor(frozen = false) {
        this._ref = frozen ? null : 1;
    }

    freeze() {
        this._ref = null;
    }

    isFrozen() {
        return this._ref === null;
    }

    ref(): ThreadState {
        if (this._ref !== null) {
            this._ref += 1;
        }
        return this;
    }

    cloneIfNeed(): ThreadState {
        if (this._ref === null || this._ref > 1) {
            let clone = new ThreadState();
            clone.command = this.command;
            clone.count = this.count;
            clone.motion = this.motion;
            clone.linewise = this.linewise;
            clone.positions = this.positions.slice();
            clone.callStack = this.callStack.slice();
            clone.register = this.register;
            clone.char = this.char;
            clone.mark = this.mark;
            if (this._ref !== null) {
                this._ref--;
            }
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

    setMotion(value: IMotion): ThreadState {
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

    setChar(value: string): ThreadState {
        let obj = this.cloneIfNeed();
        obj.char = value;
        return obj;
    }

    setMark(value: string): ThreadState {
        let obj = this.cloneIfNeed();
        obj.mark = value;
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

    pushCall(pc: number) {
        let obj = this.cloneIfNeed();
        obj.callStack.push(pc);
        return obj;
    }

    popCall(): {pc: number, state: ThreadState} {
        let state = this.cloneIfNeed();
        let pc = state.callStack.pop();
        if (pc === undefined) {
            throw new Error('Array.pop fail.')
        }
        return {pc, state};
    }
}

class Thread {
    private frozen = false;

    constructor(private _pc: number, private _state: ThreadState) {
    }

    get pc() {
        return this._pc;
    }

    get state() {
        return this._state;
    }

    freeze() {
        this.state.freeze();
        this.frozen = true;
    }

    update(pc?: number, state?: ThreadState): Thread {
        pc = pc || this.pc;
        state = state || this.state;
        if (pc === this.pc && state === this.state) {
            return this;
        }
        if (this.frozen) {
            return new Thread(pc, state);
        }
        else {
            this._pc = pc;
            this._state = state;
            return this;
        }
    }
}

class ThreadList {
    private literalKeys = new Map<number, Thread | Thread[]>();

    private others: Thread[] = [];

    private frozen = false;

    push(thread: Thread) {
        if (this.frozen) {
            throw new Error();
        }
        this.others.push(thread);
    }

    pushKey(key: number, thread: Thread) {
        if (this.frozen) {
            throw new Error();
        }
        let val = this.literalKeys.get(key);
        if (val) {
            if (Array.isArray(val)) {
                val.push(thread);
            }
            else {
                this.literalKeys.set(key, [val, thread]);
            }
        }
        else {
            this.literalKeys.set(key, thread);
        }
    }

    getMatchedKeyThreads(key: number): ReadonlyArray<Thread> {
        let val = this.literalKeys.get(key);
        if (val) {
            if (Array.isArray(val)) {
                return val;
            }
            else {
                return [val];
            }
        }
        else {
            return [];
        }
    }

    getCommonThreads(): ReadonlyArray<Thread> {
        return this.others;
    }

    empty(): boolean {
        return this.others.length === 0 && this.literalKeys.size === 0;
    }

    freeze() {
        this.literalKeys.forEach(val => {
            if (Array.isArray(val)) {
                for (const t of val) {
                    t.freeze();
                }
            }
            else {
                val.freeze();
            }
        });
        for (const t of this.others) {
            t.freeze();
        }
        this.frozen = true;
        return this;
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

    private threads = new ThreadList();

    private readonly startupThreads: ThreadList;

    private source: string | null = null;

    constructor(patt: Pattern) {
        let routines: {pattern: Pattern, size: number, start: number}[] = [];
        let size = count(patt, routines) + 1;
        for (const item of routines) {
            item.start = size;
            size += item.size + 1;
        }
        this.code = new Int16Array(size);
        let len = compile(this.code, 0, patt, routines);
        this.code[len++] = OpCode.End;
        for (const item of routines) {
            len += compile(this.code, len, item.pattern, routines);
            this.code[len++] = OpCode.EndCall;
        }
        this.execNextInst(new Thread(0, new ThreadState(true)));
        this.startupThreads = this.threads.freeze();
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
        this.threads = new ThreadList();
        let keyThreads = clist.getMatchedKeyThreads(key);
        let endState: ThreadState | undefined = undefined;
        for (let i = 0; i < keyThreads.length; i++) {
            let t = keyThreads[i];
            if (this.code[t.pc] !== OpCode.Key) {
                throw new Error();
            }
            if (endState = this.execNextInst(t.update(t.pc + 2))) {
                return this.matched(endState);
            }
        }
        let commonThreads = clist.getCommonThreads()
        for (let i = 0; i < commonThreads.length; i++) {
            let t = commonThreads[i];
            switch (this.code[t.pc]) {
                case OpCode.Range:
                    if (key >= this.code[t.pc + 1] && key <= this.code[t.pc + 2]) {
                        if (endState = this.execNextInst(t.update(t.pc + 3))) {
                            return this.matched(endState);
                        }
                    }
                    break;
                case OpCode.Digit:
                    if (key >= '0'.charCodeAt(0) && key <= '9'.charCodeAt(0)) {
                        if (endState = this.execNextInst(t.update(t.pc + 1))) {
                            return this.matched(endState);
                        }
                    }
                    break;
                case OpCode.NonZeroDigit:
                    if (key >= '1'.charCodeAt(0) && key <= '9'.charCodeAt(0)) {
                        if (endState = this.execNextInst(t.update(t.pc + 1))) {
                            return this.matched(endState);
                        }
                    }
                    break;
                case OpCode.Char:
                    if (isCharKey(key)) {
                        if (endState = this.execNextInst(t.update(t.pc + 1, t.state.setChar(String.fromCharCode(key))))) {
                            return this.matched(endState);
                        }
                    }
                    break;
                case OpCode.Register:
                    let rid = registerManager.convertToId(key);
                    if (rid !== undefined) {
                        if (endState = this.execNextInst(t.update(t.pc + 1, t.state.setRegister(rid)))) {
                            return this.matched(endState);
                        }
                    }
                    break;
                case OpCode.Mark:
                    let mid = convertToMarkId(key);
                    if (mid) {
                        if (endState = this.execNextInst(t.update(t.pc + 1, t.state.setMark(mid)))) {
                            return this.matched(endState);
                        }
                    }
                    break;
                default:
                    throw new Error('Unexpected behavior.');
            }
        }
        let inputs = this.inputs;
        if (this.threads.empty()) {
            this.reset();
            return {kind: 'Fail', inputs};
        }
        else {
            return {kind: 'Waiting', inputs};
        }
    }

    reset() {
        this.inputs = [];
        this.source = null;
        this.threads = this.startupThreads;
    }

    private matched(state: ThreadState): StepResult {
        let inputs = this.inputs;
        this.reset();
        return { kind: 'Matched', inputs, capture: state };
    }

    private execNextInst(t: Thread): ThreadState | undefined {
        let pos = t.pc;
        switch (this.code[pos]) {
            case OpCode.End:
                return t.state;
            case OpCode.BeginCall:
                return this.execNextInst(t.update(this.code[pos + 1], t.state.pushCall(pos + 2)));
            case OpCode.EndCall:
                let res = t.state.popCall();
                return this.execNextInst(t.update(res.pc, res.state));
            case OpCode.Key:
                this.threads.pushKey(this.code[pos + 1], t);
                break;
            case OpCode.Range:
            case OpCode.Digit:
            case OpCode.Char:
            case OpCode.NonZeroDigit:
            case OpCode.Register:
            case OpCode.Mark:
                this.threads.push(t);
                break;
            case OpCode.SetCommand:
                return this.execNextInst(t.update(t.pc + 2, t.state.setCommand(registry.get(this.code[pos + 1]))));
            case OpCode.SetMotion:
                return this.execNextInst(t.update(t.pc + 2, t.state.setMotion(registry.get(this.code[pos + 1]))));
            case OpCode.SetLinewise:
                return this.execNextInst(t.update(t.pc + 2, t.state.setLinewise(this.code[pos + 1] === 1)));
            case OpCode.Push:
                return this.execNextInst(t.update(t.pc + 1, t.state.pushPositon(this.inputs.length)));
            case OpCode.Pop:
                let r = t.state.popPositon();
                (registry.get(this.code[pos + 1]) as CapAction)(r.state, this.inputs, r.value);
                return this.execNextInst(t.update(t.pc + 2, r.state));
            case OpCode.Jump:
                return this.execNextInst(t.update(pos + this.code[pos + 1]));
            case OpCode.Split:
                let state = t.state.ref();
                let r1 = this.execNextInst(t.update(t.pc + 2));
                let r2 = this.execNextInst(new Thread(pos + this.code[pos + 1], state));
                if (r1 || r2) {
                    throw new Error('"Split" direct to end state.')
                }
                break;
        }
        return undefined;
    }
}

const enum OpCode {
    End,
    BeginCall,
    EndCall,
    Key,
    Range,
    Digit,
    NonZeroDigit,
    Char,
    Register,
    Mark,
    Split,
    Jump,
    Push,
    Pop,
    SetCommand,
    SetMotion,
    SetLinewise,
}

function count(patt: Pattern, routinesRef: {pattern: Pattern, size: number}[]): number {
    switch (patt.kind) {
        case 'Key':
            return 2;
        case 'Range':
            return 3;
        case 'Digit':
        case 'Char':
        case 'Reg':
        case 'Mark':
            return 1;
        case 'Cat':
            return count(patt.left, routinesRef) + count(patt.right, routinesRef);
        case 'Alt':
            return 4 + count(patt.left, routinesRef) + count(patt.right, routinesRef);
        case 'Opt':
            return 2 + count(patt.child, routinesRef);
        case 'Plus':
            return 2 + count(patt.child, routinesRef);
        case 'Star':
            return 4 + count(patt.child, routinesRef);
        case 'WriteCommand':
        case 'WriteMotion':
        case 'WriteLinewise':
            return 2;
        case 'Cap':
            return 3 + count(patt.child, routinesRef);
        case 'Routine':
            if (routinesRef.findIndex(x => x.pattern === patt.child) < 0) {
                let ref = {pattern: patt.child, size: 0};
                routinesRef.push(ref);
                ref.size = count(patt.child, routinesRef);
            }
            return 2;
        default:
            throw new Error();
    }
}

function compile(store: Int16Array, pos: number, patt: Pattern, routinesRef: {pattern: Pattern, start: number}[]): number {
    let len: number;
    let len2: number;
    switch (patt.kind) {
        case 'Key':
            store[pos] = OpCode.Key;
            store[pos + 1] = patt.key;
            return 2;
        case 'Range':
            store[pos] = OpCode.Range;
            store[pos + 1] = patt.from;
            store[pos + 2] = patt.to;
            return 3;
        case 'Digit':
            store[pos] = patt.nonZero ? OpCode.NonZeroDigit : OpCode.Digit;
            return 1;
        case 'Char':
            store[pos] = OpCode.Char;
            return 1;
        case 'Reg':
            store[pos] = OpCode.Register;
            return 1;
        case 'Mark':
            store[pos] = OpCode.Mark;
            return 1;
        case 'Cat':
            len = compile(store, pos, patt.left, routinesRef);
            return len + compile(store, pos + len, patt.right, routinesRef);
        case 'Alt':
            len = compile(store, pos + 2, patt.left, routinesRef);
            len2 = compile(store, pos + len + 4, patt.right, routinesRef);
            store[pos] = OpCode.Split;
            store[pos + 1] = len + 4;
            store[pos + len  + 2] = OpCode.Jump;
            store[pos + len  + 3] = len2 + 2;
            return len + len2 + 4;
        case 'Opt':
            len = compile(store, pos + 2, patt.child, routinesRef);
            store[pos] = OpCode.Split;
            store[pos + 1] = len + 2;
            return len + 2;
        case 'Plus':
            len = compile(store, pos, patt.child, routinesRef);
            store[pos + len] = OpCode.Split;
            store[pos + len + 1] = -len;
            return len + 2;
        case 'Star':
            len = compile(store, pos + 2, patt.child, routinesRef);
            store[pos] = OpCode.Split;
            store[pos + 1] = len + 4;
            store[pos + len  + 2] = OpCode.Jump;
            store[pos + len  + 3] = -(len + 2);
            return len + 4;
        case 'WriteCommand':
            store[pos] = OpCode.SetCommand;
            store[pos + 1] = registry.put(patt.value);
            return 2;
        case 'WriteMotion':
            store[pos] = OpCode.SetMotion;
            store[pos + 1] = registry.put(patt.value);
            return 2;
        case 'WriteLinewise':
            store[pos] = OpCode.SetLinewise;
            store[pos + 1] = patt.value ? 1 : 0;
            return 2;
        case 'Cap':
            store[pos] = OpCode.Push;
            len = compile(store, pos + 1, patt.child, routinesRef);
            store[pos + len + 1] = OpCode.Pop;
            store[pos + len + 2] = registry.put(patt.action);
            return len + 3;
        case 'Routine':
            let routine = routinesRef.find(x => x.pattern === patt.child);
            if (!routine) {
                throw new Error();
            }
            store[pos] = OpCode.BeginCall;
            store[pos + 1] = routine.start;
            return 2;
        default:
            throw new Error();
    }
}
