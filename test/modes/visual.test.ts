import { FROM } from "../editorBox";

FROM({
    suit: 'visual mode',
    text: ['12345', '12345', '12345'],
})
.TEST('base')
    .next({ input: 'v3l', selection: [1, 1, 1, 4],  mode: 'Visual' })
    .next({ input: 'v', selection: [1, 4, 1, 4],  mode: 'Normal' })
    .next({ input: 'gv', selection: [1, 1, 1, 4],  mode: 'Visual' })
    .next({ input: 'o', selection: [1, 4, 1, 1],  mode: 'Visual' })
    .next({ input: 'v', selection: [1, 1, 1, 1],  mode: 'Normal' })
    .next({ input: 'gv', selection: [1, 4, 1, 1],  mode: 'Visual' })
.TEST('to linewise')
    .next({ input: 'vjV', selection: [1, 1, 2, 6], mode: 'VisualLine' })
.TEST('to linewise - rtl', {cursor: [2, 1]})
    .next({ input: 'vkV', selection: [2, 6, 1, 1], mode: 'VisualLine' })
.TEST('operator')
    .next({ input: 'v2e', selection: [1, 1, 2, 6], mode: 'Visual' })
    .next({ input: 'd', selection: [1, 1, 1, 1], text: ['', '12345'], mode: 'Normal' })
.RUN()

FROM({
    suit: 'visual line mode',
    text: ['1', '', '1', '', '1'],
})
.TEST('base')
    .next({ input: 'V2j', selection: [1, 1, 3, 2],  mode: 'VisualLine' })
    .next({ input: 'V', selection: [3, 1, 3, 1],  mode: 'Normal' })
    .next({ input: 'gv', selection: [1, 1, 3, 2],  mode: 'VisualLine' })
    .next({ input: 'o', selection: [3, 2, 1, 1],  mode: 'VisualLine' })
    .next({ input: 'V', selection: [1, 1, 1, 1],  mode: 'Normal' })
    .next({ input: 'gv', selection: [3, 2, 1, 1],  mode: 'VisualLine' })
    .next({ input: 'v', selection: [3, 2, 1, 1],  mode: 'Visual' })
.TEST('with empty lines')
    .next({ input: 'jV2j', selection: [2, 1, 4, 1],  mode: 'VisualLine' })
    .next({ input: 'd', selection: [2, 1, 2, 1], text: ['1', '1'],  mode: 'Normal' })
.RUN()
