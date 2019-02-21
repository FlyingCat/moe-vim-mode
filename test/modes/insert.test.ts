import { FROM } from "../editorBox";

FROM({
    suit: 'insert mode - insert/append',
    text: ['1234', '1234', '1234'],
})
.TEST('i')
    .cursor(1, 3)
    .next({ input: '2iab<ESC>', line: [1, '12abab34'], cursor: [1, 6],  mode: 'Normal' })
    .cursor(2, 3)
    .next({ input: '1.', line: [2, '12ab34'], cursor: [2, 4],  mode: 'Normal' })
    .cursor(3, 3)
    .next({ input: '.', line: [3, '12ab34'], cursor: [3, 4],  mode: 'Normal' })
.TEST('a')
    .cursor(1, 2)
    .next({ input: 'aab<ESC>', line: [1, '12ab34'], cursor: [1, 4],  mode: 'Normal' })
    .cursor(2, 2)
    .next({ input: '2.', line: [2, '12abab34'], cursor: [2, 6],  mode: 'Normal' })
    .cursor(3, 2)
    .next({ input: '.', line: [3, '12abab34'], cursor: [3, 6],  mode: 'Normal' })
.TEST('I')
    .cursor(1, 2)
    .next({ input: 'Iab<ESC>', line: [1, 'ab1234'], cursor: [1, 2],  mode: 'Normal' })
    .cursor(2, 2)
    .next({ input: '2.', line: [2, 'abab1234'], cursor: [2, 4],  mode: 'Normal' })
    .cursor(3, 2)
    .next({ input: '.', line: [3, 'abab1234'], cursor: [3, 4],  mode: 'Normal' })
.TEST('A')
    .cursor(1, 3)
    .next({ input: '2Aab<ESC>', line: [1, '1234abab'], cursor: [1, 8],  mode: 'Normal' })
    .cursor(2, 3)
    .next({ input: '1.', line: [2, '1234ab'], cursor: [2, 6],  mode: 'Normal' })
    .cursor(3, 3)
    .next({ input: '.', line: [3, '1234ab'], cursor: [3, 6],  mode: 'Normal' })
.RUN()

FROM({
    suit: 'insert mode - new line',
    text: ['-', '-',],
})
.TEST('o')
    .next({ input: '2oab<ESC>', text: ['-', 'ab', 'ab', '-'], cursor: [3, 2],  mode: 'Normal' })
    .cursor(4, 1)
    .next({ input: '1.', text: ['-', 'ab', 'ab', '-', 'ab'], cursor: [5, 2],  mode: 'Normal' })
.TEST('O')
    .next({ input: 'Oab<ESC>', text: ['ab', '-', '-'], cursor: [1, 2],  mode: 'Normal' })
    .cursor(3, 1)
    .next({ input: '2.', text: ['ab', '-', 'ab', 'ab', '-'], /* cursor: [3, 2], expected [4, 2]*/ mode: 'Normal' })
.RUN()

FROM({
    suit: 'insert mode - change',
    text: ['1 2 3', '1 2 3', '1 2 3'],
})
.TEST('cw')
    .next({ input: 'c2wab<ESC>', line: [1, 'ab 3'], cursor: [1, 2], mode: 'Normal' })
    .cursor(2, 3)
    .next({ input: '1.', line: [2, '1 ab 3'], cursor: [2, 4], mode: 'Normal' })
.TEST('char-visual')
    .next({ input: 'vecab<ESC>', line: [1, 'ab 3'], cursor: [1, 2], mode: 'Normal' })
    .cursor(2, 2)
    .next({ input: '2.', line: [2, '1ab3'], cursor: [2, 3], mode: 'Normal' })
.TEST('line-visual')
    .next({ input: 'Vcab<ESC>', line: [1, 'ab'], cursor: [1, 2], mode: 'Normal' })
    .cursor(2, 2)
    .next({ input: '2.', text: ['ab', 'ab', '1 2 3'], cursor: [2, 2], mode: 'Normal' })
.RUN()
