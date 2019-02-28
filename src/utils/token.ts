import * as monaco from "monaco-editor";

const enum StandardTokenType {
	Other = 0,
	Comment = 1,
	String = 2,
	RegEx = 4
}

export function isCommentOrStringAtPosition(model: monaco.editor.ITextModel, pos: monaco.IPosition) {
    try {
        (model as any).forceTokenization(pos.lineNumber);
        let tokens = (model as any).getLineTokens(pos.lineNumber);
        let tokenIndex = tokens.findTokenIndexAtOffset(pos.column - 1);
        let type = tokens.getStandardTokenType(tokenIndex);
        return type !== StandardTokenType.Other;
    }
    catch {}
    return false;
}

