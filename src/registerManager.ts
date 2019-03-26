class Item {
    constructor(public texts: string[], public linewise: boolean) {
    }

    repeatTextRespectively(count: number, forceLinewise = false) {
        if (this.linewise || forceLinewise) {
            return this.texts.map(x => {
                let n = count;
                let text = '';
                while (n > 0) {
                    text += x + (n === 1 ? '' : '\n');
                    n--;
                }
                return text;
            });
        }
        else {
            return this.texts.map(x => x.repeat(count));
        }
    }

    getJoinedText(count: number, forceLinewise = false): string {
        if (this.linewise || forceLinewise || this.texts.length > 1) {
            let x = this.texts.join('\n');
            let n = count;
            let text = '';
            while (n > 0) {
                text += x + (n === 1 ? '' : '\n');
                n--;
            }
            return text;
        }
        else {
            return this.texts[0].repeat(count);
        }
    }
}

class RegisterManager {
    private unnamed?: Item;
    private smallDelete?: Item;
    private numbered: Item[] = [];
    private named: Item[] = [];

    static readonly UNNAMED_ID = -1;
    static readonly BLACKHOLD_ID = -2;
    static readonly SMALLDELETE_ID = -3;

    constructor() {
    }

    convertToId(k: number): number | undefined {
        if (k === '"'.charCodeAt(0)) {
            return RegisterManager.UNNAMED_ID; // unnamed
        }
        else if (k === '_'.charCodeAt(0)) {
            return RegisterManager.BLACKHOLD_ID; // black hole
        }
        else if (k === '-'.charCodeAt(0)) {
            return RegisterManager.SMALLDELETE_ID; // small delete
        }
        else if (k >= '0'.charCodeAt(0) && k <= '9'.charCodeAt(0)) {
            return k - '0'.charCodeAt(0); // numbered
        }
        else if (k >= 'a'.charCodeAt(0) && k <= 'z'.charCodeAt(0)) {
            return (k - 'a'.charCodeAt(0)) + 10; // named
        }
        else if (k >= 'A'.charCodeAt(0) && k <= 'Z'.charCodeAt(0)) {
            return (k - 'A'.charCodeAt(0)) + 100; // named
        }
        else {
            return undefined;
        }
    }

    idToString(id?: number): string {
        if (id === RegisterManager.BLACKHOLD_ID) {
            return '_';
        }
        else if (id === undefined || id === RegisterManager.UNNAMED_ID) {
            return '"';
        }
        else if (id === RegisterManager.SMALLDELETE_ID) {
            return '-';
        }
        else if (id >= 0 && id <= 9) {
            return String.fromCharCode('0'.charCodeAt(0) + id);
        }
        else if (id >= 10 && id <= 35) {
            return String.fromCharCode('a'.charCodeAt(0) + (id - 10));
        }
        else if (id >= 100 && id <= 125) {
            return String.fromCharCode('A'.charCodeAt(0) + (id - 10));
        }
        else {
            throw new Error('Invalid id.');
        }
    }

    storeText(text: string | string[], linewise: boolean, id: number | 'yank' | 'delete') {
        if (id === RegisterManager.BLACKHOLD_ID) {
            return;
        }
        let item = new Item(typeof text === 'string' ? [text] : text, linewise);
        this.unnamed = item;
        if (id === 'yank' || id === RegisterManager.UNNAMED_ID) {
            this.numbered[0] = item;
        }
        else if (id === 'delete') {
            if (!item.linewise && item.texts.every(x => x.indexOf('\n') < 0)) {
                this.smallDelete = item;
            }
            else {
                for (let i = 9; i > 1; i--) {
                    this.numbered[i] = this.numbered[i - 1];
                }
                this.numbered[1] = item;
            }
        }
        else if (id >= 0 && id <= 9) {
            this.numbered[id] = item;
        }
        else if (id >= 10 && id <= 35) {
            this.named[id - 10] = item;
        }
        else if (id >= 100 && id <= 125) {
            let ori = this.named[id - 100];
            if (ori) {
                if (ori.linewise || item.linewise) {
                    item.linewise = true;
                    item.texts = [ori.texts.join('\n') + '\n' + item.texts.join('\n')];
                }
                else {
                    item.texts = [ori.texts.join('\n') + item.texts.join('\n')];
                }
            }
            this.named[id - 100] = item;
        }
        else {
            throw new Error('Invalid id.');
        }
    }

    getText(id?: number): Readonly<Item> | undefined {
        if (id === RegisterManager.BLACKHOLD_ID) {
            return undefined;
        }
        else if (id === undefined || id === RegisterManager.UNNAMED_ID) {
            return this.unnamed;
        }
        else if (id === RegisterManager.SMALLDELETE_ID) {
            return this.smallDelete;
        }
        else if (id >= 0 && id <= 9) {
            return this.numbered[id];
        }
        else if (id >= 10 && id <= 35) {
            return this.named[id - 10];
        }
        else if (id >= 100 && id <= 125) {
            return this.named[id - 10];
        }
        else {
            throw new Error('Invalid id.');
        }
    }
}

export const registerManager = new RegisterManager();
