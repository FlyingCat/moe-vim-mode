✓  done

!  partial

★  differ from Vim

__not supported__

- Ex commands (work in progress)
- Visual Block mode
- Replace Mode
- Marks
- Macros

## Monaco Editor actions

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   gd   |   go to declaration   |
|   ✓   |   gh   |   show hover   |


## left-right-motions

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   h, \<BS>, \<Left>   |   [count] characters to the left   |
|   ✓   |   l, \<Right>, \<Space>   |   [count] characters to the right   |
|   ✓   |   0, \<Home>   |   To the first character of the line   |
|   ✓   |   ^   |   To the first non-blank character of the line   |
|   ✓   |   $, \<End>   |   To the end of the line and [count - 1] lines downward   |
|   ✓   |   g_   |   To the last non-blank character of the line and [count - 1] lines downward   |
|       |   g0, g\<Home>   |   To the first character of the screen line   |
|       |   g^   |   To the first non-blank character of the screen line   |
|       |   gm   |   Like "g0", but half a screenwidth to the right   |
|       |   g$, g\<End>   |   To the last character of the screen line and [count - 1] screen lines downward   |
|       |   \|   |   To screen column [count] in the current line   |
|   ✓   |   f{char}   |   To [count]'th occurrence of {char} to the right   |
|   ✓   |   F{char}   |   To the [count]'th occurrence of {char} to the left   |
|   ✓   |   t{char}   |   Till before [count]'th occurrence of {char} to the right   |
|   ✓   |   T{char}   |   Till after [count]'th occurrence of {char} to the left   |
|   ✓   |   ;   |   Repeat latest f, t, F or T [count] times   |
|   ✓   |   ,   |   Repeat latest f, t, F or T in opposite direction [count] times   |


## up-down-motions

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   k, \<Up>   |   [count] lines upward   |
|   ✓   |   j, \<Down>   |   [count] lines downward   |
|   ✓   |   gk, g\<Up>   |   [count] display lines upward   |
|   ✓   |   gj, g\<Down>   |   [count] display lines downward   |
|   ✓   |   \-   |       [count] lines upward, on the first non-blank character   |
|   ✓   |   \+, CTRL-M, \<CR>  |   [count] lines downward, on the first non-blank character   |
|   ✓   |   _    |   [count] - 1 lines downward, on the first non-blank character   |
|   ✓   |   G   |   Goto line [count], default last line, on the first non-blank character   |
|   ✓   |   \<C-End>   |   Goto line [count], default last line, on the last character   |
|   ✓   |   \<C-Home>, gg   |   Goto line [count], default first line, on the first non-blank character   |
|   ✓   |   {count}%   |   Go to {count} percentage in the file, on the first non-blank in the line   |


## word-motions

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   w   |   [count] words forward   |
|   ✓   |   W   |   [count] WORDS forward   |
|   ✓   |   e   |   Forward to the end of word [count]   |
|   ✓   |   E   |   Forward to the end of WORD [count]   |
|   ✓   |   b   |   [count] words backward   |
|   ✓   |   B   |   [count] WORDS backward   |
|   ✓   |   ge   |   Backward to the end of word [count]   |
|   ✓   |   gE   |   Backward to the end of WORD [count]   |


