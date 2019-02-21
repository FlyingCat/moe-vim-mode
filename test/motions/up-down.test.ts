import { FROM } from "../editorBox";

FROM({
    suit: 'up-down motions',
    text: ['1', '22', '333', ' 44 ', '  5  '],
})
.TEST('j k')
    .next('$')
    .next({ input: '3j', cursor: [4, 4] })
    .next('h')
    .next({ input: '2k', cursor: [2, 2] })
    .next({ input: '2<Down>', cursor: [4, 3] })
    .next({ input: '100<Up>', cursor: [1, 1] })
.TEST('- + _')
    .next({ input: '2+<CR>', cursor: [4, 2] })
    .next({ input: '2_', cursor: [5, 3] })
    .next('0')
    .next({ input: '_', cursor: [5, 3] })
    .next({ input: '-', cursor: [4, 2] })
.TEST('G <C-End> gg')
    .next({ input: 'G', cursor: [5, 3] })
    .next({ input: '4G', cursor: [4, 2] })
    .next({ input: 'gg', cursor: [1, 1] })
    .next({ input: '3gg', cursor: [3, 1] })
    .next({ input: '<C-End>', cursor: [5, 5] })
.TEST('%')
    .next({ input: '100%', cursor: [5, 3] })
    .next({ input: '70%', cursor: [4, 2] })
    .next({ input: '50%', cursor: [3, 1] })
    .next({ input: '30%', cursor: [2, 1] })
.RUN()

