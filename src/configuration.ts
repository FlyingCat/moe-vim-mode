import { ModeName, IConfiguration, IMapper } from "./types";
import { SeqMap, createSeqMap, addSeqMapItem, searchSeqMap } from "./matching/seqMap";
import { parse } from "./utils/key";
import * as monaco from "monaco-editor";

type Action = (editor: monaco.editor.ICodeEditor) => void | PromiseLike<void>;

export class Mapper implements IMapper {
    private seqMap = createSeqMap<number, number[] | Action>([]);

    add(from: number[], to: number[]) {
        try {
            addSeqMapItem(this.seqMap, from, to);
        }
        catch {}
    }

    addString(from: string, to: string) {
        try {
            this.add(parse(from), parse(to));
        }
        catch {}
    }

    addUserAction(keys: string, action: Action) {
        try {
            addSeqMapItem(this.seqMap, parse(keys), action);
        }
        catch {}
    }

    addEditorAction(keys: string, actionId: string) {
        try {
            const action: Action = editor => {
                let action = editor.getAction(actionId);
                if (action) {
                    return action.run();
                }
            };
            addSeqMapItem(this.seqMap, parse(keys), action);
        }
        catch {}
    }

    clear() {
        this.seqMap.clear();
    }

    getRemapping(key: number): Remapping {
        return new Remapping(key, this.seqMap.get(key));
    }
}

type RemappingStatus = {
    kind: 'Waiting';
    value: SeqMap<number, number[] | Action>;
} | {
    kind: 'End';
    value: number[];
} | {
    kind: 'UserAction';
    value: Action;
} | {
    kind: 'Failed';
};

export class Remapping {
    private _status: RemappingStatus;
    private _keys: number[];

    constructor(key: number, value: SeqMap<number, number[] | Action> | number[] | Action | undefined) {
        this._keys = [key];
        this._status = this.statusFromSearch(value);
    }

    private statusFromSearch(value: SeqMap<number, number[] | Action> | number[] | Action | undefined): RemappingStatus {
        if (value === undefined) {
            return { kind: 'Failed' };
        }
        else if (typeof value === 'function') {
            return { kind: 'UserAction', value };
        }
        else if (Array.isArray(value)) {
            return { kind: 'End', value };
        }
        else {
            return { kind: 'Waiting', value };
        }
    }

    get status() {
        return this._status.kind;
    }

    get value() {
        if (this._status.kind === 'End') {
            return this._status.value;
        }
        else {
            throw new Error();
        }
    }

    get userAction() {
        if (this._status.kind === 'UserAction') {
            return this._status.value;
        }
        else {
            throw new Error();
        }
    }

    get originalKeys() {
        return this._keys;
    }

    next(key: number) {
        if (this._status.kind !== 'Waiting') {
            throw new Error();
        }
        this._keys.push(key);
        this._status = this.statusFromSearch(this._status.value.get(key));
    }
}

class Configuration implements IConfiguration {
    // highlightSearch = false;
    // inclusiveSelect = true;
    startInInsertMode = false;
    enterInsertModeIfSelectOutsideVim = false;
    ignoreCase = false;
    smartCase = true;
    nmap = new Mapper();
    vmap = new Mapper();
}

export const configuration = new Configuration();
