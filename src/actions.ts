import { CommandFunction, createCommand } from "./command";
import * as monnaco from "monaco-editor";
import * as P from "./matching/pattern";
import * as keyUtils from "./utils/key";
import { RevealType, PositionLiveType } from "./text/position";

const commands: {[k: string]: CommandFunction} = {
    'z<CR>': (ctx) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        ctx.position.get().setColumn('^').reveal(RevealType.Top).live(liveType);
    },
    'zt': (ctx) => {
        ctx.position.get().reveal(RevealType.Top);
    },
    'z.': (ctx) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        ctx.position.get().setColumn('^').reveal(RevealType.Center).live(liveType);
    },
    'zz': (ctx) => {
        ctx.position.get().reveal(RevealType.Center);
    },
    'z-': (ctx) => {
        let liveType = ctx.vimState.isVisual() ? PositionLiveType.PrimarySelectionActive : PositionLiveType.PrimaryCursor;
        ctx.position.get().setColumn('^').reveal(RevealType.Bottom).live(liveType);
    },
    'zb': (ctx) => {
        ctx.position.get().reveal(RevealType.Bottom);
    },
};

const list: P.Pattern[] = [];

for (let k in commands) {
    let cmd = P.setCommand(createCommand(commands[k]));
    list.push(P.concat(keyUtils.parseToPattern(k), cmd));
}

export const actionsPattern = P.alternateList(list);
