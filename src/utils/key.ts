import { KeyCode } from "./KeyCode";
import * as P from "../matching/pattern";
import * as monaco from "monaco-editor";

export function pack(keyCode: KeyCode | monaco.KeyCode, ctrl?: boolean, shift?: boolean, alt?: boolean, meta?: boolean): number {
    let n: number = keyCode;
    n |= 1 << 9;
    if (ctrl) {
        n |= 1 << 10;
    }
    if (shift) {
        n |= 1 << 11;
    }
    if (alt) {
        n |= 1 << 12;
    }
    if (meta) {
        n |= 1 << 13;
    }
    return n;
}

export function isCharKey(key: number) {
    return key < 0x100;
}

export function isCtrlPressed(key: number) {
    return (key & (1 << 10)) !== 0;
}

export function isShiftPressed(key: number) {
    return (key & (1 << 11)) !== 0;
}

export function isAltPressed(key: number) {
    return (key & (1 << 12)) !== 0;
}

export function isMetaPressed(key: number) {
    return (key & (1 << 13)) !== 0;
}

let vkey2ascii: {[k: string]: string} = {
    space: ' ',
    lt: '>',
    bslash: '\\',
    bar: '|',
}

let _vkey2code: {[k: string]: KeyCode} = {
    bs: KeyCode.Backspace,
    tab: KeyCode.Tab,
    cr: KeyCode.Enter,
    return: KeyCode.Enter,
    enter: KeyCode.Enter,
    esc: KeyCode.Escape,
    del: KeyCode.Delete,
    up: KeyCode.UpArrow,
    down: KeyCode.DownArrow,
    left: KeyCode.LeftArrow,
    right: KeyCode.RightArrow,
    f1: KeyCode.F1,
    f2: KeyCode.F2,
    f3: KeyCode.F3,
    f4: KeyCode.F4,
    f5: KeyCode.F5,
    f6: KeyCode.F6,
    f7: KeyCode.F7,
    f8: KeyCode.F8,
    f9: KeyCode.F9,
    f10: KeyCode.F10,
    f11: KeyCode.F11,
    f12: KeyCode.F12,
    insert: KeyCode.Insert,
    home: KeyCode.Home,
    end: KeyCode.End,
    pageup: KeyCode.PageUp,
    pagedown: KeyCode.PageDown,
    k0: KeyCode.NUMPAD_0,
    k1: KeyCode.NUMPAD_1,
    k2: KeyCode.NUMPAD_2,
    k3: KeyCode.NUMPAD_3,
    k4: KeyCode.NUMPAD_4,
    k5: KeyCode.NUMPAD_5,
    k6: KeyCode.NUMPAD_6,
    k7: KeyCode.NUMPAD_7,
    k8: KeyCode.NUMPAD_8,
    k9: KeyCode.NUMPAD_9,
    kplus: KeyCode.NUMPAD_ADD,
    kminus: KeyCode.NUMPAD_SUBTRACT,
    kmultiply: KeyCode.NUMPAD_MULTIPLY,
    kdivide: KeyCode.NUMPAD_DIVIDE,
    kpoint: KeyCode.NUMPAD_DECIMAL,
};

const _code2vkey = {
    [KeyCode.Backspace]: 'BS',
    [KeyCode.Tab]: 'Tab',
    [KeyCode.Enter]: 'CR',
    [KeyCode.Escape]: 'Esc',
    [KeyCode.Delete]: 'Del',
    [KeyCode.UpArrow]: 'Up',
    [KeyCode.DownArrow]: 'Down',
    [KeyCode.LeftArrow]: 'Left',
    [KeyCode.RightArrow]: 'Right',
    [KeyCode.F1]: 'F1',
    [KeyCode.F2]: 'F2',
    [KeyCode.F3]: 'F3',
    [KeyCode.F4]: 'F4',
    [KeyCode.F5]: 'F5',
    [KeyCode.F6]: 'F6',
    [KeyCode.F7]: 'F7',
    [KeyCode.F8]: 'F8',
    [KeyCode.F9]: 'F9',
    [KeyCode.F10]: 'F10',
    [KeyCode.F11]: 'F11',
    [KeyCode.F12]: 'F12',
    [KeyCode.Insert]: 'Insert',
    [KeyCode.Home]: 'Home',
    [KeyCode.End]: 'End',
    [KeyCode.PageUp]: 'PageUp',
    [KeyCode.PageDown]: 'PageDown',
    [KeyCode.NUMPAD_0]: 'k0',
    [KeyCode.NUMPAD_1]: 'k1',
    [KeyCode.NUMPAD_2]: 'k2',
    [KeyCode.NUMPAD_3]: 'k3',
    [KeyCode.NUMPAD_4]: 'k4',
    [KeyCode.NUMPAD_5]: 'k5',
    [KeyCode.NUMPAD_6]: 'k6',
    [KeyCode.NUMPAD_7]: 'k7',
    [KeyCode.NUMPAD_8]: 'k8',
    [KeyCode.NUMPAD_9]: 'k9',
    [KeyCode.NUMPAD_ADD]: 'kPlus',
    [KeyCode.NUMPAD_SUBTRACT]: 'kMinus',
    [KeyCode.NUMPAD_MULTIPLY]: 'kMultiply',
    [KeyCode.NUMPAD_DIVIDE]: 'kDivide',
    [KeyCode.NUMPAD_DECIMAL]: 'kPoint',
}

