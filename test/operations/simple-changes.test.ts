import { FROM } from "../editorBox";

FROM({
    suit: 'operator - r{char}',
    text: 'hello world'
})
.TEST('normal')
    .next({input: '5rc', text: 'ccccc world', cursor: [1, 5]})
.TEST('visual')
    .next({input: 'wverc', text: 'hello ccccc', cursor: [1, 7]})
.RUN()

FROM({
    suit: 'operator - change case',
    text: 'Hello World'
})
.TEST('lower')
    .next({input: 'guw', text: 'hello World', cursor: [1, 1]})
    .restore()
    .next({input: 'guu', text: 'hello world', cursor: [1, 1]})
.TEST('upper')
    .next({input: 'gUw', text: 'HELLO World', cursor: [1, 1]})
    .restore()
    .next({input: 'gUU', text: 'HELLO WORLD', cursor: [1, 1]})
.TEST('toggle')
    .next({input: '3~', text: 'hELlo World', cursor: [1, 4]})
    .restore()
    .next({input: 'g~w', text: 'hELLO World', cursor: [1, 1]})
.RUN()

FROM({
    suit: 'operator - change case',
    text: 'Hello World'
})
.TEST('lower')
    .next({input: 'guw', text: 'hello World', cursor: [1, 1]})
    .restore()
    .next({input: 'guu', text: 'hello world', cursor: [1, 1]})
.TEST('upper')
    .next({input: 'gUw', text: 'HELLO World', cursor: [1, 1]})
    .restore()
    .next({input: 'gUU', text: 'HELLO WORLD', cursor: [1, 1]})
.TEST('toggle')
    .next({input: '3~', text: 'hELlo World', cursor: [1, 4]})
    .restore()
    .next({input: 'g~w', text: 'hELLO World', cursor: [1, 1]})
.RUN()

FROM({
    suit: 'operator - shift',
    text: ['a', '    b']
})
.TEST('motion')
    .next({input: '>j', text: ['    a', '        b'], cursor: [1, 5]})
    .next({input: '<j', text: ['a', '    b'], cursor: [1, 1]})
.TEST('count lines')
    .next({input: '2>>', text: ['    a', '        b'], cursor: [1, 5]})
    .next({input: '2<<', text: ['a', '    b'], cursor: [1, 1]})
.TEST('visual')
    .next({input: 'Vj>', text: ['    a', '        b'], cursor: [1, 5]})
    .next({input: 'Vj<', text: ['a', '    b'], cursor: [1, 1]})
.TEST('visual with count')
    .next({input: 'Vj2>', text: ['        a', '            b'], cursor: [1, 9]})
    .next({input: 'Vj2<', text: ['a', '    b'], cursor: [1, 1]})
.RUN()
