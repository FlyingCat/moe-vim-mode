import { configuration } from "./configuration";
import { ICommandContext, executeCommand } from "./boot/base";
import { getMarkByName } from "./impl/sp/mark";

type OptionUnion = {
    type: 'boolean';
    getValue(): boolean;
    setValue(value: boolean): void;
} | {
    type: 'string';
    getValue(): string;
    setValue(value: string): void;
} | {
    type: 'number';
    getValue(): number;
    setValue(value: number): void;
}

type Option = OptionUnion & { names: string[] };

const options: Option[] = [
    {
        type: 'boolean',
        names: ['ignorecase', 'ic'],
        getValue: () => configuration.ignoreCase,
        setValue: v => configuration.ignoreCase = v,
    }, {
        type: 'boolean',
        names: ['smartcase', 'scs'],
        getValue: () => configuration.smartCase,
        setValue: v => configuration.smartCase = v,
    }, {
        type: 'boolean',
        names: ['hlsearch', 'hls'],
        getValue: () => configuration.highlightSearch,
        setValue: v => configuration.highlightSearch = v,
    }, {
        type: 'boolean',
        names: ['incsearch', 'is'],
        getValue: () => configuration.incrementalSearch,
        setValue: v => configuration.incrementalSearch = v,
    }
];

type Matcher = ((s: string) => any | null) | RegExp;

export interface IExCommand {
    matcher: Matcher;
    handler(ctx: ICommandContext, values: any): void | Promise<void>;
}

function findOption(ctx: ICommandContext, name: string, cb: (option: Option)=>void) {
    let opt = options.find(v => v.names.indexOf(name) >= 0);
    if (opt) {
        cb(opt);
    }
    else {
        ctx.vimState.outputError('Unknown option');
    }
}

const exCommands: IExCommand[] = [
    {
        matcher: /^set?\s+no([^=:\s]+)\s*$/,
        handler(ctx, cap: string[]) {
            findOption(ctx, cap[1], opt => {
                if (opt.type === 'boolean') {
                    opt.setValue(false);
                    ctx.vimState.outputInfo('no' + opt.names[0]);
                }
                else {
                    ctx.vimState.outputError('Not a toggle option');
                }
            })
        }
    }, {
        matcher: /^set?\s+(?:inv([^=:\s]+)|([^=:\s]+)!)\s*$/,
        handler(ctx, cap: string[]) {
            let name = cap[1] || cap[2];
            findOption(ctx, name, opt => {
                if (opt.type === 'boolean') {
                    let v = !opt.getValue();
                    opt.setValue(v);
                    ctx.vimState.outputInfo((v ? '' : 'no') + opt.names[0]);
                }
                else {
                    ctx.vimState.outputError('Not a toggle option');
                }
            })
        }
    }, {
        matcher: /^set?\s+([^=:\s]+)\?\s*$/,
        handler(ctx, cap: string[]) {
            findOption(ctx, cap[1], opt => {
                if (opt.type === 'boolean') {
                    ctx.vimState.outputInfo((opt.getValue() ? '' : 'no') + opt.names[0]);
                }
                else {
                    ctx.vimState.outputInfo(opt.getValue().toString());
                }
            })
        }
    }, {
        matcher: /^set?\s+([^=:\s]+)\s*$/,
        handler(ctx, cap: string[]) {
            findOption(ctx, cap[1], opt => {
                if (opt.type === 'boolean') {
                    opt.setValue(true);
                    ctx.vimState.outputInfo(opt.names[0]);
                }
                else {
                    ctx.vimState.outputInfo(opt.getValue().toString());
                }
            })
        }
    }, {
        matcher: /^set?\s+([^=:\s]+)[=:](\S+)\s*$/,
        handler(ctx, cap: string[]) {
            let name = cap[1];
            let value = cap[2];
            options.forEach(opt => {
                if (opt.names.indexOf(name) >= 0) {
                    if (opt.type === 'boolean') {
                        ctx.vimState.outputError('Invaid argument');
                    }
                    else if (opt.type === 'string') {
                        opt.setValue(value);
                    }
                    else {
                        let num = parseInt(value);
                        if (isNaN(num)) {
                            ctx.vimState.outputError('Number required after =');
                        }
                        else {
                            opt.setValue(Math.floor(num));
                        }
                    }
                }
            });
        }
    }, {
        matcher: /^(n|v)map\s+(\S+)\s+(\S+)\s*$/,
        handler(ctx, cap: string[]) {
            if (cap[1] === 'n') {
                configuration.nmap.addString(cap[2], cap[3]);
            }
            else {
                configuration.vmap.addString(cap[2], cap[3]);
            }
        }
    },
];