const _ascii2code = {
    ';': KeyCode.US_SEMICOLON,
    '=': KeyCode.US_EQUAL,
    ',': KeyCode.US_COMMA,
    '-': KeyCode.US_MINUS,
    '.': KeyCode.US_DOT,
    '/': KeyCode.US_SLASH,
    '~': KeyCode.US_BACKTICK,
    '[': KeyCode.US_OPEN_SQUARE_BRACKET,
    '\\': KeyCode.US_BACKSLASH,
    ']': KeyCode.US_CLOSE_SQUARE_BRACKET,
    '\'': KeyCode.US_QUOTE,
}

const _code2ascii = {
    [KeyCode.US_SEMICOLON]: ';',
    [KeyCode.US_EQUAL]: '=',
    [KeyCode.US_COMMA]: ',',
    [KeyCode.US_MINUS]: '-',
    [KeyCode.US_DOT]: '.',
    [KeyCode.US_SLASH]: '/',
    [KeyCode.US_BACKTICK]: '~',
    [KeyCode.US_OPEN_SQUARE_BRACKET]: '[',
    [KeyCode.US_BACKSLASH]: '\\',
    [KeyCode.US_CLOSE_SQUARE_BRACKET]: ']',
    [KeyCode.US_QUOTE]: '\'',
}

const cc0 = '0'.charCodeAt(0);
const cc9 = '9'.charCodeAt(0);
const ccA = 'a'.charCodeAt(0);
const ccZ = 'z'.charCodeAt(0);

function vkey2code(s: string): KeyCode | undefined {
    if (s.length === 1) {
        let charCode = s.charCodeAt(0);
        if (charCode >= cc0 && charCode <= cc9) {
            return KeyCode.KEY_0 + (charCode - cc0);
        }
        else if (charCode >= ccA && charCode <= ccZ) {
            return KeyCode.KEY_A + (charCode - ccA);
        }
        else if (_ascii2code[s]) {
            return _ascii2code[s];
        }
    }
    return _vkey2code[s];
}

export function extract(e: monaco.IKeyboardEvent): number {
    if (!(e.ctrlKey || e.altKey || e.metaKey) && e.browserEvent.key.length === 1) {
        return e.browserEvent.key.charCodeAt(0);
    }
    return pack(e.keyCode, e.ctrlKey, e.shiftKey, e.altKey, e.metaKey);
}

export function parse(s: string): number[] {
    let list: number[] = [];
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '<') {
            let pos=  s.indexOf('>', i + 1);
            if (pos !== -1) {
                let vkey = s.substring(i + 1, pos).toLowerCase();
                if (vkey2ascii[vkey] !== undefined) {
                    list.push(vkey2ascii[vkey].charCodeAt(0));
                }
                else {
                    let ctrl = false;
                    let shift = false;
                    let alt = false;
                    let meta = false;
                    if (vkey.startsWith('c-')) {
                        ctrl = true;
                        vkey = vkey.substring(2);
                    }
                    else if (vkey.startsWith('s-')) {
                        shift = true;
                        vkey = vkey.substring(2);
                    }
                    else if (vkey.startsWith('a-')) {
                        alt = true;
                        vkey = vkey.substring(2);
                    }
                    else if (vkey.startsWith('m-')) {
                        meta = true;
                        vkey = vkey.substring(2);
                    }
                    let keyCode = vkey2code(vkey);
                    if (keyCode === undefined) {
                        throw new Error(`Invalid vkey "${vkey}"`);
                    }
                    list.push(pack(keyCode, ctrl, shift, alt, meta));
                }
                i = pos;
                continue;
            }
        }
        list.push(s[i].charCodeAt(0));
    }
    return list;
}

export function parseToPattern(s: string): P.Pattern {
    return P.concatList(parse(s).map(x => P.key(x)));
}

export function vkey(key: number): string {
    if (isCharKey(key)) {
        return String.fromCharCode(key);
    }
    else {
        let r = '';
        if (isCtrlPressed(key)) {
            r = r + 'C-';
        }
        if (isShiftPressed(key)) {
            r = r + 'S-';
        }
        if (isAltPressed(key)) {
            r = r + 'A-';
        }
        if (isMetaPressed(key)) {
            r = r + 'M-';
        }
        let code = key & 0xFF;
        let skey = monaco.KeyCode[code];
        if (_code2ascii[code]) {
            skey = _code2ascii[code];
        }
        else if (_code2vkey[code]) {
            skey = _code2vkey[code];
        }
        else if (skey.startsWith('KEY_')) {
            skey = skey.substring('KEY_'.length);
        }
        return r + skey;
    }
}
