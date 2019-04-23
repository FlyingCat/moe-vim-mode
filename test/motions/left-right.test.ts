import { FROM } from "../editorBox";

FROM({
    suit: 'left-right simple motions',
    text: ['-', '     12345     ', '     ', ''],
    cursor: [2, 6],
})
.TEST('h')
    .next({ input: 'h', cursor: [2, 5] })
    .next({ input: '2<BS>', cursor: [2, 3] })
    .next({ input: '100<Left>', cursor: [2, 1] })
    .next({ input: 'h', cursor: [2, 1] }) // should not wrap to prev line
.TEST('l')
    .next({ input: 'l', cursor: [2, 7] })
    .next({ input: '3<Space>', cursor: [2, 10] })
    .next({ input: '5<Right>', cursor: [2, 15] })
    .next({ input: 'l', cursor: [2, 15] }) // should not at eol
.TEST('0')
    .next({ input: '0', cursor: [2, 1] })
    .cursor(4, 1)
    .next({ input: '<Home>', cursor: [4, 1] })
.TEST('^')
    .next({ input: '^', cursor: [2, 6] })
    .cursor(3, 1)
    .next({ input: '^', cursor: [3, 5] }) // last col if all blank chars
    .cursor(4, 1)
    .next({ input: '^', cursor: [4, 1] })
.TEST('$')
    .next({ input: '$',     cursor: [2, 15] })
    .cursor(1, 1)
    .next({ input: '3$',    cursor: [3, 5] }) // (count - 1) downward
    .cursor(1, 1)
    .next({ input: '100<End>',  cursor: [4, 1] })
.TEST('g_')
    .next({ input: 'g_',     cursor: [2, 10] })
    .cursor(1, 1)
    .next({ input: '3g_',    cursor: [3, 1] }) // (count - 1) downward, first col if all blank chars
    .cursor(1, 1)
    .next({ input: '100g_',  cursor: [4, 1] })
.RUN();

FROM({
    suit: 'left-right <BS> with wraps',
    text: ['12345', '', 'abc'],
    cursor: [3, 2]
})
.TEST('move')
    .next({ input: '2<BS>', cursor: [2, 1] })
    .next({ input: '<BS>', cursor: [1, 5] })
    .restore()
    .next({ input: '3<BS>', cursor: [1, 5] })
.TEST('select')
    .next({ input: 'v2<BS>', selection: [3, 2, 2, 1] })
    .next({ input: '<BS>', selection: [3, 2, 1, 6] })
    .restore()
    .next({ input: 'v3<BS>', selection: [3, 2, 1, 6] })
.TEST('operator')
    .next({ input: 'd2<BS>', text: ['12345', 'bc'], cursor: [2, 1] })
    .next({ input: 'd<BS>', text: ['12345bc'], cursor: [1, 6] })
    .restore()
    .next({ input: 'd3<BS>', text: ['12345bc'], cursor: [1, 6] })
.RUN();

FROM({
    suit: 'left-right <Space> with wraps',
    text: ['abc', '', '12345'],
    cursor: [1, 3]
})
.TEST('move')
    .next({ input: '<Space>', cursor: [2, 1] })
    .next({ input: '2<Space>', cursor: [3, 2] })
    .restore()
    .next({ input: '3<Space>', cursor: [3, 2] })
.TEST('select')
    .next({ input: 'v2<Space>', selection: [1, 3, 2, 1] })
    .next({ input: '2<Space>', selection: [1, 3, 3, 2] })
    .restore()
    .next({ input: 'v4<Space>', selection: [1, 3, 3, 2] })
.TEST('operator')
    .next({ input: 'd4<Space>', text: ['ab2345'], cursor: [1, 3] })
    // TODO: Vim atually has different behavior while handling eol
    // try d1, d2, d3
    // also try d3 with text ['+', '+', '']
.RUN();

FROM({
    suit: 'left-right char motions',
    text: '(234)(789)(234)(789)',
})
.TEST('f')
    .next({input: 'f0', cursor: [1, 1]})
    .next({input: '10f(', cursor: [1, 1]})
    .next({input: 'f(', cursor: [1, 6]})
    .next({input: '2f(', cursor: [1, 16]})
    .next({input: 'f)', cursor: [1, 20]})
.TEST('F', {cursor: [1, 20]})
    .next({input: 'F0', cursor: [1, 20]})
    .next({input: '10F)', cursor: [1, 20]})
    .next({input: 'F)', cursor: [1, 15]})
    .next({input: '2F)', cursor: [1, 5]})
    .next({input: 'F(', cursor: [1, 1]})
.TEST('t')
    .next({input: 't0', cursor: [1, 1]})
    .next({input: '10t(', cursor: [1, 1]})
    .next({input: 't(', cursor: [1, 5]})
    .next({input: 't(', cursor: [1, 5]})
    .next({input: '3t(', cursor: [1, 15]})
.TEST('T', {cursor: [1, 20]})
    .next({input: 'T0', cursor: [1, 20]})
    .next({input: '10T)', cursor: [1, 20]})
    .next({input: 'T)', cursor: [1, 16]})
    .next({input: 'T)', cursor: [1, 16]})
    .next({input: '3T)', cursor: [1, 6]})
.TEST('; ,')
    .next({input: 'f(', cursor: [1, 6]})
    .next({input: '2;', cursor: [1, 16]})
    .next({input: '2,', cursor: [1, 6]})
    .cursor(1, 1)
    .next({input: 't(', cursor: [1, 5]})
    .next({input: ';', cursor: [1, 10]})
    .next({input: '2;', cursor: [1, 15]})
    .next({input: '2,', cursor: [1, 7]})
    .next({input: ',', cursor: [1, 2]})
.RUN();
