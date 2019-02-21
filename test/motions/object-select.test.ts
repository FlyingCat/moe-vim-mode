import { FROM } from "../editorBox";

FROM({
    suit: 'object select - word',
    text: '     12345     12345',
})
.TEST('aw')
    .next({ input: 'vaw', selection: [1, 1, 1, 11] })
    .cursor(1, 10)
    .next({ input: 'vaw', selection: [1, 6, 1, 16] })
    .cursor(1, 1)
    .next({ input: 'v2aw', selection: [1, 1, 1, 21] })
    .cursor(1, 6)
    .next({ input: 'v2aw', selection: [1, 6, 1, 21] })
.TEST('iw')
    .next({ input: 'viw', selection: [1, 1, 1, 6] })
    .cursor(1, 10)
    .next({ input: 'viw', selection: [1, 6, 1, 11] })
    .cursor(1, 1)
    .next({ input: 'v2iw', selection: [1, 1, 1, 11] })
    .cursor(1, 6)
    .next({ input: 'v3iw', selection: [1, 6, 1, 21] })
.RUN()

FROM({
    suit: 'object select - quote',
    text: '     "789"     "789"',
})
.TEST('a"')
    .next({input: 'va"', selection: [1, 6, 1, 11]})
    .cursor(1, 6)
    .next({input: 'va"', selection: [1, 6, 1, 11]})
    .cursor(1, 10)
    .next({input: 'va"', selection: [1, 6, 1, 11]})
    .cursor(1, 11)
    .next({input: 'va"', selection: [1, 16, 1, 21]})
.TEST('i"')
    .next({input: 'vi"', selection: [1, 7, 1, 10]})
    .cursor(1, 6)
    .next({input: 'vi"', selection: [1, 7, 1, 10]})
    .cursor(1, 10)
    .next({input: 'vi"', selection: [1, 7, 1, 10]})
    .cursor(1, 11)
    .next({input: 'vi"', selection: [1, 17, 1, 20]})
.RUN()

FROM({
    suit: 'object select - block',
    text: '1234(6789(123))6',
})
.TEST('a(')
    .cursor(1, 6)
    .next({input: 'va(', selection: [1, 5, 1, 16]})
    .cursor(1, 11)
    .next({input: 'v2a)', selection: [1, 5, 1, 16]})
.TEST('i(')
    .cursor(1, 6)
    .next({input: 'vi(', selection: [1, 6, 1, 15]})
    .cursor(1, 11)
    .next({input: 'v2i)', selection: [1, 6, 1, 15]})
.RUN()

FROM({
    suit: 'object select - block - linewise',
    text: ['{', '\t{', '\t\treturn', '\t}', '}'],
    cursor: [3, 3],
})
.TEST('diB')
    .next({input: 'diB', text: ['{', '\t{', '\t}', '}']})
.TEST('d2iB')
    .next({input: 'd2iB', text: ['{', '}']})
.RUN()
