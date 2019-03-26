import { IMotion, ICommand } from "../boot/base";

export interface IMatchCapture {
    command?: ICommand;
    count?: number;
    motion?: IMotion;
    register?: number;
    linewise?: boolean;
    char?: string;
}

export type CapAction = (c: IMatchCapture, inputs: number[], index: number) => void;

export type Pattern = {
    kind: 'Key';
    key: number;
} | {
    kind: 'Range';
    from: number;
    to: number;
} | {
    kind: 'Digit';
    nonZero?: boolean;
} | {
    kind: 'Cat';
    left: Pattern;
    right: Pattern;
} | {
    kind: 'Alt';
    left: Pattern;
    right: Pattern;
} | {
    kind: 'Opt';
    child: Pattern;
} | {
    kind: 'Plus';
    child: Pattern;
} | {
    kind: 'Star';
    child: Pattern;
} | {
    kind: 'Routine';
    child: Pattern;
} | {
    kind: 'Cap';
    child: Pattern;
    action: CapAction;
} | {
    kind: 'WriteMotion';
    value: IMotion;
} | {
    kind: 'WriteCommand';
    value: ICommand;
} | {
    kind: 'WriteLinewise';
    value: boolean;
} | {
    kind: 'MotionHolder';
} | {
    kind: 'TextObjectHolder';
} | {
    kind: 'OperatorMotionHolder';
} | {
    kind: 'Mark';
} | {
    kind: 'Char';
} | {
    kind: 'Reg';
}

export function key(s: number | string, i = 0): Pattern {
    let key = typeof s === 'number' ? s : s.charCodeAt(i);
    return {kind: 'Key', key };
}

export function range(s: string): Pattern {
    if (s.length < 2) {
        throw new Error();
    }
    return { kind: 'Range', from: s.charCodeAt(0), to: s.charCodeAt(1) };
}

export function digit(nonZero = false): Pattern {
    return {kind: 'Digit', nonZero};
}

export function concat(left: Pattern, right: Pattern): Pattern {
    return {kind: 'Cat', left, right};
}

export function concatList(patts: Pattern[]): Pattern {
    let len = patts.length;
    if (len < 1) {
        throw new Error('empty arg.');
    }
    else if (len === 1) {
        return patts[0];
    }
    return patts.reduce((prev, cur) => concat(prev, cur));
}

export function alternate(left: Pattern, right: Pattern): Pattern {
    return {kind: 'Alt', left, right};
}

export function alternateList(patts: Pattern[]): Pattern {
    let len = patts.length;
    if (len < 1) {
        throw new Error('empty arg.');
    }
    else if (len === 1) {
        return patts[0];
    }
    return patts.reduce((prev, cur) => alternate(prev, cur));
}

export function optional(child: Pattern): Pattern {
    return {kind: 'Opt', child};
}

export function routine(child: Pattern): Pattern {
    return {kind: 'Routine', child};
}

export function repeat(child: Pattern, atLeastOnce?: boolean): Pattern {
    return atLeastOnce ? {kind: 'Plus', child} : {kind: 'Star', child};
}

export function writeCommand(value: ICommand): Pattern {
    return {kind: 'WriteCommand', value};
}

export function writeMotion(value: IMotion): Pattern {
    return {kind: 'WriteMotion', value};
}

export function writeLinewise(value: boolean): Pattern {
    return {kind: 'WriteLinewise', value};
}

export function capture(child: Pattern, action: CapAction): Pattern {
    return {kind: 'Cap', child, action};
}

export namespace holders {
    export const motion: Pattern = { kind: 'MotionHolder' };
    export const TextObject: Pattern = { kind: 'TextObjectHolder' };
    export const OperatorMotion: Pattern = { kind: 'OperatorMotionHolder' };
}

export namespace common {
    export const integer: Pattern = concat(digit(true), repeat(digit()));

    function setCountValue(c: IMatchCapture, inputs: number[], idx: number) {
        let val = 0;
        for (let i = idx; i < inputs.length; i++) {
            val = val * 10 + (inputs[i] - '0'.charCodeAt(0));
        }
        c.count = val * (c.count || 1);
    }

    export const countPart: Pattern = (optional(capture(integer, setCountValue)));

    export const explicitCountPart: Pattern = capture(integer, setCountValue);

    export const linewisePart: Pattern = optional(
        alternate(
            concat(key('v'), writeLinewise(false)),
            concat(key('V'), writeLinewise(true))
        )
    );

    export const registerPart: Pattern = optional(concatList([countPart, key('"'), {kind: 'Reg'}]));
}
