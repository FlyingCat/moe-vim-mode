import { FROM } from "../editorBox";

FROM({
    suit: 'substitute',
    text: ['hello world', 'Hello world']
})
.TEST('case')
    .next({ex: '1,2s/hello/+', text: ['+ world', 'Hello world']})
    .restore()
    .next({ex: '1,2s/hello/+/i', text: ['+ world', '+ world']})
.TEST('global')
    .next({ex: 's/\\w+/ /2', text: ['  world', '  world'], cursor: [2, 3]})
    .restore()
    .next({ex: 's/\\w+/ /g2', text: ['   ', '   '], cursor: [2, 3]})
.TEST('submatch')
    .next({ex: 's/\\w+/$1-$0-$2/g', line: [1, '$1-hello-$2 $1-world-$2']})
    .restore()
    .next({ex: 's/([a-z])(o+)([a-z]?)/-$1-$2-$3-/g', line: [1, 'hel-l-o-- -w-o-r-ld']})
    .restore()
    .next({ex: 's/(\\w+)/-$10-/g', line: [1, '-hello0- -world0-']})
.TEST('escape', {text: ['hello', '']})
    .next({ex: 's/\\w+/$$\\\\\\n\\/$/g2', text: ['$\\', '/$', '']})
.RUN()
