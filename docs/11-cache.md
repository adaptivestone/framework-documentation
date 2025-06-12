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

By default, the store time is 5 minutes.

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

## Configuration

For now, the cache subsystem has no configuration. But please follow the Redis configuration, as the cache depends on it.
