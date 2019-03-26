import { assert  } from "chai";
import * as P from "../src/matching/pattern"
import { Program, StepMatched } from "../src/matching/program";
import { ICommand, IMotion } from "../src/boot/base";

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
    test('routine', function() {
        let patt = P.concat(P.key('g'), P.routine(P.alternateList([
            P.concat(P.routine(P.key('d')), P.key('w')),
            P.concat(P.routine(P.key('c')), P.key('e')),
        ])));
        let prog = new Program(patt);

        expectMatch(prog, 'gdw');
        expectMatch(prog, 'gce');

        expectFail(prog, 'gdc');
        expectFail(prog, 'gcd');
    });
    test('with capture', function() {
        let dumbMotion: IMotion = { run: (ctx, pos, count) => ({lineNumber: 1, column: 1}) };
        let dumbCommand: ICommand = { run: ((ctx, cap) => {}) };
        let patt = P.concatList([P.common.registerPart, P.common.countPart, P.key('d'), P.common.linewisePart, P.common.countPart, P.key('w'), P.writeMotion(dumbMotion), P.writeCommand(dumbCommand)]);
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
});
