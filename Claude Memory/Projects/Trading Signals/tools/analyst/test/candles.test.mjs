import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CandleStore, TF_MS, TFS, aggregate, bucketStart, normalizeCandle } from '../lib/engine/candles.mjs';
import { mkCandles, loadFixture } from './helpers.mjs';

const H4 = TF_MS['4h'];
const sum = (arr, k) => arr.reduce((a, c) => a + (c[k] ?? 0), 0);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe('TF_MS / bucketStart', () => {
  test('timeframes are the five the spec names, in ms', () => {
    assert.deepEqual(TF_MS, { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000 });
    assert.deepEqual(TFS, ['1m', '5m', '15m', '1h', '4h']);
  });
  test('4h buckets align to 00/04/08… UTC regardless of where the data starts', () => {
    const t = Date.UTC(2026, 9, 3, 10, 17); // 10:17 UTC
    assert.equal(bucketStart(t, '4h'), Date.UTC(2026, 9, 3, 8, 0));
    assert.equal(bucketStart(Date.UTC(2026, 9, 3, 23, 59), '4h'), Date.UTC(2026, 9, 3, 20, 0));
    assert.equal(bucketStart(Date.UTC(2026, 9, 3, 0, 0), '4h'), Date.UTC(2026, 9, 3, 0, 0));
    assert.equal(bucketStart(t, '1h'), Date.UTC(2026, 9, 3, 10, 0));
    assert.equal(bucketStart(t, '15m'), Date.UTC(2026, 9, 3, 10, 15));
    assert.equal(bucketStart(t, '5m'), Date.UTC(2026, 9, 3, 10, 15));
  });
});

describe('normalizeCandle', () => {
  test('coerces strings, derives sellV, repairs h/l to contain o/c', () => {
    const c = normalizeCandle({ t: '60000', o: '10', h: '9', l: '11', c: '12', v: '3', buyV: '2', n: '7' });
    assert.deepEqual(c, { t: 60000, o: 10, h: 12, l: 10, c: 12, v: 3, closed: true, buyV: 2, sellV: 1, n: 7 });
  });
  test('rejects garbage loudly', () => {
    assert.throws(() => normalizeCandle({ t: 60000, o: 1, h: NaN, l: 1, c: 1, v: 1 }), /non-finite/);
    assert.throws(() => normalizeCandle({ t: 61000, o: 1, h: 1, l: 1, c: 1, v: 1 }), /minute-aligned/);
    assert.throws(() => normalizeCandle(null), TypeError);
  });
});

describe('aggregate (pure)', () => {
  test('4h candles align to 00/04/08 and sum v/buyV/sellV/n over exactly their children', () => {
    const start = Date.UTC(2026, 0, 5, 3, 30); // start mid-bucket: first 4h bucket is 00:00, partial
    const c1 = mkCandles({ n: 24 * 60, start });
    const h4 = aggregate(c1, '4h');
    assert.equal(h4[0].t, Date.UTC(2026, 0, 5, 0, 0));
    for (const c of h4) assert.equal(c.t % H4, 0);
    assert.equal(h4.length, 7); // 00 (partial), 04, 08, 12, 16, 20, 00 next day (partial)
    for (const bucket of h4) {
      const kids = c1.filter((c) => bucketStart(c.t, '4h') === bucket.t);
      near(bucket.v, sum(kids, 'v'));
      near(bucket.buyV, sum(kids, 'buyV'));
      near(bucket.sellV, sum(kids, 'sellV'));
      assert.equal(bucket.n, sum(kids, 'n'));
      assert.equal(bucket.o, kids[0].o);
      assert.equal(bucket.c, kids[kids.length - 1].c);
      assert.equal(bucket.h, Math.max(...kids.map((k) => k.h)));
      assert.equal(bucket.l, Math.min(...kids.map((k) => k.l)));
    }
    // every full bucket is closed; the trailing partial one (its last child 03:29 next day is not 03:59) is not
    assert.ok(h4.slice(0, -1).every((c) => c.closed));
    assert.equal(h4[h4.length - 1].closed, false);
    // the LEADING bucket began at 03:30, not 00:00: flagged partial (truncated o/h/l/v); every later bucket is not
    assert.equal(h4[0].partial, true);
    assert.ok(h4.slice(1).every((c) => c.partial === undefined));
    assert.equal(aggregate(mkCandles({ n: 300, start: Date.UTC(2026, 0, 5, 4, 0) }), '4h')[0].partial, undefined, 'a bucket-aligned start is whole');
  });
  test('1m passthrough copies; unknown tf throws', () => {
    const c1 = mkCandles({ n: 3 });
    const out = aggregate(c1, '1m');
    assert.deepEqual(out, c1);
    assert.notEqual(out[0], c1[0]);
    assert.throws(() => aggregate(c1, '2h'), /unknown timeframe/);
  });
});

