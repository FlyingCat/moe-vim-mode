import { assert  } from "chai";
import * as P from "../src/matching/pattern"
import { Program, StepMatched } from "../src/matching/program";
import { createSeqMap, searchSeqMap } from "../src/matching/seqMap";
import { motionPattern, MotionFunction } from "../src/motions";
import { ICommand, createCommand } from "../src/command";

const source = 'test';

function expectMatch(prog: Program, s: string) {
    let keys = s.split('').map(c => c.charCodeAt(0));
    for (let i = 0; i < keys.length; i++) {
        let r = prog.step(source, keys[i]);
        if (i !== keys.length - 1) {
            assert.equal(r.kind, 'Waiting');
        }
        else {
            assert.equal(r.kind, 'Matched');
            return (r as StepMatched).capture;
        }
    }
}

function expectFail(prog: Program, s: string) {
    let keys = s.split('').map(c => c.charCodeAt(0));
    for (let i = 0; i < keys.length; i++) {
        let r = prog.step(source, keys[i]);
        if (i !== keys.length - 1) {
            assert.equal(r.kind, 'Waiting');
        }
        else {
            assert.equal(r.kind, 'Fail');
        }
    }
}

suite('program', function() {
    test('literals', function() {
        let patt = P.concatList('diw'.split('').map(c => P.key(c)));
        let prog = new Program(patt);

        expectMatch(prog, 'diw');

        assert.equal(prog.getInputs().length, 0);
        assert.equal(prog.getSource(), null);

        expectFail(prog, 'dw');

        assert.equal(prog.getInputs().length, 0);
        assert.equal(prog.getSource(), null);

        expectMatch(prog, 'diw');
    });
    test('alt', function() {
        let patt = P.alternateList([
            P.concatList('diw'.split('').map(c => P.key(c))),
            P.concatList('ciw'.split('').map(c => P.key(c))),
            P.concatList('viw'.split('').map(c => P.key(c)))
        ]) ;
        let prog = new Program(patt);

        expectMatch(prog, 'diw');
        expectMatch(prog, 'ciw');
        expectMatch(prog, 'viw');

        expectFail(prog, 'y');
        expectFail(prog, 'da');
        expectFail(prog, 'cw');
    });
    test('with capture', function() {
        let dumbMotion: MotionFunction = (ctx, pos, count) => ({lineNumber: 1, column: 1});
        let dumbCommand: ICommand = createCommand((ctx, cap) => {});
        let patt = P.concatList([P.common.registerPart, P.common.countPart, P.key('d'), P.common.linewisePart, P.common.countPart, P.key('w'), P.setMotion(dumbMotion), P.setCommand(dumbCommand)]);
        let prog = new Program(patt);

        let cap: P.IMatchCapture;

        cap = expectMatch(prog, 'dw')!;
        assert.equal(cap.motion, dumbMotion);
        assert.equal(cap.command, dumbCommand);

        cap = expectMatch(prog, '8dw')!;
        assert.equal(cap.count, 8);

        cap = expectMatch(prog, 'd10w')!;
        assert.equal(cap.count, 10);

        cap = expectMatch(prog, '10d8w')!;
        assert.equal(cap.count, 80);

        cap = expectMatch(prog, 'dvw')!;
        assert.isTrue(cap.linewise === false);

        cap = expectMatch(prog, 'dVw')!;
        assert.isTrue(cap.linewise === true);

        cap = expectMatch(prog, '"110dw')!;
        assert.equal(cap.register, 1);
        assert.equal(cap.count, 10);

        cap = expectMatch(prog, '2"a2d2w')!;
        assert.equal(cap.register, 10);
        assert.equal(cap.count, 8);

        expectFail(prog, '0');
        expectFail(prog, 'd0');
        expectFail(prog, 'dv0');
    });
    test('seq', function() {
        let motions:{[k: string]: MotionFunction} = {
            w: (ctx, pos, count) => ({lineNumber: 1, column: 1}),
            gj: (ctx, pos, count) => ({lineNumber: 1, column: 1}),
            gk: (ctx, pos, count) => ({lineNumber: 1, column: 1}),
        };
        let list: {seq: number[], val: MotionFunction}[] = [];
        for (let k in motions) {
            list.push({seq: k.split('').map(c => c.charCodeAt(0)), val: motions[k]});
        }
        let map = createSeqMap(list);
        let motionPatt = P.seq(map, (c, v) => c.motion = v);

        let moCommand: ICommand = createCommand((ctx, cap) => {});
        let opCommand: ICommand = createCommand((ctx, cap) => {});

        let patt = P.alternateList([
            P.concatList([motionPatt, P.setCommand(moCommand)]),
            P.concatList([P.key('d'), motionPatt, P.setCommand(opCommand)]),
        ]);
        let prog = new Program(patt);

        let cap: P.IMatchCapture;

        cap = expectMatch(prog, 'w')!;
        assert.equal(cap.motion, motions['w']);
        assert.equal(cap.command, moCommand);

        cap = expectMatch(prog, 'gj')!;
        assert.equal(cap.motion, motions['gj']);
        assert.equal(cap.command, moCommand);

        cap = expectMatch(prog, 'gk')!;
        assert.equal(cap.motion, motions['gk']);
        assert.equal(cap.command, moCommand);

        cap = expectMatch(prog, 'dw')!;
        assert.equal(cap.motion, motions['w']);
        assert.equal(cap.command, opCommand);

        expectFail(prog, 'dj');
        expectFail(prog, 'j');
        expectFail(prog, 'k');
    });
});
