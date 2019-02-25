import * as monaco from "monaco-editor";
import * as moeVim from "../src"

//#region long strings
const ct1 = `function Greeter(greeting) {
    this.greeting = greeting;
}

Greeter.prototype.greet = function() {
    return "Hello, " + this.greeting;
}

// Oops, we're passing an object when we want a string. This will print "Hello, [object Object]" instead of "Hello, world" without error.
let greeter = new Greeter({message: "world"});

let button = document.createElement('button');
button.textContent = "Say Hello";
button.onclick = function() {
    alert(greeter.greet());
};

document.body.appendChild(button);`;

const ct2 = `class Greeter {
    greeting: string;
    constructor(message: string) {
        this.greeting = message;
    }
    greet() {
        return "Hello, " + this.greeting;
    }
}

let greeter = new Greeter("world");

let button = document.createElement('button');
button.textContent = "Say Hello";
button.onclick = function() {
    alert(greeter.greet());
}

document.body.appendChild(button);`;

const ct3 = `class Animal {
    constructor(public name: string) { }
    move(distanceInMeters: number = 0) {
        console.log(\`\${this.name} moved \${distanceInMeters}m.\`);
    }
}

class Snake extends Animal {
    constructor(name: string) { super(name); }
    move(distanceInMeters = 5) {
        console.log("Slithering...");
        super.move(distanceInMeters);
    }
}

class Horse extends Animal {
    constructor(name: string) { super(name); }
    move(distanceInMeters = 45) {
        console.log("Galloping...");
        super.move(distanceInMeters);
    }
}

let sam = new Snake("Sammy the Python");
let tom: Animal = new Horse("Tommy the Palomino");

sam.move();
tom.move(34);`;

const audioData = "data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=";
//#endregion

const beep = (function() {
    let playAudio: undefined | (() => void) = undefined;

    function init() {
        const audio = new Audio(audioData);
        return () => {
            audio.play();
        }
    }

    return () => {
        if (playAudio === undefined) {
            playAudio = init();
        }
        playAudio();
    }
})();

class App implements moeVim.IEventSink {
    onKeyBufferChanged(s, keys: string) {
        this.text = keys;
    }
    // onKeyWaiting(s, keys: string) {
    //     console.log('Waiting: ' + keys);
    // }
    onKeyMatched(s, keys: string) {
        console.log('Matched: ' + keys);
    }
    onKeyFailed(s, keys: string) {
        console.log('Failed: ' + keys);
        beep();
    }
    onKeyCanceled(s, keys: string) {
        console.log('Canceled: ' + keys);
    }
    onCommandBeep() {
        beep();
    }
    onCommandOuput(s, type: 'info' | 'error', message: string) {
        if (type=== 'info') {
            console.log('info: ' + message);
            this.text = message;
        }
        else {
            console.error('error: ' + message);
            this.text = 'ERROR: ' + message;
        }
    }
    onModeChanged(sender: moeVim.IDispatcher, mode, displayName: string) {
        if (sender.editor === this.activeEditor) {
            this.mode = displayName;
        }
    }

