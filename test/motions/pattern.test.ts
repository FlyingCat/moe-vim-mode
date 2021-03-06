import { FROM } from "../editorBox";

FROM({
    suit: 'pattern search motions',
    text: ['  abc  abc', 'aabcc++abc'],
})
.TEST('forward - whole word')
    .next({ input: '*', cursor: [1, 8] })
    .next({ input: 'n', cursor: [2, 8] })
    .next({ input: 'n', cursor: [1, 3] })
    .next({ input: 'N', cursor: [2, 8] })
    .next({ input: 'N', cursor: [1, 8] })
    .next({ input: 'N', cursor: [1, 3] })
    .next({ input: '2n', cursor: [2, 8] })
    .next({ input: '2N', cursor: [1, 3] })
.TEST('backward - whole word')
    .next({ input: '#', cursor: [2, 8] })
    .next({ input: 'n', cursor: [1, 8] })
    .next({ input: 'n', cursor: [1, 3] })
    .next({ input: 'N', cursor: [1, 8] })
    .next({ input: 'N', cursor: [2, 8] })
    .next({ input: 'N', cursor: [1, 3] })
    .next({ input: '2n', cursor: [1, 8] })
    .next({ input: '2N', cursor: [1, 3] })
.TEST('forward - not whole word')
    .next({ input: 'g*', cursor: [1, 8] })
    .next({ input: 'n', cursor: [2, 2] })
    .next({ input: 'n', cursor: [2, 8] })
    .next({ input: 'n', cursor: [1, 3] })
    .next({ input: 'N', cursor: [2, 8] })
    .next({ input: 'N', cursor: [2, 2] })
    .next({ input: 'N', cursor: [1, 8] })
    .next({ input: 'N', cursor: [1, 3] })
.TEST('backward - not whole word')
    .next({ input: 'g#', cursor: [2, 8] })
    .next({ input: 'n', cursor: [2, 2] })
    .next({ input: 'n', cursor: [1, 8] })
    .next({ input: 'n', cursor: [1, 3] })
    .next({ input: 'N', cursor: [1, 8] })
    .next({ input: 'N', cursor: [2, 2] })
    .next({ input: 'N', cursor: [2, 8] })
    .next({ input: 'N', cursor: [1, 3] })
.TEST('gn')
    .next({ input: '*gn', selection: [1, 8, 1, 11] })
    .next({ input: 'gn', selection: [1, 8, 2, 11] })
    .next({ input: 'gn', selection: [1, 8, 1, 5] })
    .next({ input: '<ESC>cgn*<ESC>.', line: [1, '  *  *'] })
    .next({ input: '...', line: [2, 'aabcc++*'] })
.TEST('gN')
    .next({ input: '*gN', selection: [1, 11, 1, 8] })
    .next({ input: 'gN', selection: [1, 11, 1, 3] })
    .next({ input: 'gN', selection: [1, 11, 2, 8] })
    .next({ input: '<ESC>cgn*<ESC>', line: [2, 'aabcc++*'] })
    .next({ input: '....', line: [1, '  *  *'] })
.RUN()
