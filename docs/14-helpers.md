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

const files = (v: unknown) => Array.isArray(v) && v.every((f) => f instanceof File);

request: z.object({
  avatar: z
    .custom<File[]>(files, "not a file")
    .refine((a) => a.length === 1, "send one file")
    .transform(([f]) => f),                       // one file   -> File
  avatars: z.custom<File[]>(files, "not a file"), // many files -> File[]
});
```

`File` is exported as both a value (for `instanceof`) and a type. A file field always arrives as an array (one file is a one-element array). Check the array as a whole, as `files` does, so an error stays under the field name; a check on each element reports `avatar[0]`. The same check works with other validators: valibot `v.custom<File[]>(files, "not a file")`, yup `mixed<File[]>().test("file", "not a file", files)`. A missing field fails it; for an optional field, let `files` also accept `undefined`. See [Routes → File Validation](./06-Controllers/02-routes.md#file-validation).

As a type, `File` has the upload fields a handler reads: `filepath`, `mimetype`, `originalFilename` and `size`.

:::info Upgrading to 5.7.0

Before, a `File` annotation resolved to the global web `File`. It now types an upload. Code that read web `File` members from it, which were never there at runtime, no longer compiles.

:::

:::warning Deprecated: `YupFile`
The older yup-specific `YupFile` helper (`@adaptivestone/framework/helpers/yup.js`) is **deprecated and will be removed in v6** — it now emits a runtime `DeprecationWarning` (escalate it to a thrown error with Node's `--throw-deprecation`). Migrate to the `File` export above; it works with any validator and needs no yup.
:::

## Hashing secrets

Never store a secret in plain text. Pick the hash by what you store:

| You store | Use | Why |
| --- | --- | --- |
| A long random token (session, recovery link) | `hashToken` from `models/User.js` | Fast; 256 random bits cannot be guessed |
| A short code (e-mail/SMS login, reset code) | `hashSecret` / `verifySecret` from `helpers/crypto.js` | Keyed with `AUTH_SALT`, so a leaked hash cannot be brute-forced offline |
| A user password | `hashPassword` / `verifyPassword` from `helpers/crypto.js` | Deliberately slow per guess |

```ts
import { hashSecret, verifySecret } from "@adaptivestone/framework/helpers/crypto.js";

const LOGIN_CODE = { purpose: "email-login" };

// when sending the code
loginCode.codeHash = hashSecret(code, LOGIN_CODE);

// when the user submits it (constant-time comparison)
const valid = verifySecret(submittedCode, loginCode.codeHash, LOGIN_CODE);
```

- `purpose` names the feature. A hash made for one purpose never verifies under another, so give each feature its own.
- The protection is `AUTH_SALT` staying out of the database. Anyone holding both finds a 6-digit code instantly, so keep codes short-lived and limit attempts.
- Rotating `AUTH_SALT` invalidates every stored code hash. That suits codes that expire in minutes; reissue them after a rotation.
- Hash exactly what you compare: normalize input (for example, strip spaces) before both calls.

### Comparing secrets

To check a secret you hold in configuration — an API key, a webhook secret, a probe token — never use `===`: its timing reveals how much of the guess matched. Use `timingSafeEqualStrings`, which also hides the secret's length:

```ts
import { timingSafeEqualStrings } from "@adaptivestone/framework/helpers/crypto.js";

const apiKey = process.env.API_KEY;
const sent = req.headers["x-api-key"];
// Require a configured key: two empty strings are equal too.
const valid = !!apiKey && typeof sent === "string" && timingSafeEqualStrings(sent, apiKey);
```

## Password policy (`passwordPolicyIssues`)

Since 5.7, your own password endpoints (settings, admin reset, invite acceptance) can apply the policy that the built-in registration and password reset use: `auth.passwordPolicy` (15–128 Unicode code points by default), with the same translated messages.

```ts
import { passwordPolicyIssues } from "@adaptivestone/framework/helpers/passwordPolicy.js";
import { BadRequestError } from "@adaptivestone/framework/services/http/httpErrors.js";

const issues = passwordPolicyIssues(req.appInfo.request.newPassword, "newPassword");
if (issues.length) {
  throw new BadRequestError({ code: "VALIDATION_FAILED", message: "Validation failed", errors: issues });
}
// → 400 {"error": "VALIDATION_FAILED", "message": "Validation failed",
//        "errors": {"newPassword": ["Password must be at least 15 characters"]}}
```

It returns an empty list for a password that fits the policy, and otherwise the issues under the field you name (`password` by default), with the `auth.passwordProvided`, `auth.passwordTooShort` or `auth.passwordTooLong` key. An invalid `auth.passwordPolicy` throws, as it does for the built-in endpoints.
