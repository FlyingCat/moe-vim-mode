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

FROM({
    suit: 'operator - add number',
    text: 'a-001a'
})
.TEST('in normal mode')
    .next({input: '<C-A>', text: 'a000a', cursor: [1, 4]})
    .next({input: '10<C-A>', text: 'a010a', cursor: [1, 4]})
    .next({input: '100<C-A>', text: 'a110a', cursor: [1, 4]})
    .next({input: '1000<C-A>', text: 'a1110a', cursor: [1, 5]})
.TEST('in visual mode')
    .cursor(1, 3)
    .next('2v')
    .next({input: '<C-A>', text: 'a-011a', cursor: [1, 3]})
.RUN()

FROM({
    suit: 'operator - subtract number',
    text: 'a001a'
})
.TEST('in normal mode')
    .next({input: '<C-X>', text: 'a000a', cursor: [1, 4]})
    .next({input: '10<C-X>', text: 'a-010a', cursor: [1, 5]})
    .next({input: '100<C-X>', text: 'a-110a', cursor: [1, 5]})
    .next({input: '1000<C-X>', text: 'a-1110a', cursor: [1, 6]})
.TEST('in visual mode')
    .cursor(1, 2)
    .next('2v')
    .next({input: '<C-X>', text: 'a-011a', cursor: [1, 2]})
.RUN()

FROM({
    suit: 'operator - add/subtract number sequence',
    text: ['0.a', '0.b', '0.c']
})
.TEST('add')
    .next('VG')
    .next({input: 'g<C-A>', text: ['1.a', '2.b', '3.c']})
.TEST('add with count')
    .next('VG')
    .next({input: '10g<C-A>', text: ['10.a', '20.b', '30.c']})
.TEST('subtract')
    .next('VG')
    .next({input: 'g<C-X>', text: ['-1.a', '-2.b', '-3.c']})
.TEST('subtract with count')
    .next('VG')
    .next({input: '10g<C-X>', text: ['-10.a', '-20.b', '-30.c']})
.RUN()
