# Helpers

The framework provides some helpers to make your code easier to work with.

## App instance

You can access the app instance from anywhere.

```ts
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";
```

The app instance is the core of the framework, allowing you to retrieve models, configurations, and more.

```ts
const Model = appInstance.getModel("ModelName");
const s3config = appInstance.getConfig("s3");
// etc
```

## Redis connection

A simplified way to connect to Redis. This helper loads the configuration and adds shutdown hooks.

```ts
import { getRedisClient, getRedisClientSync } from '@adaptivestone/framework/helpers/redis/redisConnection.ts';
const redisClient = await getRedisClient();
const redisClientSync = await getRedisClientSync();
```

The only difference is that `getRedisClientSync` returns the Redis client immediately and establishes the connection in the background.
