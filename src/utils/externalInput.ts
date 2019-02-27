import * as monaco from "monaco-editor";

type Events = {
    onChange(s: string): void;
    onSubmit(s: string): void;
    onCancel(): void;
}

export class ExternalInputWidget implements monaco.editor.IOverlayWidget {
    private position = { preference: monaco.editor.OverlayWidgetPositionPreference.TOP_CENTER }

    private domNode?: HTMLElement

    constructor(readonly editor: monaco.editor.ICodeEditor, readonly prefix: string, readonly events: Events) {
        editor.addOverlayWidget(this);
    }

    dispose() {
        setTimeout(() => {
            this.editor.removeOverlayWidget(this);
            this.editor.focus();
        }, 0);
    }

    getId(): string {
        return 'vim_external_input_widget'
    }

    getDomNode(): HTMLElement {
        return this.buildDomNode();
    }

    getPosition() {
        return this.position;
    }

    buildDomNode() {
        if (!this.domNode) {
            let node = document.createElement('div');
            node.style.width = '500px';
            node.style.marginRight = '-250px';
            this.domNode = node;
            node.innerHTML = `
            <div class="monaco-inputbox">
                <div class="wrapper" style="position:relative;padding:6px;background:#fff;box-shadow:0 2px 13px rgba(0,0,0,.3);;">
                    <span style="position:absolute;line-height:20px;margin-top:-10px;left:6px;top:50%;font-size:13px;width:13px;text-align:right;color:#282828">${this.prefix}</span>
                    <input class="input" style="padding-left:15px;background:#fff;color:#282828;border:0 none;"/>
                </div>
            </div>
            `;
            let input = node.querySelector('input')!;
            input.addEventListener('keydown', e => {
                if (e.key === 'Escape' || (e.key === 'Backspace' && input.value === '')) {
                    this.events.onCancel();
                    this.dispose();
                }
                else if (e.key === 'Enter') {
                    this.events.onSubmit(input.value);
                    this.dispose();
                }
            })
            input.addEventListener('input', e => {
                this.events.onChange(input.value);
            });
            input.addEventListener('blur', e => {
                this.events.onCancel()
                this.dispose();
            });
            setTimeout(() => {
                input.focus();
            }, 0);
       }
        return this.domNode;
    }
}