export function addExCommand(command: IExCommand) {
    exCommands.push(command);
}

export interface ICommandRange {
    readonly first: number;
    readonly last: number;
}

export interface IExRangeCommand {
    matcher: Matcher;
    handler(ctx: ICommandContext, range: ICommandRange, values: any): void | PromiseLike<void>;
}

const rangeCommands: IExRangeCommand[] = [];

export function addExRangeCommand(command: IExRangeCommand) {
    rangeCommands.push(command);
}

function findCommand<T>(commands: {matcher: Matcher, handler: T}[], text: string) {
    for (const command of commands) {
        let matchedValues: any;
        if (typeof command.matcher === 'function') {
            let r = command.matcher(text);
            if (r !== null) {
                return {command, matchedValues: r};
            }
        }
        else {
            let m = text.match(command.matcher);
            if (m) {
                return {command, matchedValues: m};
            }
        }
    }
}

export function executeExCommand(ctx: ICommandContext, text: string): void | PromiseLike<void> {
    text = text.replace(/^\s+/, '');
    let range: {range: [RangeLine, RangeLine], next: number} | null = null;
    try {
        range = new RangeParser(text).match();
    }
    catch (e) {
        ctx.vimState.outputError('Invalid command range: ' + text);
        return;
    }
    if (range) {
        text = text.substring(range.next);
        if (text === '') {
            let ln = resolveRangeLine(ctx, range.range[1]);
            if (typeof ln === 'string') {
                ctx.vimState.outputError(ln);
            }
            else {
                ctx.position.get(ln, '^').live();
            }
            return;
        }
        let matched = findCommand(rangeCommands, text);
        if (matched) {
            let first = resolveRangeLine(ctx, range.range[0]);
            if (typeof first === 'string') {
                ctx.vimState.outputError(first);
                return;
            }
            let last = resolveRangeLine(ctx, range.range[1]);
            if (typeof last === 'string') {
                ctx.vimState.outputError(last);
                return;
            }
            if (first > last) {
                let tmp = first;
                first = last;
                last = tmp;
            }
            return matched.command.handler(ctx, {first, last}, matched.matchedValues);
        }
    }
    else {
        {
            let matched = findCommand(exCommands, text);
            if (matched) {
                return matched.command.handler(ctx, matched.matchedValues);
            }
        }
        {
            let matched = findCommand(rangeCommands, text);
            let ln = ctx.editor.getPosition()!.lineNumber;
            if (matched) {
                return matched.command.handler(ctx, {first: ln, last: ln}, matched.matchedValues);
            }
        }
    }
    ctx.vimState.outputError('Invalid command: ' + text);
}

type RangeLineUnion = {
    kind: 'number';
    value: number;
} | {
    kind: 'cursor';
} | {
    kind: 'last';
} | {
    kind: 'mark';
    name: string;
}

type RangeLine = RangeLineUnion & { offset?: number }

function resolveRangeLine(ctx: ICommandContext, val: RangeLine): number | string {
    let lineCount = ctx.model.getLineCount();
    let ln: number;
    if (val.kind === 'number') {
        ln = val.value;
    }
    else if (val.kind === 'cursor') {
        ln = ctx.editor.getPosition()!.lineNumber;
    }
    else if (val.kind === 'last') {
        ln = lineCount;
    }
    else {
        let markPos = getMarkByName(ctx, val.name);
        if (!markPos) {
            return 'Invalid mark';
        }
        ln = markPos.lineNumber;
    }
    if (val.offset) {
        ln += val.offset;
    }
    return ln > lineCount ? lineCount : (ln < 1 ? 1 : ln);
}