## object-motions

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|       |   (   |   [count] sentences backward   |
|       |   )   |   [count] sentences forward   |
|       |   {   |   [count] paragraphs backward   |
|       |   }   |   [count] paragraphs forward   |
|       |   ]]   |   [count] sections forward or to the next '{' in the first column   |
|       |   ][   |   [count] sections forward or to the next '}' in the first column   |
|       |   [[   |   [count] sections backward or to the previous '{' in the first column   |
|       |   []   |   [count] sections backward or to the previous '}' in the first column   |


## object-select text-objects

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   aw   |   "a word", select [count] words   |
|   ✓   |   iw   |   "inner word", select [count] words   |
|   ✓   |   aW   |   "a WORD", select [count] WORDs   |
|   ✓   |   iW   |   "inner WORD", select [count] WORDs   |
|       |   as   |   "a sentence", select [count] sentences   |
|       |   is   |   "inner sentence", select [count] sentences   |
|       |   ap   |   "a paragraph", select [count] paragraphs   |
|       |   ip   |   "inner paragraph", select [count] paragraphs   |
|   ✓   |   a], a[   |   "a [] block", select [count] '[' ']' blocks   |
|   ✓   |   i], i[   |   "inner [] block", select [count] '[' ']' blocks   |
|   ✓   |   a), a(, ab   |   "a block", select [count] blocks   |
|   ✓   |   i), i(, ib   |   "inner block", select [count] blocks   |
|   ✓   |   a>, a<   |   "a <> block", select [count] <> blocks   |
|   ✓   |   i>, i<   |   "inner <> block", select [count] <> blocks   |
|       |   at   |   "a tag block", select [count] tag blocks   |
|       |   it   |   "inner tag block", select [count] tag blocks   |
|   ✓   |   a}, a{, aB   |   "a Block", select [count] Blocks   |
|   ✓   |   i}, i{, iB   |   "inner Block", select [count] Blocks   |
|   ✓   |   a", a', a`   |   "a quoted string", Selects the text from the previous quote until the next quote      |
|   ✓   |   i", i', i\`  |   Like a", a' and a`, but exclude the quotes   |


## various-motions

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|       |   %   |   Find the next item in this line after or under the cursor and jump to its match   |
|   ✓   |   [(   |   go to [count] previous unmatched '('   |
|   ✓   |   [{   |   go to [count] previous unmatched '{'   |
|   ✓   |   ])   |   go to [count] next unmatched ')'   |
|   ✓   |   ]}   |   go to [count] next unmatched '}'   |
|   ✓   |   H   |   To line [count] from top of window (default: first line on the window) on the first non-blank characte   |
|   ✓   |   M   |   To Middle line of window, on the first non-blank character   |
|   ✓   |   L   |   To line [count] from bottom of window (default: Last line on the window) on the first non-blank character   |


## search-commands

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓ ★   |   /{pattern}   |   Search forward for the [count]'th occurrence of {pattern}. Note: NOT a motion; JS Regex; start with "\c" to ignore case; start with "\C" to match case    |
|   ✓ ★   |   ?{pattern}   |   Search backward for the [count]'th previous occurrence of {pattern}. Note: as above  |
|   ✓   |   n   |   Repeat the latest "/" or "?" [count] times   |
|   ✓   |   N   |   Repeat the latest "/" or "?" [count] times in opposite direction   |
|   ✓   |   *   |   Search forward for the [count]'th occurrence of the word nearest to the cursor   |
|   ✓   |   #   |   Same as "*", but search backward   |
|   ✓   |   g*   |   Like "*", but also find matches that are not a whole word   |
|   ✓   |   g#   |   Like "#", but also find matches that are not a whole word   |


## scrolling

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   CTRL-E   |   Scroll window [count] lines downwards   |
|   ✓   |   CTRL-D   |   Scroll window [count] half pages Downwards   |
|   ✓   |   CTRL-F   |   Scroll window [count] pages Forwards (downwards)   |
|   ✓   |   z+   |   line [count] at top of window (default line just below the window) and put cursor at first non-blank   |
|   ✓   |   CTRL-Y   |   Scroll window [count] lines upwards   |
|   ✓   |   CTRl-U   |   Scroll window [count] half pages Upwards   |
|   ✓   |   CTRL-B   |   Scroll window [count] pages Backwards (upwards)   |
|   ✓   |   z^   |   line [count] at bottom of window (default line just above the window) and put cursor at first non-blank   |
|   ✓   |   z<CR>   |   line [count] at top of window (default cursor line) and put cursor at first non-blank   |
|   ✓   |   zt   |   Like "z<CR>", but leave the cursor in the same column   |
|   ✓   |   z.   |   line [count] at center of window (default cursor line) and put cursor at first non-blank   |
|   ✓   |   zz   |   Like "z.", but leave the cursor in the same column   |
|   ✓   |   zt   |   line [count] at bottom of window (default cursor line) and put cursor at first non-blank   |
|   ✓   |   zb   |   Like "z-", but leave the cursor in the same column   |


## scrolling horizontally

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|       |   zl   |   Move the view on the text [count] characters to the right   |
|       |   zh   |   Move the view on the text [count] characters to the left   |
|       |   zL   |   Move the view on the text half a screenwidth to the right   |
|       |   zH   |   Move the view on the text half a screenwidth to the left   |
|       |   zs   |   Scroll the text horizontally to position the cursor at the start (left side) of the screen   |
|       |   ze   |   Scroll the text horizontally to position the cursor at the end (right side) of the screen   |


## deleting

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   \["x]\<Del>, \["x]x   |   Delete [count] characters under and after the cursor [into register x]   |
|   ✓   |   \["x]X   |   Delete [count] characters before the cursor  |
|   ✓   |   \["x]d{motion}   |   Delete text that {motion} moves over   |
|   ✓   |   \["x]dd   |   Delete [count] lines   |
|   ✓   |   \["x]D   |   Delete the characters under the cursor until the end of the line and [count]-1 more lines   |
|   ✓   |  {Visual}\["x]x, {Visual}\["x], {Visual}\["x]<Del> |   Delete the highlighted text   |
|   ✓   |   {Visual}\["x]X, {Visual}\["x]D   |   Delete the highlighted lines   |
|   ✓   |   J   |   Join [count] lines, with a minimum of two lines   |
|   ✓   |   {Visual}J   |   Join the highlighted lines  |
|   ✓   |   gJ   |   Join [count] lines, don't insert or remove any spaces   |
|   ✓   |   {Visual}gJ   |   Join the highlighted lines, don't insert or remove any spaces   |


## delete-insert

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   \["x]c{motion}   |   Delete {motion} text and start insert   |
|   ✓   |   \["x]cc   |   Delete [count] lines and start insert   |
|   ✓   |   \["x]C   |   Delete from the cursor position to the end of the line and [count]-1 more lines, and start insert   |
|   ✓   |   \["x]s   |   Delete [count] characters and start insert   |
|   ✓   |   \["x]S   |   Delete [count] lines and start insert  |
|   ✓   |   {Visual}\["x]c, {Visual}\["x]s   |   Delete the highlighted text and start insert   |
|   ✓   |   {Visual}\["x]r{char}   |   Replace all selected characters by {char}   |
|   ✓   |   {Visual}\["x]C   |   Delete the highlighted lines and start insert  |
|   ✓   |   {Visual}\["x]S   |   Delete the highlighted lines and start insert   |
|   ✓   |   {Visual}\["x]R   |   Like {Visual}["x]S   |


## simple-change

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   r{char}   |   Replace the character under the cursor with {char}    |
|   ✓   |   ~   |    Switch case of the character under the cursor and move the cursor to the right   |
|   ✓   |   g~{motion}   |   switch case of {motion} text   |
|   ✓   |   g~g~ g~~   |   Switch case of current line   |
|   ✓   |   {Visual}~   |   Switch case of highlighted text   |
|   ✓   |   {Visual}U   |   Make highlighted text uppercase   |
|   ✓   |   gU{motion}   |   Make {motion} text uppercase   |
|   ✓   |   gUgU gUU   |   Make current line uppercase   |
|   ✓   |   {Visual}u   |   Make highlighted text lowercase   |
|   ✓   |   gu{motion}   |   Make {motion} text lowercase   |
|   ✓   |   gugu guu   |   Make current line lowercase   |
|       |   CTRL-A   |   Add [count] to the number or alphabetic character at or after the cursor   |
|       |   CTRL-X   |   Subtract [count] from the number or alphabetic character at or after the cursor   |


## shift-left-right

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   <{motion}   |   Decrease {motion} lines one indent   |
|   ✓   |   <<   |   Decrease [count] lines one indent   |
|   ✓   |   {Visual}\[count]<   |    Decrease highlighted lines lines [count] indent   |
|   ✓   |    >{motion}   |   Increase {motion} lines one indent   |
|   ✓   |    >>   |   Increase [count] lines one indent   |
|   ✓   |   {Visual}\[count]>   |   Increase highlighted lines lines [count] indent    |


## complex-change

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓ ★   |   ={motion}   |   Filter {motion} lines. Note: base on "Format Selection" action    |
|   ✓ ★   |   ==   |   Filter [count] lines like with ={motion}. Note: as above    |
|   ✓ ★   |   {Visual}=   |   Filter the highlighted lines like with ={motion}. Note: as above    |


## copy-move

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   \["x]y{motion}   |   Yank {motion} text [into register x]  |
|   ✓   |   \["x]yy   |   Yank [count] lines   |
|   ✓   |   \["x]Y   |   yank [count] lines   |
|   ✓   |   {Visual}\["x]y   |   Yank the highlighted text   |
|   ✓   |   {Visual}\["x]Y   |   Yank the highlighted lines   |
|   ✓   |   \["x]p   |   Put the text [from register x] after the cursor [count] times   |
|   ✓   |   \["x]P   |   Put the text [from register x] before the cursor [count] times   |
|   ✓   |   \["x]gp   |   Like "p", but leave the cursor just after the new text   |
|   ✓   |   \["x]gP   |   Like "P", but leave the cursor just after the new text   |
|       |   \["x]]p   |   Like "p", but adjust the indent to the current line   |
|       |   \["x][p   |   Like "p", but adjust the indent to the current line   |


## inserting

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   a   |   Append text after the cursor [count] times  |
|   ✓   |   A   |   Append text at the end of the line [count] times  |
|   ✓   |   i   |   Insert text before the cursor [count] times  |
|   ✓   |   I   |   Insert text before the first non-blank in the line [count] times  |
|   ✓   |   o   |   Begin a new line below the cursor and insert text, repeat [count] times  |
|   ✓   |   O   |   Begin a new line above the cursor and insert text, repeat [count] times  |


## visual-mode

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓   |   v   |   start Visual mode per character  |
|   ✓   |   V   |   start Visual mode linewise |
|   !️   |   gv   |   Start Visual mode with the same area as the previous area and the same mode  |
|   ✓️   |   o   |   Go to Other end of highlighted text  |


## repeat undo-redo

|   Status   |   Keys   |   Description   |
|   -   |   -   |   -   |
|   ✓ ★   |   u   |   Undo [count] changes. Note: base on native undo-redo, may not work as expected   |
|   ✓ ★   |   CTRL-R   |   Redo [count] changes which were undone. Note: As above   |
|   !   |   .   |   Repeat last change, with count replaced with [count]  |
