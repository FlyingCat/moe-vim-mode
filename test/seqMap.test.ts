import { assert  } from "chai";
import { createSeqMap, SeqMap, searchSeqMap } from "../src/matching/seqMap";

suite('seq map', function() {
    test('all', function() {
        let dict = {
            w: 'word',
            gj: 'down',
            gk: 'up',
            hello: 'world',
        };
        let list: {seq: string[], val: string}[] = [];
        for (let k in dict) {
            list.push({seq: k.split(''), val: dict[k]});
        }
        let map = createSeqMap(list);
        assert.equal(map.get('w'), 'word');
        assert.equal(searchSeqMap(map, 'hello'.split('')), 'world');
        let map2 = map.get('g');
        assert.isTrue(map2 !== undefined && (typeof map2 !== 'string'));
        map2 = map2 as SeqMap<string, string>;
        assert.equal(map2.get('j'), 'down');
        assert.equal(map2.get('k'), 'up');
    });
});
