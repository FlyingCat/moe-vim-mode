import { FROM } from "../editorBox";

FROM({
    suit: 'mark',
    text: ['  345', '1'],
    cursor: [1, 4],
})
.TEST('``')
    .next({input: 'G``', cursor: [1, 4]})
    .next({input: '``', cursor: [2, 1]})
.TEST("''")
    .next({input: "G''", cursor: [1, 3]})
    .next({input: "''", cursor: [2, 1]})
.TEST('ma')
    .next({input: 'maj`a', cursor: [1, 4]})
    .next({input: 'yyP`a', cursor: [2, 4]})
    .next({input: 'dd`a', cursor: [2, 1]})
    .next({input: 'u`a', cursor: [2, 4]})
.RUN()
