import { SeqMap } from "./seqMap";
import { MotionFunction } from "../motions";
import { ICommand } from "../command";

export interface IMatchCapture {
    command?: ICommand;
    count?: number;
    motion?: MotionFunction;
    register?: number;
    linewise?: boolean;
    char?: string;
}

interface Key {
    kind: 'Key';
    key: number;
}

interface Digit {
    kind: 'Digit';
    nonZero?: boolean;
}

interface Char {
    kind: 'Char';
}

interface Reg {
    kind: 'Reg';
}

interface Cat {
    kind: 'Cat';
    left: Pattern;
    right: Pattern;
}

interface Alt {
    kind: 'Alt';
    left: Pattern;
    right: Pattern;
}

interface Opt {
    kind: 'Opt';
    child: Pattern;
}

interface Plus {
    kind: 'Plus';
    child: Pattern;
}

interface Star {
    kind: 'Star';
    child: Pattern;
}

export type SeqAction = (c: IMatchCapture, v: any) => void | boolean;

interface Seq {
    kind: 'Seq';
    target: SeqMap<number, any>;
    action: SeqAction;
}

interface Set {
    kind: 'Set';
    target: { which: 'command', value: ICommand } | { which: 'motion', value: MotionFunction } | { which: 'linewise', value: boolean };
}

export type CapAction = (c: IMatchCapture, inputs: number[], index: number) => void;

interface Cap {
    kind: 'Cap';
    child: Pattern;
    action: CapAction;
}

export type Pattern = Key | Digit | Char | Reg | Cat | Alt | Opt | Plus | Star | Seq | Set | Cap;

export function key(s: number | string, i = 0): Pattern {
    let key = typeof s === 'number' ? s : s.charCodeAt(i);
    return {kind: 'Key', key };
}

export function keyList(s: number[]): Pattern {
    return concatList(s.map(x => key(x)));
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

export function repeat(child: Pattern, atLeastOnce?: boolean): Pattern {
    return atLeastOnce ? {kind: 'Plus', child} : {kind: 'Star', child};
}

export function seq(target: SeqMap<number, any>, action: SeqAction): Pattern {
    return {kind: 'Seq', target, action};
}

export function setCommand(value: ICommand): Pattern {
    return {kind: 'Set', target: {which: 'command', value}};
}

export function setMotion(value: MotionFunction): Pattern {
    return {kind: 'Set', target: {which: 'motion', value}};
}

export function setLinewise(value: boolean): Pattern {
    return {kind: 'Set', target: {which: 'linewise', value}};
}

export function capture(child: Pattern, action: CapAction): Pattern {
    return {kind: 'Cap', child, action};
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

    export const countPart: Pattern = optional(capture(integer, setCountValue));

    export const explicitCountPart: Pattern = capture(integer, setCountValue);

    export const linewisePart: Pattern = optional(
        alternate(
            concat(key('v'), setLinewise(false)),
            concat(key('V'), setLinewise(true))
        )
    );

    export const registerPart: Pattern = optional(concatList([countPart, key('"'), {kind: 'Reg'}]));
}
