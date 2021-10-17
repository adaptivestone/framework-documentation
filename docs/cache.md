---
sidebar_position: 13
---

# Cache

TODO redis, cache idea


[NEW]new cache system (alpha, subject of change)

```javascript
const cacheTime = 60 * 5;
this.app.cache.getSetValue(
  'someKey',
  async () => {
    // function that will execute in case cache value is missed
  },
  cacheTime,
);
```