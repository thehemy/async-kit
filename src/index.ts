export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface RetryOptions {
  /** Total attempts including the first one. Default 3. */
  retries?: number;
  /** Initial delay in ms; doubles each attempt (exponential backoff). Default 100. */
  delay?: number;
  /** Upper bound for a single delay. Default 30_000. */
  maxDelay?: number;
  /** Return false to stop retrying for a given error. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/** Run `fn` until it succeeds or attempts run out. Rethrows the last error. */
export async function retry<T>(fn: (attempt: number) => Promise<T> | T, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, delay = 100, maxDelay = 30_000, shouldRetry = () => true } = opts;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error, attempt)) throw error;
      await sleep(Math.min(delay * 2 ** (attempt - 1), maxDelay));
    }
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/** Reject with TimeoutError if `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Create a limiter that runs at most `concurrency` tasks at once. */
export function pLimit(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError("concurrency must be an integer >= 1");
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return async function limit<T>(task: () => Promise<T> | T): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      next();
    }
  };
}

/** Map over items with bounded concurrency; results keep input order. */
export function mapLimit<T, R>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<R> | R): Promise<R[]> {
  const limit = pLimit(concurrency);
  return Promise.all(items.map((item, i) => limit(() => fn(item, i))));
}

/** Cache async results by key for `ttl` ms; concurrent calls share one in-flight promise. Failures are not cached. */
export function memoizeAsync<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  { ttl = 60_000, key = (...args: A) => JSON.stringify(args) }: { ttl?: number; key?: (...args: A) => string } = {},
): (...args: A) => Promise<R> {
  const cache = new Map<string, { expires: number; value: Promise<R> }>();
  return (...args: A) => {
    const k = key(...args);
    const hit = cache.get(k);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = fn(...args);
    cache.set(k, { expires: Date.now() + ttl, value });
    value.catch(() => cache.get(k)?.value === value && cache.delete(k));
    return value;
  };
}
