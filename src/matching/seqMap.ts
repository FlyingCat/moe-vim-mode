export interface SeqMap<K, V> extends Map<K, V | SeqMap<K, V>> { }

export function addSeqMapItem<K, V>(root: SeqMap<K, V>, seq: K[], val: V) {
    let node = root;
    if (seq.length === 0) {
        return;
    }
    for (let i = 0; i < seq.length - 1; i++) {
        let c = seq[i];
        let n = node.get(c);
        if (!n) {
            n = new Map<K, V | SeqMap<K, V>>();
            node.set(c, n);
        }
        else if (!(n instanceof Map)) {
            throw new Error('conflict: should be container node.')
        }
        node = n;
    }
    let c = seq[seq.length - 1];
    if (node.has(c)) {
        throw new Error('conflict: key already exists.')
    }
    node.set(c, val);
}

export function createSeqMap<K, V>(list: {seq: K[], val: V}[]): SeqMap<K, V> {
    let root = new Map<K, V | SeqMap<K, V>>()
    for (const item of list) {
        addSeqMapItem(root, item.seq, item.val);
    }
    return root;
}

export function searchSeqMap<K, V>(map: SeqMap<K, V>, seq: K[]): V | SeqMap<K, V> | undefined {
    let node = map;
    for (let i = 0; i < seq.length; i++) {
        let n = node.get(seq[i]);
        if (n === undefined) {
            return undefined;
        }
        else if (n instanceof Map) {
            node = n;
        }
        else {
            return i === seq.length - 1 ? n : undefined;
        }
    }
    return node;
}