describe('CandleStore', () => {
  test('applyHistory sorts, dedupes by t, bounds memory, aggregates every TF', () => {
    const c1 = mkCandles({ n: 600, start: Date.UTC(2026, 0, 5, 0, 0) });
    const shuffled = [...c1].reverse();
    shuffled.push({ ...c1[10], c: 999, h: 999 }); // duplicate t — later one wins
    const store = new CandleStore({ maxPerTf: 500 });
    assert.deepEqual(store.applyHistory(shuffled), { count: 500 });
    assert.equal(store.size('1m'), 500);
    assert.equal(store.get('1m')[0].t, c1[100].t);
    const full = new CandleStore({ maxPerTf: 5000 });
    full.applyHistory(shuffled);
    assert.equal(full.get('1m')[10].c, 999);
    assert.equal(full.size('5m'), 120);
    assert.equal(full.size('4h'), 3); // 00:00, 04:00, 08:00 (600 min = 10 h)
    assert.equal(full.get('4h')[2].closed, false);
    assert.equal(full.get('4h')[1].closed, true);
  });

  test('forming prints replace themselves (no double counting) and closing cascades to the right TFs', () => {
    const start = Date.UTC(2026, 0, 5, 3, 55); // 5 minutes before the 04:00 4h boundary
    const c1 = mkCandles({ n: 12, start });
    const store = new CandleStore({ maxPerTf: 100 });
    store.applyHistory(c1.slice(0, 4)); // 03:55..03:58 closed
    const c59 = c1[4]; // 03:59 — last child of 5m, 15m, 1h, 4h buckets
    const forming1 = { ...c59, closed: false, c: c59.o + 1, h: c59.o + 1, v: 1, buyV: 1, sellV: 0, n: 1 };
    const forming2 = { ...c59, closed: false, c: c59.o + 2, h: c59.o + 2, v: 2, buyV: 1, sellV: 1, n: 2 };
    let r = store.applyCandle(forming1);
    assert.deepEqual(r, { updated: ['1m', '5m', '15m', '1h', '4h'], closed: [] });
    r = store.applyCandle(forming2);
    assert.deepEqual(r.closed, []);
    const prior = c1.slice(0, 4);
    near(store.last('5m').v, sum(prior, 'v') + 2);
    near(store.last('4h').v, sum(prior, 'v') + 2);
    assert.equal(store.last('4h').n, sum(prior, 'n') + 2);
    assert.equal(store.last('4h').h, Math.max(...prior.map((c) => c.h), c59.o + 2));
    assert.equal(store.last('1m').closed, false);
    assert.equal(store.closed('1m').length, 4);
    // final print closes 1m and every bucket that ends at 04:00
    r = store.applyCandle(c59);
    assert.deepEqual(r.closed, ['1m', '5m', '15m', '1h', '4h']);
    for (const tf of TFS) assert.equal(store.last(tf).closed, true, tf);
    near(store.last('4h').v, sum(c1.slice(0, 5), 'v'));
    // next minute opens new buckets everywhere
    r = store.applyCandle({ ...c1[5], closed: false });
    assert.deepEqual(r, { updated: ['1m', '5m', '15m', '1h', '4h'], closed: [] });
    assert.equal(store.last('4h').t, Date.UTC(2026, 0, 5, 4, 0));
    assert.equal(store.size('4h'), 2);
    // The 00:00 bucket holds 5 of 240 children (history began 03:55): it is flagged partial and is NOT a closed bar (review finding candles.mjs:251).
    assert.equal(store.get('4h')[0].partial, true);
    assert.equal(store.get('4h')[0].closed, true, 'it did close — the next bucket started');
    assert.equal(store.lastClosed('4h'), undefined, 'a leading partial bucket is never served as the last closed bar');
    assert.deepEqual(store.closed('4h'), []);
    assert.equal(store.get('4h')[1].partial, undefined, 'the 04:00 bucket started on its own first minute');
  });

  test('a dropped final print: the forming candle is closed when the next minute arrives', () => {
    const c1 = mkCandles({ n: 10, start: Date.UTC(2026, 0, 5, 0, 0) });
    const store = new CandleStore({ maxPerTf: 100 });
    store.applyCandle({ ...c1[0], closed: false });
    const r = store.applyCandle({ ...c1[1], closed: false });
    assert.deepEqual(r.closed, ['1m']);
    assert.equal(store.get('1m')[0].closed, true);
    assert.equal(store.closed('1m').length, 1);
    near(store.last('5m').v, c1[0].v + c1[1].v);
    // the 5m bucket closes when its 5th minute closes even though minute 0 never got a final print
    for (let i = 2; i < 5; i++) store.applyCandle(c1[i]);
    assert.equal(store.last('5m').closed, true);
    // and a bucket whose last minute never arrived still closes when the next bucket starts
    for (let i = 5; i < 9; i++) store.applyCandle(c1[i]);
    const r2 = store.applyCandle({ ...c1[9], t: c1[9].t + 60000, closed: false }); // skip minute 9, jump to 10
    assert.ok(r2.closed.includes('5m'));
    assert.equal(store.get('5m')[1].closed, true);
    assert.equal(store.size('5m'), 3);
  });

  test('stale forming print after the close is ignored; late closed candle corrects an old bucket', () => {
    const c1 = mkCandles({ n: 30, start: Date.UTC(2026, 0, 5, 0, 0) });
    const store = new CandleStore({ maxPerTf: 100 });
    for (const c of c1) store.applyCandle(c);
    const closedBefore = store.last('1m');
    assert.deepEqual(store.applyCandle({ ...c1[29], closed: false, c: 1 }), { updated: [], closed: [] });
    assert.equal(store.last('1m'), closedBefore);
    // gap re-backfill: minute 7 arrives again with a higher high
    const fixed = { ...c1[7], h: c1[7].h + 50 };
    const r = store.applyCandle(fixed);
    assert.ok(r.updated.includes('5m') && r.updated.includes('1h'));
    assert.equal(store.get('1m')[7].h, fixed.h);
    assert.equal(store.get('5m')[1].h, fixed.h);
    assert.equal(store.get('5m')[1].closed, true);
    assert.equal(store.last('1h').h, fixed.h);
    assert.equal(store.size('1m'), 30);
    // an entirely missing minute inserted in order
    const store2 = new CandleStore({ maxPerTf: 100 });
    for (const c of c1) if (c.t !== c1[12].t) store2.applyCandle(c);
    assert.equal(store2.size('1m'), 29);
    store2.applyCandle(c1[12]);
    assert.equal(store2.size('1m'), 30);
    assert.equal(store2.get('1m')[12].t, c1[12].t);
    near(store2.get('5m')[2].v, sum(c1.slice(10, 15), 'v'));
    // older than the window → ignored
    const small = new CandleStore({ maxPerTf: 5 });
    for (const c of c1) small.applyCandle(c);
    assert.deepEqual(small.applyCandle(c1[0]), { updated: [], closed: [] });
    assert.equal(small.size('1m'), 5);
  });

  test('live stream equals pure aggregation on 2000 real BTC candles, with forming ticks interleaved', () => {
    const fx = loadFixture();
    const store = new CandleStore({ maxPerTf: 3000 });
    store.applyHistory(fx.slice(0, 1200));
    for (const c of fx.slice(1200)) {
      store.applyCandle({ ...c, closed: false, c: c.o, h: c.o, l: c.o, v: 0.01, buyV: 0.01, sellV: 0, n: 1 });
      store.applyCandle({ ...c, closed: false, c: c.h, v: c.v / 2, buyV: c.buyV / 2, sellV: c.sellV / 2, n: c.n - 1 });
      store.applyCandle(c);
    }
    for (const tf of TFS) {
      const got = store.get(tf), want = aggregate(fx, tf);
      assert.equal(got.length, want.length, tf);
      for (let i = 0; i < got.length; i++) {
        const g = got[i], w = want[i];
        assert.equal(g.t, w.t); assert.equal(g.o, w.o); assert.equal(g.h, w.h); assert.equal(g.l, w.l); assert.equal(g.c, w.c);
        near(g.v, w.v, 1e-6); near(g.buyV, w.buyV, 1e-6); near(g.sellV, w.sellV, 1e-6);
        assert.equal(g.n, w.n); assert.equal(g.closed, w.closed);
      }
    }
    const h4 = store.get('4h');
    assert.ok(h4.every((c) => c.t % H4 === 0));
    assert.equal(h4[0].partial, true, 'the fixture starts mid-bucket: 103 of 240 children');
    assert.equal(store.closed('4h')[0].t, h4[1].t, 'closed() starts at the first whole 4h bar');
    assert.equal(store.closed('4h', 1)[0].t, store.lastClosed('4h').t);
    near(sum(h4, 'v'), sum(fx, 'v'), 1e-6);
    near(sum(h4, 'buyV') + sum(h4, 'sellV'), sum(fx, 'v'), 1e-6);
    assert.equal(sum(h4, 'n'), sum(fx, 'n'));
  });

  test('memory is bounded per TF and reads return fresh arrays', () => {
    const store = new CandleStore({ maxPerTf: 10, tfs: ['5m'] });
    const c1 = mkCandles({ n: 100, start: Date.UTC(2026, 0, 5) });
    for (const c of c1) store.applyCandle(c);
    assert.equal(store.size('1m'), 10);
    assert.equal(store.size('5m'), 10);
    assert.equal(store.get('1m')[0].t, c1[90].t);
    // the 5m bucket aggregate is exact even though its first 1m children were dropped from the ring
    near(store.get('5m')[9].v, sum(c1.slice(95, 100), 'v'));
    near(store.get('5m')[5].v, sum(c1.slice(75, 80), 'v'));
    const a = store.get('5m'), b = store.get('5m');
    assert.notEqual(a, b);
    assert.deepEqual(a, b);
    assert.equal(store.get('5m', 3).length, 3);
    assert.equal(store.closed('5m', 2).length, 2);
    assert.throws(() => store.get('1h'), /not maintained/);
    assert.throws(() => new CandleStore({ maxPerTf: 1 }), RangeError);
    assert.throws(() => new CandleStore({ tfs: ['3m'] }), RangeError);
  });

  test('closed() excludes the forming candle; last() includes it; empty store is safe', () => {
    const store = new CandleStore();
    assert.deepEqual(store.get('1m'), []);
    assert.equal(store.last('1m'), undefined);
    assert.equal(store.lastClosed('4h'), undefined);
    const c1 = mkCandles({ n: 3, start: Date.UTC(2026, 0, 5) });
    store.applyCandle(c1[0]); store.applyCandle(c1[1]); store.applyCandle({ ...c1[2], closed: false });
    assert.equal(store.closed('1m').length, 2);
    assert.equal(store.get('1m').length, 3);
    assert.equal(store.last('1m').closed, false);
    assert.equal(store.lastClosed('1m').t, c1[1].t);
    assert.deepEqual(store.closed('5m'), []);
  });
});