    didMountEditor(editor: monaco.editor.IStandaloneCodeEditor) {
        moeVim.init(editor, this);
        editor.addAction({
            id: 'vim.toggle',
            label: 'Toggle Vim Mode',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F10],
            run: () => {
                this.enabled = !this.enabled;
            }
        });
    }

    didChangeActiveEditor(editor: monaco.editor.IStandaloneCodeEditor) {
        if (this.enabled) {
            let instance = moeVim.get(editor)
            if (!instance) {
                throw new Error('something goes wrong.')
            }
            this.mode = instance.getModeDisplayName();
            this.text = '';
        }
    }

    config() {
        // map to editor action
        moeVim.configuration.nmap.addEditorAction(',xm', 'editor.action.showContextMenu');

        // map to custom action
        moeVim.configuration.nmap.addUserAction(',p', () => this.prevTab());
        moeVim.configuration.nmap.addUserAction(',n', () => this.nextTab());

        // key to key mapping
        moeVim.configuration.nmap.addString(',f', '=iB')
    }

    private _activeTabIndex = -1;
    get activeTabIndex() { return this._activeTabIndex; }
    set activeTabIndex(value: number) {
        if (this._activeTabIndex !== value) {
            this._activeTabIndex = value;
            this.didChangeActiveEditor(this.activeEditor)
            this.render();
        }
    }

    private _mode = '';
    get mode() { return this._mode; }
    set mode(value: string) {
        if (this._mode !== value) {
            this._mode = value;
            this.render();
        }
    }

    private _text = '';
    get text() { return this._text; }
    set text(value: string) {
        if (this._text !== value) {
            this._text = value;
            this.render();
        }
    }

    private _enabled = true;
    get enabled() { return this._enabled; }
    set enabled(value: boolean) {
        if (this._enabled !== value) {
            this.toggle();
        }
    }

    toggle() {
        this._enabled = !this._enabled;
        if (this._enabled) {
            this.editors.forEach(x => moeVim.init(x, this));
            let instance = moeVim.get(this.activeEditor)
            if (!instance) {
                throw new Error('something goes wrong.')
            }
            this.mode = instance.getModeDisplayName();
            this.text = '';
        }
        else {
            this.mode = '';
            this.text = '';
            moeVim.disposeAll();
        }
        this.render();
    }

    private _tid: number | null = null;

    private render() {
        if (this._tid) {
            clearTimeout(this._tid);
        }
        this._tid = setTimeout(() => {
            document.getElementById('mode')!.innerText = this.mode === '' ? '' : '-- ' + this.mode.toUpperCase() + ' --';
            let elText = document.getElementById('text')!;
            elText.innerText = this.text;
            elText.classList.toggle('error', this.text.startsWith('ERROR'));
            const elCheckbox = document.getElementById('enable') as HTMLInputElement;
            elCheckbox.checked = this.enabled;
            this._tid = null;
        }, 0);
    }

    private activate(n: number) {
        const max = this.editors.length - 1;
        if (n < 0 || n > max || n === this.activeTabIndex) {
            return;
        }
        this.activeTabIndex = n;
        document.querySelectorAll('#tabs>div').forEach((el, idx) => {
            el.classList.toggle('active', idx === this.activeTabIndex);
        });
        document.querySelectorAll('#editors>div').forEach((el, idx) => {
            el.classList.toggle('active', idx === this.activeTabIndex);
        });
        let editor = this.editors[this.activeTabIndex];
        editor.focus();
    }

    prevTab() {
        const max = this.editors.length - 1;
        this.activate(this.activeTabIndex === 0 ? max : this.activeTabIndex - 1);
    }

    nextTab() {
        const max = this.editors.length - 1;
        this.activate(this.activeTabIndex === max ? 0 : this.activeTabIndex + 1);
    }

    private bindDomEvents() {
        document.querySelectorAll('#tabs>div').forEach((el, idx) => {
            el.addEventListener('click', () => this.activate(idx));
        });
        const el = document.getElementById('enable') as HTMLInputElement;
        el.addEventListener('change', () => {
            if (this.enabled !== el.checked) {
                this.enabled = el.checked;
                this.activeEditor.focus();
            }
        })
    }

    editors: monaco.editor.IStandaloneCodeEditor[] = [];

    get activeEditor() {
        return this.editors[this.activeTabIndex];
    }

    createEditor(id: string, value: string, language: string) {
        const editor = monaco.editor.create(document.getElementById(id)!, {
            value,
            language,
            minimap: { enabled: false },
            wordWrap: 'on',
        });
        window.addEventListener('resize', () => {
            editor.layout();
        });
        this.didMountEditor(editor);
        return editor;
    }

    private _running = false;

    run() {
        if (this._running) {
            return;
        }
        this._running = true;

        this.config();

        this.editors = [
            ['editor-1', ct1, 'javascript'],
            ['editor-2', ct2, 'typescript'],
            ['editor-3', ct3, 'typescript'],
        ].map(x => this.createEditor(x[0], x[1], x[2]));

        this.bindDomEvents();
        this.activate(0);
    }
}

new App().run();
