import * as P from "../matching/pattern";
import * as keyUtils from "../utils/key";
import { IMotion, MotionFunction, CommandFunction, ICommand } from "./base";
import { Program } from "../matching/program";
import { Dispatcher } from "../Dispatcher";

type PattArg = string | P.Pattern | (string | P.Pattern)[];

function s2p(s: string): P.Pattern {
    return P.alternateList(s.split(', ').map(x => keyUtils.parseToPattern(x)));
}

function normalizePatt(patt: PattArg): P.Pattern {
    if (typeof patt === 'string') {
        return s2p(patt);
    }
    else if (Array.isArray(patt)) {
        return P.concatList(patt.map(x => typeof x === 'string' ? s2p(x) : x));
    }
    else {
        return patt;
    }
}

interface MotionRegistry {
    optionalCount: P.Pattern[];
    noCount: P.Pattern[];
    requiredCount: P.Pattern[];
};
let motionRegistry: MotionRegistry | null = {
    optionalCount: [],
    noCount: [],
    requiredCount: [],
};

export function registerMotion(patt: PattArg, motion: IMotion | MotionFunction, countPart: 'optional' | 'no' | 'required' = 'optional') {
    if (!motionRegistry) {
        throw new Error();
    }
    let p = normalizePatt(patt);
    let value = typeof motion === 'function' ? { run: motion } : motion;
    let m: P.Pattern = { kind: 'WriteMotion', value };
    let list = countPart === 'optional' ? motionRegistry.optionalCount : (countPart === 'no' ? motionRegistry.noCount : motionRegistry.requiredCount);
    list.push(P.concat(p, m));
}

function buildMotionPattern() {
    if (!motionRegistry) {
        throw new Error();
    }
    let p1 = P.concat(P.common.countPart, P.alternateList(motionRegistry.optionalCount));
    let p2 = P.concat(P.common.explicitCountPart, P.alternateList(motionRegistry.requiredCount));
    let p3 = P.alternateList(motionRegistry.noCount);
    return P.alternateList([p1, p2, p3]);
}

let textObjectRegistry: P.Pattern[] | null = [];

export function registerTextObject(patt: PattArg, motion: IMotion | MotionFunction) {
    if (!textObjectRegistry) {
        throw new Error();
    }
    let p = normalizePatt(patt);
    let value = typeof motion === 'function' ? { run: motion } : motion;
    let m: P.Pattern = { kind: 'WriteMotion', value };
    textObjectRegistry.push(P.concat(p, m));
}

let commandRegistry: [number, P.Pattern][] | null = [];

const enum Mode {
    WithoutCount = 1,
    Normal = 1 << 1,
    Visual = 1 << 2,
    VisualLine = 1 << 3,
}

export function registerCommand(patt: PattArg, modes: string, command: ICommand | CommandFunction) {
    if (!commandRegistry) {
        return;
    }
    let value = typeof command === 'function' ? { run: command } : command;
    let p = normalizePatt(patt);
    let m: P.Pattern = { kind: 'WriteCommand', value };
    let modeFlags = 0;
    if (modes.indexOf('~') >= 0) {
        modeFlags |= Mode.WithoutCount;
    }
    if (modes.indexOf('n') >= 0) {
        modeFlags |= Mode.Normal;
    }
    if (modes.indexOf('v') >= 0) {
        modeFlags |= Mode.Visual | Mode.VisualLine;
    }
    if (modes.indexOf('V') >= 0) {
        modeFlags |= Mode.Visual;
    }
    if (modes.indexOf('L') >= 0) {
        modeFlags |= Mode.VisualLine;
    }
    if (modeFlags <= 0) {
        throw new Error();
    }
    commandRegistry.push([modeFlags, P.concat(p, m)]);
}

interface ComposedPrograms {
    readonly forNormal: Program;
    readonly forVisual: Program;
    readonly forVisualLine: Program;
}

let _programs = null as ComposedPrograms | null;

export function getComposedPrograms(): ComposedPrograms {
    if (_programs) {
        return _programs;
    }

    if (!textObjectRegistry || !commandRegistry) {
        throw new Error();
    }

    let pMotion = P.routine(buildMotionPattern());
    let pTextObject = P.routine(P.alternateList(textObjectRegistry));
    let pOpMotion = P.routine(P.concat(P.common.linewisePart, P.alternate(pMotion, P.concat(P.common.countPart, pTextObject))));

    let normalList: P.Pattern[] = [];
    let normalWithoutCountList: P.Pattern[] = [];
    let visualList: P.Pattern[] = [];
    let visualWithoutCountList: P.Pattern[] = [];
    let visualLineList: P.Pattern[] = [];
    let visualLineWithoutCountList: P.Pattern[] = [];
    for (const tup of commandRegistry) {
        let [modes, pattern] = tup;
        pattern = fillHolders(pattern, pMotion, pTextObject, pOpMotion);
        let withoutCount = (modes & Mode.WithoutCount) != 0;
        if ((modes & Mode.Normal) != 0) {
            if (withoutCount) {
                normalWithoutCountList.push(pattern);
            }
            else {
                normalList.push(pattern);
            }
        }
        if ((modes & Mode.Visual) !== 0) {
            if (withoutCount) {
                visualWithoutCountList.push(pattern);
            }
            else {
                visualList.push(pattern);
            }
        }
        if ((modes & Mode.VisualLine) !== 0) {
            if (withoutCount) {
                visualLineWithoutCountList.push(pattern);
            }
            else {
                visualLineList.push(pattern);
            }
        }
    }
    let patt = P.alternate(
        P.alternateList(normalWithoutCountList),
        P.concat(P.common.countPart, P.alternateList(normalList)),
    );
    let forNormal = new Program(P.concat(P.common.registerPart, patt));
    patt = P.alternate(
        P.alternateList(visualWithoutCountList),
        P.concat(P.common.countPart, P.alternateList(visualList)),
    );
    let forVisual = new Program(P.concat(P.common.registerPart, patt));
    patt = P.alternate(
        P.alternateList(visualLineWithoutCountList),
        P.concat(P.common.countPart, P.alternateList(visualLineList)),
    );
    let forVisualLine = new Program(P.concat(P.common.registerPart, patt));

    motionRegistry = null;
    textObjectRegistry = null;
    commandRegistry = null;

    return _programs = { forNormal, forVisual, forVisualLine };
}

function fillHolders(pattern: P.Pattern, m: P.Pattern, t: P.Pattern, op: P.Pattern): P.Pattern {
    if (pattern.kind === 'MotionHolder') {
        return m;
    }
    else if (pattern.kind === 'TextObjectHolder') {
        return t;
    }
    else if (pattern.kind === 'OperatorMotionHolder') {
        return op;
    }
    else if (pattern['child']) {
        pattern['child'] = fillHolders(pattern['child'], m, t, op);
    }
    else {
        if (pattern['left'] && pattern['right']) {
            pattern['left'] = fillHolders(pattern['left'], m, t, op);
            pattern['right'] = fillHolders(pattern['right'], m, t, op);
        }
    }
    return pattern;
}

type ContextDataFactory = (d: Dispatcher) => { dispose(): void };

const contextDataFactoryRegistry: {[k: string]: ContextDataFactory} = {};

export function registerContextDataFactory(id: string, f: ContextDataFactory) {
    if (contextDataFactoryRegistry[id]) {
        throw new Error();
    }
    contextDataFactoryRegistry[id] = f;
}

export function getContextDataFactory(id: string): ContextDataFactory | undefined {
    return contextDataFactoryRegistry[id];
}
