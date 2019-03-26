import { FROM } from "../editorBox";

FROM({
    suit: 'operator - multi-curosr - line ranges',
    text: ['a', 'b', 'c', 'd'],
    cursors: [[1, 1], [3, 1]],
})
.TEST('count lines')
    .next({input: 'J', text: ['a b', 'c d'], cursors: [[1, 2], [2, 2]]})
    .restore()
    .next({input: '3J', text: ['a b c d'], cursors: [[1, 6]]})
.TEST('by lines')
    .next({input: '2gUU', text: ['A', 'B', 'C', 'D'], cursors: [[1, 1], [3, 1]]})
.TEST('by motion')
    .next({input: 'dj', text: [''], cursors: [[1, 1]]})
.RUN()

FROM({
    suit: 'operator - multi-curosr - char ranges',
    text: ['ab12', 'ab12'],
    cursors: [[1, 1], [2, 1]],
})
.TEST('count chars')
    .next({input: '2~', text: ['AB12', 'AB12'], cursors: [[1, 3], [2, 3]]})
.TEST('by cursor')
    .next({input: '<C-A>', text: ['ab13', 'ab13'], cursors: [[1, 4], [2, 4]]})
.TEST('by motion')
    .next({input: 'dt1', text: ['12', '12'], cursors: [[1, 1], [2, 1]]})
.TEST('by synonym')
    .next({input: '2x', text: ['12', '12'], cursors: [[1, 1], [2, 1]]})
.RUN()

FROM({
    suit: 'operator - multi-curosr - visual',
    text: ['abc', 'abc'],
    cursors: [[1, 1], [2, 1]],
})
.TEST('charwise')
    .next({input: '2vU', text: ['ABc', 'ABc'], cursors: [[1, 1], [2, 1]]})
.TEST('linewise')
    .next({input: 'VU', text: ['ABC', 'ABC'], cursors: [[1, 1], [2, 1]]})
.RUN()
