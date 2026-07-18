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

### `getAppInstance()` (recommended for early code)

The `Server` constructor is what sets the `appInstance` singleton. Code that reads the raw `appInstance` binding **before** the `Server` is constructed — module scope, lazy imports, external modules — sees `undefined` and fails later with an opaque `TypeError: cannot read properties of undefined` that gives no hint at the cause.

Prefer the `getAppInstance()` getter in that code: it returns the same singleton, or throws a guided error when nothing is set yet.

```ts
import { getAppInstance } from "@adaptivestone/framework/helpers/appInstance.js";

const app = getAppInstance();
const Model = app.getModel("ModelName");
```

If the singleton is not set, the getter throws:

```text
App instance is not initialized yet — construct the Server first (its constructor sets the singleton). In tests, use setAppInstance() to inject one and resetAppInstance() to clear it.
```

:::note Test hooks

The same module exports `setAppInstance(app)` and `resetAppInstance()` for tests that need to run app-instance-dependent code without a full `Server`. `setAppInstance` throws if an instance is already set (only one `Server` per process is supported), and `resetAppInstance()` clears it. Prefer the per-file isolation provided by the shipped Node.js or Vitest test adapters, and reach for `resetAppInstance()` only when a runner can't isolate per file (it does **not** clean up mongoose-registered models, Redis client state, or environment variables).

:::

## Redis connection

A simplified way to connect to Redis. This helper loads the configuration and adds shutdown hooks.

:::note

`@redis/client` is an **optional peer dependency**. Install it (`npm i @redis/client`) before using this helper or the redis cache / rate-limiter driver. A project on the default in-memory cache never loads it.

:::

```ts
import { getRedisClient, getRedisClientSync } from '@adaptivestone/framework/helpers/redis/redisConnection.js';
const redisClient = await getRedisClient();
const redisClientSync = await getRedisClientSync();
```

The only difference is that `getRedisClientSync` returns the Redis client immediately and establishes the connection in the background.

## Validation schema (`defineSchema`)

A zero-dependency way to build a [Standard Schema](https://standardschema.dev/) validator from a plain function — for simple `request:` / `query:` schemas, without pulling in a validator library. The framework itself uses it, so it ships validator-free.

```ts
import { defineSchema } from "@adaptivestone/framework/services/validate/defineSchema.js";

const loginSchema = defineSchema<{ email: string }>((value) => {
  const v = (value ?? {}) as Record<string, unknown>;
  if (typeof v.email !== "string" || !v.email.includes("@")) {
    return { issues: [{ message: "validation.email", path: ["email"] }] };
  }
  // Return only known keys — unknown input is stripped by construction.
  return { value: { email: v.email } };
});
```

The `Output` generic (`{ email: string }`) feeds the typed handler signature — codegen reads `StandardSchemaV1.InferOutput`. Return `{ value }` on success or `{ issues }` on failure; each message is an i18n key or literal text. For richer or deeply-nested validation, bring zod / valibot / arktype / yup as the route schema instead — `defineSchema` has no combinators on purpose. See [Routes → Validation](./06-Controllers/02-routes.md#validation).

## Uploaded-file type (`File`)

A vendor-neutral type for files uploaded via `multipart/form-data`. It aliases the parser's file class today and re-points at the web-standard `File` after the transport-neutral parser swap, so your validation code stays stable across that change.

```ts
import { File } from "@adaptivestone/framework/types.js";
import { z } from "zod";

request: z.object({
  avatar: z.array(z.instanceof(File)).length(1).transform(([f]) => f), // one file  -> File
  avatars: z.array(z.instanceof(File)),                                // many files -> File[]
});
```

`File` is exported as both a value (for `instanceof`) and a type. Every multipart field arrives as an array, so declare cardinality with your validator's array support. See [Routes → File Validation](./06-Controllers/02-routes.md#file-validation).

:::warning Deprecated: `YupFile`
The older yup-specific `YupFile` helper (`@adaptivestone/framework/helpers/yup.js`) is **deprecated and will be removed in v6** — it now emits a runtime `DeprecationWarning` (escalate it to a thrown error with Node's `--throw-deprecation`). Migrate to the `File` export above; it works with any validator and needs no yup.
:::
