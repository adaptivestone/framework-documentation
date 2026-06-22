# Cache

The cache subsystem is designed to store some values for quick access and a unified interface. It is useful when you have some values grabbed from an external API or some stuff that requires a lot of calculation and does not change from time to time.

Caches have an expiration time, and the developer should not worry about checking it. If a value has expired or does not exist, a callback will be executed, and its return value will be used as the value to store in the cache.

:::note

The cache subsystem handles all values and takes care of serialization/deserialization.

:::

## API

The API is simple:

```ts
  async getSetValue(
    key: string,
    onNotFound: () => Promise<any>,
    storeTime: number, // in seconds
  ): Promise<any>;
```

By default, the store time is 5 minutes. A store time of `0` means **"don't cache"** — the callback runs on every call and nothing is written.

Example:

```javascript
const cacheTime = 60 * 5; // seconds
const someValueFromCache = await this.app.cache.getSetValue(
  "someKey",
  async () => {
    const someValue = await someLongAsyncOperation();
    return someValue;
  },
  cacheTime // in seconds
);
```

:::note

You can request the same value multiple times, and only one callback will be executed. All other calls will be resolved as a Promise (the same promise).

```js
const promiseArr = [];
for (let n = 0; n < 100; n++) {
  promiseArr.push(
    this.app.cache.getSetValue(
      "someKey",
      async () => {
        // Will be called once! Other calls will find that "someKey" is already processing and return the same Promise.
        const someValue = await someLongAsyncOperation();
        return someValue;
      },
      3600
    )
  );
}
```

Please note that it works that way **per process**, as checking promises happens at the process level and is not synchronized via a master process.

:::

## Drivers

The cache is built on a small `CacheDriver` interface (`get` / `set` / `del`), with two first-party drivers:

- **`memory`** — **the default.** A per-process `Map` with per-key TTL. Needs no external service, so a plain install works out of the box and never loads `@redis/client`. Because it is per-process, each clustered worker has its own cache — fine for development and single-node deployments.
- **`redis`** — a shared cache backed by Redis. Use this for **multi-node deployments** (or anywhere multiple processes must see the same cached values). It lazy-loads `@redis/client`, which is an **optional peer dependency** — install it yourself (`npm i @redis/client`) when you select this driver.

The orchestration around the driver — namespacing, single-flight request dedup, serialization, and fail-soft degradation (a cache outage degrades to running your callback, it never fails the request) — is identical across drivers.

## Configuration

The driver is selected in `config/cache.ts`:

```ts title="config/cache.ts"
export default {
  // 'memory' (default) or 'redis'. Overridable via the CACHE_DRIVER env var.
  driver: (process.env.CACHE_DRIVER || "memory") as "memory" | "redis",
};
```

Two related settings live in `config/redis.ts` rather than here, because they are **shared with the rate limiter**:

- **`namespace`** — a key prefix applied to **every** cache (and rate-limiter) key, regardless of driver. Despite living in `redis.ts`, it is _not_ redis-specific: the in-memory driver prefixes its keys with it too. Think of it as a keyspace/tenant label (e.g. per environment). Keeping it in one place means the cache and rate limiter never drift apart, and the test helper `setTestRedisNamespace` can isolate both with a single switch.
- **`url`** — the Redis connection string, used only by the `redis` backends (this cache and the rate limiter's redis driver share one client). Irrelevant when both run on non-redis drivers.

:::tip Custom driver

You can supply your own backend by setting `driver` to an object implementing `CacheDriver` (`get`, `set`, `del`) instead of a string.

:::
