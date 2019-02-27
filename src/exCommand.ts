import { configuration } from "./configuration";
import { ICommandContext, executeCommand } from "./command";

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
    }
];

export interface IExCommand {
    matcher: ((s: string) => any | null) | RegExp;
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
    }
];

export function addExCommand(exCommand: IExCommand) {
    exCommands.push(exCommand);
}

export function executeExCommand(ctx: ICommandContext, text: string): void | Promise<void> {
    text = text.replace(/^\s+/, '');
    for (const cmd of exCommands) {
        let matchedValues: any;
        let matched = false;
        if (typeof cmd.matcher === 'function') {
            let r = cmd.matcher(text);
            if (r !== null) {
                matched = true;
                matchedValues = r;
            }
        }
        else {
            let m = text.match(cmd.matcher);
            if (m) {
                matched = true;
                matchedValues = m;
            }
        }
        if (matched) {
            return cmd.handler(ctx, matchedValues);
        }
    }
    ctx.vimState.outputError('Invalid command: ' + text);
}