function ifThen<T>(r: T | null, cb: (v: T) => void) {
    if (r !== null) {
        cb(r);
    }
}

class RangeParser {
    private pos = 0;

    private len: number;

    constructor(readonly input: string) {
        this.len = input.length;
    }

    match(): {range: [RangeLine, RangeLine], next: number} | null {
        // let value: RangeValue | null = null;
        const range: RangeLine[] = [];
        if (this.matchOne(range)) {
            while (this.tryMatchString(',')) {
                this.skipWhiteSpace();
                if (!this.matchOne(range)) {
                    break;
                }
            }
        }
        let size = range.length;
        if (size === 0) {
            return null;
        }
        else if (size === 1) {
            return {range: [range[0], range[0]], next: this.pos};
        }
        else {
            return { range: [range[size - 2], range[size - 1]], next: this.pos };
        }
    }

    matchOne(range: RangeLine[]): boolean {
        let num: number | null = null;
        let s: string | null = null;
        if ((num = this.tryMatchNumber()) !== null) {
            const line: RangeLine = {kind: 'number', value: num};
            this.matchOffset(line);
            range.push(line);
            this.skipWhiteSpace();
            return true;
        }
        else if (s = this.tryMatchCharSet('.$')) {
            let kind: any = s === '.' ? 'cursor' : 'last';
            const line: RangeLine = { kind };
            this.matchOffset(line);
            range.push(line);
            this.skipWhiteSpace();
            return true;
        }
        else if (this.tryMatchString('%')) {
            const first: RangeLine = {kind: 'number', value: 1};
            const last: RangeLine = {kind: 'last'};
            this.matchOffset();
            range.push(first);
            range.push(last);
            this.skipWhiteSpace();
            return true;
        }
        else if (this.tryMatchString('*')) {
            const first: RangeLine = {kind: 'mark', name: '<'};
            const last: RangeLine = {kind: 'mark', name: '>'};
            this.matchOffset();
            range.push(first);
            range.push(last);
            this.skipWhiteSpace();
            return true;
        }
        else if (this.tryMatchString("'")) {
            let name = this.matchChar();
            const line: RangeLine = {kind: 'mark', name};
            this.matchOffset(line);
            range.push(line);
            this.skipWhiteSpace();
            return true;
        }
        return false;
    }

    matchOffset(line?: RangeLine) {
        let s: string | null;
        let offset = 0;
        while (s = this.tryMatchCharSet('+-')) {
            let num = s === '+' ? 1 : -1;
            ifThen(this.tryMatchNumber(), x => num *= x);
            offset += num;
        }
        if (offset !== 0 && line) {
            line.offset = offset;
        }
    }

    skipWhiteSpace() {
        while (this.pos < this.len) {
            let code = this.input.charCodeAt(this.pos);
            if (code === 32 || code === 9) {
                this.pos++;
            }
            else {
                break;
            }
        }
    }

    matchChar() {
        if (this.pos >= this.len) {
            throw new Error();
        }
        return this.input.charAt(this.pos++);
    }

    tryMatchString(str: string): string | null {
        if (this.pos + str.length - 1 < this.len) {
            if (this.input.substring(this.pos, this.pos + str.length) === str) {
                this.pos += str.length;
                return str;
            }
        }
        return null;
    }

    tryMatchCharSet(set: string): string | null {
        if (this.pos < this.len) {
            let ch = this.input[this.pos];
            if (set.indexOf(ch) >= 0) {
                this.pos++;
                return ch;
            }
        }
        return null;
    }

    tryMatchNumber(): number | null {
        let start = this.pos;
        let cur = this.pos;
        while (cur < this.len) {
            let c = this.input.charCodeAt(cur);
            if (c >= 48 && c <= 57) {
                cur++;
            }
            else {
                break;
            }
        }
        if (start !== cur) {
            this.pos = cur;
            return parseInt(this.input.substring(start, cur));
        }
        else {
            return null;
        }
    }
}
