import { FROM } from "../editorBox";

FROM({
    suit: 'operator - put char-wise',
    text: ['123', 'ab']
})
.TEST('p/gp')
    .cursor(2, 1)
    .next({input: 'yw'})
    .cursor(1, 1)
    .next({input: 'p', line: [1, '1ab23'], cursor: [1, 3]})
    .restore()
    .next({input: '2p', line: [1, '1abab23'], cursor: [1, 5]})
    .restore()
    .next({input: 'gp', line: [1, '1ab23'], cursor: [1, 4]})
    .restore()
    .next({input: '2gp', line: [1, '1abab23'], cursor: [1, 6]})
.TEST('P/gP')
    .next({input: 'P', line: [1, 'ab123'], cursor: [1, 2]})
    .restore()
    .next({input: '2P', line: [1, 'abab123'], cursor: [1, 4]})
    .restore()
    .next({input: 'gP', line: [1, 'ab123'], cursor: [1, 3]})
    .restore()
    .next({input: '2gP', line: [1, 'abab123'], cursor: [1, 5]})
.RUN()

FROM({
    suit: 'operator - put line-wise',
    text: ['-', '-']
})
.TEST('p/gp', {text: ' a'})
    .next({input: 'yy'})
.TEST('p/gp')
    .next({input: 'p', text: ['-', ' a', '-'], cursor: [2, 2]})
    .restore()
    .next({input: '2p', text: ['-', ' a', ' a', '-'], cursor: [2, 2]})
    .restore()
    .next({input: 'gp', text: ['-', ' a', '-'], cursor: [3, 1]})
    .restore()
    .next({input: '2gp', text: ['-', ' a', ' a', '-'], cursor: [4, 1]})
.TEST('P/gP')
    .next({input: 'P', text: [' a', '-', '-'], cursor: [1, 2]})
    .restore()
    .next({input: '2P', text: [' a', ' a', '-', '-'], cursor: [1, 2]})
    .restore()
    .next({input: 'gP', text: [' a', '-', '-'], cursor: [2, 1]})
    .restore()
    .next({input: '2gP', text: [' a', ' a', '-', '-'], cursor: [3, 1]})
.RUN()

FROM({
    suit: 'operator - put in Visual',
    text: ['+', 'abc']
})
.TEST('line to line')
    .next({input: 'yyjVp"1p', text: ['+', '+', 'abc']})
    .restore()
    .next({input: 'yy2V2p"1p', text: ['+', '+', 'abc', '+']})
.TEST('line to char')
    .next({input: 'yyjlvlp"-p', text: ['+', 'a', '+b', 'c']})
    .restore()
    .next({input: '2yyjlvlp"-p', text: ['+', 'a', '+b', 'abc', 'c']})
.TEST('char to line')
    .next({input: 'ywVjp"1p', text: ['+', '+', 'abc']})
    .restore()
    .next({input: 'ywVj2p"1p', text: ['+', '+', 'abc', '+']})
.TEST('char to char')
    .next({input: 'ywjlvlp"-p', text: ['+', 'a+bc']})
    .restore()
    .next({input: 'ywjlvl2p"-p', text: ['+', 'a++bc']})
.RUN()

FROM({
    suit: 'operator - put with multi-cursor',
    text: ['+', '*'],
    cursors: [[1, 1], [2, 1]]
})
.TEST('linewise')
    .next({input: 'yy2p', text: ['+', '+', '+', '*', '*', '*']})
    .restore()
    .cursor(1, 1)
    .next({input: '2p', text: ['+', '+', '*', '+', '*', '*']})
.TEST('charwise')
    .next({input: 'yw2p', text: ['+++', '***']})
    .restore()
    .cursor(1, 1)
    .next({input: '2p', text: ['++', '*', '+', '*', '*']})
.RUN()
