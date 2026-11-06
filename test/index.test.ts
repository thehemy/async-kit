import { test } from "node:test";
import assert from "node:assert/strict";
import { retry, withTimeout, TimeoutError, pLimit, mapLimit, memoizeAsync, sleep } from "../src/index.js";

test("retry succeeds after failures", async () => {
  let calls = 0;
  const r = await retry(() => { if (++calls < 3) throw new Error("x"); return "ok"; }, { delay: 1 });
  assert.equal(r, "ok");
  assert.equal(calls, 3);
});

test("retry rethrows last error and honours shouldRetry", async () => {
  let calls = 0;
  await assert.rejects(retry(() => { calls++; throw new Error("boom"); }, { retries: 2, delay: 1 }), /boom/);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(retry(() => { calls++; throw new Error("fatal"); }, { delay: 1, shouldRetry: () => false }));
  assert.equal(calls, 1);
});

test("withTimeout", async () => {
  await assert.rejects(withTimeout(sleep(50), 5), TimeoutError);
  assert.equal(await withTimeout(Promise.resolve(1), 50), 1);
});

test("pLimit never exceeds concurrency and mapLimit keeps order", async () => {
  let active = 0, peak = 0;
  const out = await mapLimit([30, 10, 20, 5, 1], 2, async (ms) => {
    peak = Math.max(peak, ++active);
    await sleep(ms);
    active--;
    return ms * 2;
  });
  assert.deepEqual(out, [60, 20, 40, 10, 2]);
  assert.equal(peak, 2);
  assert.throws(() => pLimit(0), RangeError);
});

test("memoizeAsync dedupes, expires, and does not cache errors", async () => {
  let calls = 0;
  const f = memoizeAsync(async (n: number) => { calls++; return n; }, { ttl: 20 });
  await Promise.all([f(1), f(1), f(1)]);
  assert.equal(calls, 1);
  await sleep(30);
  await f(1);
  assert.equal(calls, 2);

  let fails = 0;
  const g = memoizeAsync(async () => { if (++fails === 1) throw new Error("no"); return "yes"; });
  await assert.rejects(g());
  assert.equal(await g(), "yes");
});
