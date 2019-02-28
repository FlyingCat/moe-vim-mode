import { FROM } from "../editorBox";

FROM({
    suit: 'operator - J',
})
.TEST('common', {text: ['a', 'b', 'c', 'd']})
    .next({input: '3J', text: ['a b c', 'd'], cursor: [1, 4]})
    .restore()
    .next({input: 'VjjJ', text: ['a b c', 'd'], cursor: [1, 4]})
.TEST('begin with empty lines', {text: ['', '', 'a']})
    .next({input: '3J', text: 'a', cursor: [1, 1]})
.TEST('end with empty lines', {text: ['a', '', '']})
    .next({input: '3J', text: 'a ', cursor: [1, 2]})
.TEST('wrap empty lines', {text: ['a', '', '', 'b']})
    .next({input: '4J', text: 'a b', cursor: [1, 3]})
.TEST('all empty lines', {text: ['', '', '', '']})
    .next({input: '4J', text: '', cursor: [1, 1]})
.TEST('trailing white space', {text: ['a  ', 'b']})
    .next({input: 'J', text: 'a  b', cursor: [1, 4]})
.TEST('leading white space and ")"', {text: ['a', '    )']})
    .next({input: 'J', text: 'a)', cursor: [1, 2]})
.RUN()

FROM({
    suit: 'operator - gJ',
})
.TEST('common', {text: ['a', 'b', 'c', 'd']})
    .next({input: '3gJ', text: ['abc', 'd'], cursor: [1, 3]})
    .restore()
    .next({input: 'VjjgJ', text: ['abc', 'd'], cursor: [1, 3]})
.TEST('begin with empty lines', {text: ['', '', 'a']})
    .next({input: '3gJ', text: 'a', cursor: [1, 1]})
.TEST('end with empty lines', {text: ['a', '', '']})
    .next({input: '3gJ', text: 'a', cursor: [1, 1]})
.TEST('wrap empty lines', {text: ['a', '', '', 'b']})
    .next({input: '4gJ', text: 'ab', cursor: [1, 2]})
.TEST('all empty lines', {text: ['', '', '', '']})
    .next({input: '4gJ', text: '', cursor: [1, 1]})
.RUN()
