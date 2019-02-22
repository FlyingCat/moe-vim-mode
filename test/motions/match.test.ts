import { FROM } from "../editorBox";

FROM({
    suit: 'go to unmatched',
    text: '1234(6789(123))6',
})
.TEST('[(')
    .cursor(1, 6)
    .next({input: '[(', cursor: [1, 5]})
    .cursor(1, 5)
    .next({input: '[(', cursor: [1, 5]})
    .cursor(1, 15)
    .next({input: '[(', cursor: [1, 5]})
    .cursor(1, 11)
    .next({input: '2[(', cursor: [1, 5]})
    .cursor(1, 10)
    .next({input: '2[(', cursor: [1, 5]})
    .cursor(1, 14)
    .next({input: '2[(', cursor: [1, 5]})
.TEST('])')
    .cursor(1, 6)
    .next({input: '])', cursor: [1, 15]})
    .cursor(1, 5)
    .next({input: '])', cursor: [1, 15]})
    .cursor(1, 15)
    .next({input: '])', cursor: [1, 15]})
    .cursor(1, 11)
    .next({input: '2])', cursor: [1, 15]})
    .cursor(1, 10)
    .next({input: '2])', cursor: [1, 15]})
    .cursor(1, 14)
    .next({input: '2])', cursor: [1, 15]})
.RUN()
