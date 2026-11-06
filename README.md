# ⚙️ async-kit

Tiny dependency-free async helpers for TypeScript / Node ≥ 18: **retry** with backoff, **timeout**, **concurrency limit**, and **TTL memoize**.
Маленькая библиотека без зависимостей для асинхронного кода: повторы, таймауты, ограничение параллелизма, кэш.

```bash
npm install async-kit   # or copy src/index.ts — it's a single file
```

```ts
import { retry, withTimeout, mapLimit, memoizeAsync } from "async-kit";

// retry with exponential backoff (100ms, 200ms, ...)
const data = await retry(() => fetch(url).then((r) => r.json()), { retries: 5 });

// fail if it takes too long
await withTimeout(fetch(url), 3000); // throws TimeoutError

// at most 4 requests at once, results keep input order
const pages = await mapLimit(urls, 4, (u) => fetch(u).then((r) => r.text()));

// cache for 1 minute, concurrent calls share one request, errors aren't cached
const getUser = memoizeAsync((id: number) => fetchUser(id), { ttl: 60_000 });
```

| Function | What it does |
|---|---|
| `retry(fn, {retries, delay, maxDelay, shouldRetry})` | Retries with exponential backoff, rethrows last error |
| `withTimeout(promise, ms)` | Rejects with `TimeoutError` |
| `pLimit(n)` / `mapLimit(items, n, fn)` | Bounded concurrency |
| `memoizeAsync(fn, {ttl, key})` | TTL cache with in-flight dedupe |
| `sleep(ms)` | Promise-based delay |

## Develop
```bash
npm install && npm test
```

## License
MIT
