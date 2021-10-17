---
sidebar_position: 13
---

# Cache

Cache subsystem designed to store some values for quick access and unified interface. It is useful when you have some values grabbed from external api or some stuff that requires a lot of calculation and not changing from time to time.

Caches have expiration time and the developer should not worry to check it. It value expired or not exist then callback will be executed and it return value will be used as value to store on cache

:::note

Cache subsystem handled all values and take care or serialization/deserialization

:::

## API

Api is simple

```js
  getSetValue(
    key: String,
    onNotFound: () => Promise<any>,
    storeTime: number, // in seconds
  ): Promise<any>;
```

By default store time 5 minutes.

Example:

```javascript
const cacheTime = 60 * 5;
this.app.cache.getSetValue(
  "someKey",
  async () => {
     const someValue = await someLongAsyncOperation();
     return someValue;
  },
  cacheTime
);
```

:::note

You can request same value multiple times and only one callback will be executed all other values will be resolved as Promise (same promise)

```js
const promiseArr = []
for (let n=0;n<100;n++){}
    promiseArr.push(this.app.cache.getSetValue(
    "someKey",
    async () => { // will be called once! Other call will find that "someKey" already processing and return same Promise
        const someValue = await someLongAsyncOperation();
        return someValue;
    },
    3600
    })
}
```

Please note that it works that way **per process** as checking promises happens on process level and not synchronized via master process.

:::

## Configuration

For now the cache subsystem has no configuration. But please follow Redis configuration as cache depend on it
