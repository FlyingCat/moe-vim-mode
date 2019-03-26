export function convertToMarkId(k: number): string | null {
    if (k < 128) {
        let s = String.fromCharCode(k);
        if (s === '`' || s === "'") {
            return 'LAST';
        }
        else if (s === '<' || s === '>' || (k >= 'a'.charCodeAt(0) && k <= 'z'.charCodeAt(0))) {
            return s;
        }
    }
    return null;
}
