class Item {
    constructor(public text: string, public linewise: boolean) {
    }

    repeatText(count: number) {
        if (!this.linewise) {
            return this.text.repeat(count);
        }
        let text = '';
        while (count > 0) {
            text += this.text + (count === 1 ? '' : '\n');
            count--;
        }
        return text;
    }
}

class RegisterManager {
    private unnamed?: Item;
    private numbered: Item[] = [];
    private named: Item[] = [];

    static readonly UNNAMED_ID = -1;
    static readonly BLACKHOLD_ID = -2;

    constructor() {
    }

    convertToId(k: number): number | undefined {
        if (k === '"'.charCodeAt(0)) {
            return RegisterManager.UNNAMED_ID; // unnamed
        }
        else if (k === '_'.charCodeAt(0)) {
            return RegisterManager.BLACKHOLD_ID; // black hole
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

    storeText(text: string, linewise: boolean, id: number | 'yank' | 'delete') {
        if (id === RegisterManager.BLACKHOLD_ID) {
            return;
        }
        let item = new Item(text, linewise);
        this.unnamed = item;
        if (id === 'yank' || id === RegisterManager.UNNAMED_ID) {
            this.numbered[0] = item;
        }
        else if (id === 'delete') {
            for (let i = 9; i > 1; i--) {
                this.numbered[i] = this.numbered[i - 1];
            }
            this.numbered[1] = item;
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
                    item.text = ori.text + '\n' + item.text;
                }
                else {
                    item.text = ori.text + item.text;
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
