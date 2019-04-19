# moe-vim-mode

Vim-like modal editing for the Monaco Editor.

[Demo page](https://flyingcat.github.io/moe-vim-mode/)

## Features

- Normal, Visual and Visual Line modes
- Vim style key bindings
- Multi-cursor

For list of supported commands, see [status.md](status.md).

## Limitations

- Only exclusive Visual mode
- Insert mode behaves identical to regular editor
- Preliminary ex-commands and poor key remapping implementation

### Not supported

- Visual Block mode
- Replace Mode
- Macros

## Usage

### Module bundler

``` bash
npm install moe-vim-mode --save
```

``` javascript
import * as monaco from 'monaco-editor';
import * as moeVim from 'moe-vim-mode';

let container = document.getElementById('container');
let editor = monaco.editor.create(container, { value: 'texts' });
moeVim.init(editor);
```

### AMD

``` html
<script>
  require.config({ paths: {
    'vs': 'https://unpkg.com/monaco-editor/min/vs',
    'moe-vim-mode': 'https://unpkg.com/moe-vim-mode/dist/moe-vim-mode'
  }});

  require(['vs/editor/editor.main', 'moe-vim-mode'], function(_, moeVim) {
    var container = document.getElementById('container');
    var editor = monaco.editor.create(container, { value: 'texts' });
    moeVim.init(editor);
  });
</script>
```

### Script tag

``` html
<script src="https://unpkg.com/moe-vim-mode/dist/moe-vim-mode.js"></script>
<script>
  var container = document.getElementById('container');
  var editor = monaco.editor.create(container, { value: 'texts' });
  moeVim.init(editor);
</script>
```
For typed API list, see [index.d.ts](index.d.ts).

For full demonstration, see [demo.js](demo/demo.js).

## Development setup

``` bash
npm install

# watch and serve demo at http://localhost:8080/
npm run start

# run all tests
npm run test

# build dist
npm run build
```

## License

[MIT](http://opensource.org/licenses/MIT)
