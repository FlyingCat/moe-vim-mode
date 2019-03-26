import { FROM } from "../editorBox";

FROM({
    suit: 'registers',
    text: ['+', '*']
})
.TEST('unnamed & 0')
    .next({input: 'yy""p"0p', text: ['+', '+', '+', '*']})
    .restore()
    // Writing to the "" register writes to register "0
    .next({input: '2G""ddp"0p', text: ['+', '*', '*']})
.TEST('named - linewise')
    .next({input: '"ayy2G"Ayy"a2p', text: ['+', '*', '+', '*', '+', '*']})
.TEST('named - charwise')
    .next({input: '"ayw2G"Ayw"a2p', text: ['+', '*+*+*']})
.TEST('named - linewise+charwise')
    .next({input: '"ayy2G"Ayw2p', text: ['+', '*', '+', '*', '+', '*']})
.TEST('named - charwise+linewise')
    .next({input: '"ayw2G"Ayy2p', text: ['+', '*', '+', '*', '+', '*']})
.TEST('numbered & -')
    .next({input: 'ddcw%<ESC>dd"-p"1p"2p', text: ['*', '%', '+']})
.TEST('black hold')
    .next({input: 'yy2G"_ddp', text: ['+', '+']})
.RUN()
