# Routes

Routes are relative to the controller route. You SHOULD NOT use the full route here.

Route objects have multiple levels.

## Route First Level (Method Level)

On the first level, only the ‘method’ (post, put, delete, etc.) exists. Only requests with these methods will go deeper into the real routes.

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        // post routes
      },
      get: {
        // get routes
      },
      put: {
        // put routes
      },
      // etc.
    };
  }
}
export default ControllerName;
```

## Route Second Level (Path Level)

Inside the methods (second level), we have a path. The framework's tree-based router supports a small, opinionated set of patterns:

```js
"/fullpath"                          // literal path
"/fullpath/:paramOne/:paramTwo"      // named params → req.params.paramOne, paramTwo
"/api/{*rest}"                       // catch-all splat → req.params.rest = "/v1/users/42"
```

| Syntax | Matches | Captures |
|---|---|---|
| `/literal` | exact segment | nothing |
| `:name` | exactly one segment | `req.params.name` |
| `{*name}` | zero or more segments to end of path | `req.params.name` (joined with `/`) |

**Specificity** (when patterns overlap): static segments win, then `:param`, then `{*splat}`. So `/users/me` registered alongside `/users/:id` always matches the literal first.

**URL decoding** is per-segment (Spring `PathPatternParser` model). `%2F` inside a `:param` value stays as `/`; the matcher does not split on it. For `{*splat}` captures, segments are decoded individually then re-joined — encoded-slash distinction is lost (documented trade-off; use raw-body mode for the rare encoded-slash case).

**Defaults**: case-insensitive, lenient trailing slash. Both flip in v6.

:::note

The order of routes matters when patterns overlap at the same specificity tier (e.g., two `:param` siblings). The first matched route is executed.
:::

Example:

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        "/someUrl": {
          handler: this.postSomeUrl,
          request: yup.object().shape({
            count: yup.number().max(100).required(),
          }),
        },
      },
    };
  }
}
export default ControllerName;
```

## Route Third Level (Route Object Level)

On the third level, we have a "route object," a special object that will describe our route.

```js
{
  handler: this.postSomeUrl, // required
  request: yup.object().shape({ // optional
    count: yup.number().max(100).required(),
  }),
  query: yup.object().shape({ // optional
    page: yup.number().required(),
  }),
  middleware: [RateLimiter], // optional
  description: yup.string() // optional
}

```

Here:

```js
Handler; // Some async function (most likely in this controller file) that will do all the work.
Request; // A special interface that will do validation of body parameters for you.
Query; // A special interface that will do validation of query parameters for you.
Middleware; // An array of middlewares specially for the current route.
Description; // A description of this route (used when generating documentation).
```

## Request

Request does validation and casting of an upcoming `req.body`.

As we want to use already well-defined solutions, we believe that [yup](https://github.com/jquense/yup) is a great example of how a schema should be validated.

But you still have the ability to provide your own validation based on an interface.

:::warning
Request works on a body level.
:::

Request contains all fields from `req.body` and passes them into validation.

:::warning
Please note that GET methods have no BODY.
:::

Parameters after validation are available as `req.appInfo.request`.

:::warning
Do not use `req.body` directly. Always use parameters via `req.appInfo.request`.

:::

## Query

Query does validation and casting of an upcoming `req.query`.

The Yup schema is described similarly to the request.

:::warning
Query works on a query level.
:::

Query contains all fields from `req.query` and passes them into validation.

Parameters after validation are available as `req.appInfo.query`.

:::warning
Do not use `req.query` directly. Always use parameters via `req.appInfo.query`.

:::

## Validation

The framework dispatches validation through [Standard Schema](https://standardschema.dev/) — a vendor-neutral interface. Any conforming validator works as a route's `request:` or `query:` schema with no glue code:

| Validator | Standard Schema support |
|---|---|
| [Yup](https://github.com/jquense/yup) | ≥1.7 |
| [Zod](https://zod.dev/) | ≥3.24 |
| [Valibot](https://valibot.dev/) | all current versions |
| [ArkType](https://arktype.io/) | all current versions |

Yup is shown in the examples below since the framework historically taught it, but the same shapes are accepted from any Standard Schema-conforming library.

:::note
The framework no longer bundles a validator. `yup` is an **optional peer dependency** — install it only if you use yup schemas (or the deprecated `YupFile`). For dependency-free validation of simple shapes, use [`defineSchema`](#zero-dependency-schemas-defineschema) below.
:::

### Yup example

```js
request: yup.object().shape({
  count: yup.number().max(100).required("error text"),
});
query: yup.object().shape({
  page: yup.number(),
});
```

A more complete example:

```js
request: yup.object().shape({
  name: yup.string().required("validation.name"), // You can use i18n keys here.
  email: yup.string().email().required("Email required field"), // Or just text.
  message: yup
    .string()
    .required("Message required field")
    .min(30, "minimum 30 chars"), // Additional validators for different types exist.
  pin: yup.number().integer().min(1000).max(9999).required("pin.pinProvided"),
  status: yup
    .string()
    .required("Status required field")
    .oneOf(["WAITING", "CANCELED"]), // One of.
  transaction: yup
    .object() // Deep-level object.
    .shape({
      to: yup.string().required(),
      amount: yup.number().required(),
      coinName: yup.string().oneOf(["btc", "etc"]).default("etc"), // Default.
    })
    .required(),
});
```

For Yup schemas, the framework automatically strips unknown fields (security-relevant when handlers spread `req.appInfo.request` into model creates). You don't need `.noUnknown()` — the framework calls `cast(data, { stripUnknown: true })` for you.

### Zod example

```js
import { z } from "zod";

request: z.object({
  count: z.number().max(100),
  message: z.string().min(30, "minimum 30 chars"),
});
query: z.object({
  page: z.number().optional(),
});
```

Zod (and Valibot, ArkType) strip unknown fields by default — no extra configuration needed. To allow unknown fields explicitly, use the library's pass-through API (Zod's `.passthrough()`, Valibot's `looseObject`, ArkType's `'+': 'ignore'`).

### Zero-dependency schemas (`defineSchema`)

When you want a small schema without pulling in a validator library, use `defineSchema` — a one-function adapter that wraps a plain validate callback into a Standard Schema object:

```ts
import { defineSchema } from "@adaptivestone/framework/services/validate/defineSchema.js";

request: defineSchema<{ email: string }>((value) => {
  const v = (value ?? {}) as Record<string, unknown>;
  if (typeof v.email !== "string" || !v.email.includes("@")) {
    return { issues: [{ message: "validation.email", path: ["email"] }] };
  }
  // Return only known keys — unknown input is stripped by construction.
  return { value: { email: v.email } };
});
```

- The `Output` generic (`{ email: string }`) is what the codegen reads for the typed handler signature (`req.appInfo.request`) — see below. You declare it; the runtime checks live in the callback.
- Return `{ value }` on success (only the keys you copy survive — this is your strip-unknown), or `{ issues }` on failure. Each issue's `message` is an i18n key (or literal text); the framework auto-translates it like any other validator.
- This is the mechanism the built-in `Auth` controller uses, so the framework itself ships validator-free.

`defineSchema` is intentionally minimal — there are no `string()`/`object()` combinators. If you find yourself hand-writing many or deeply nested schemas, reach for a real validator library (Zod, etc.) instead.

### Typed handler signatures (codegen)

Running `npm run gen` (alias for `npm run cli generatetypes`) emits a `<File>.routes.gen.ts` next to every controller. The gen file exports one type alias per handler method (PascalCase suffixed with `Request`) — handlers import the alias instead of hand-writing `FrameworkRequest & { appInfo: { request: { ... } } }`:

```ts
// src/controllers/Auth.ts
import type { PostLoginRequest } from "./Auth.routes.gen.ts";
import { object, string } from "yup";

class Auth extends AbstractController {
  get routes() {
    return {
      post: {
        "/login": {
          handler: this.postLogin,
          request: object().shape({
            email: string().email().required(),
            password: string().required(),
          }),
        },
      },
    };
  }

  async postLogin(req: PostLoginRequest, res: Response) {
    // req.appInfo.request.email is typed as string (from the schema)
    // req.appInfo.user is typed as InstanceType<TUser> | undefined
    //   (from GetUserByToken middleware's `static get provides()`)
    // req.appInfo.i18n.t(...) is typed (from BaseAppInfo)
  }
}
```

The gen file uses `InstanceType<typeof Controller>['routes'][...]['request']` type navigation, so schemas stay inline in the `routes` getter — no extracted named consts required. It also intersects in `provides` shapes from the middleware tuple at this route, so `req.appInfo.user` (and any other middleware-contributed fields) are typed automatically.

**What the generated type carries** (per route):

| Source | Emitted into |
|---|---|
| Route path `:name` segments (e.g., `/users/:id`) | `req.params: { id: string }` |
| Route path `{*name}` splats (e.g., `/files/{*path}`) | `req.params: { path: string }` — splats join captured segments with `/` (one string, not an array) |
| Route `request:` schema | `req.appInfo.request: StandardSchemaV1.InferOutput<...>` |
| Route `query:` schema | `req.appInfo.query: StandardSchemaV1.InferOutput<...>` |
| Middleware-chain `static get provides()` returns | Merged into `req.appInfo` |

The middleware chain in the gen file is read from the same `RouteRegistry.flatten()` the runtime uses — so the types you see at compile time match the middlewares that actually run at request time. No parallel matcher to drift.

#### Keep `routes` declarative (codegen reads it without your constructor)

`npm run gen` introspects each controller through a prototype-only "ghost" — it reads the `routes` getter **without running the constructor**. That keeps type generation free of constructor side effects (config reads, S3/OAuth client construction, timers).

So your `routes` getter must be declarative: it may reference handler methods (`this.postLogin`), but it must not read state assigned in the constructor.

```ts
// ✅ fine — the constructor sets up clients, but `routes` only lists handlers
class Files extends AbstractController {
  constructor(app, prefix) {
    super(app, prefix);
    this.s3 = new S3Client(app.getConfig('s3')); // used inside handlers, not in routes
  }
  get routes() {
    return { post: { '/upload': { handler: this.upload } } };
  }
}

// ⚠️ deprecated — `routes` reads constructor-set state
class Crud extends AbstractController {
  constructor(app, prefix) {
    super(app, prefix);
    this.models = ['User', 'Order'];
  }
  get routes() {
    // reading this.models here forces codegen to construct the controller
    return Object.fromEntries(this.models.map((m) => [`/${m}`, { handler: this.list }]));
  }
}
```

If `routes` does read constructor state, nothing breaks: codegen detects it, falls back to constructing a real instance, and emits a one-per-class deprecation warning (`ASF_DEP_CTOR_ROUTES`). Move that state into handlers (or a module-level constant) to clear the warning — the instantiation fallback will be removed in v6.

#### Setup

Add to `package.json`:

```json
"gen": "node cliCommand.ts generatetypes",
"check:types": "npm run gen && tsc --noEmit"
```

Add to `.gitignore`:

```
**/*.routes.gen.ts
```

The gen files are regenerated on every type-check, so they stay fresh; CI doesn't need any extra step.

#### Naming convention

Handler method `postLogin` → type `PostLoginRequest`. Method `verifyUser` → `VerifyUserRequest`. The convention is method name in PascalCase + `Request` suffix. Renames flow naturally with editor refactor tools.

If the same handler method serves multiple routes (e.g., a backward-compatible POST and GET sharing one method), the type is a union of the per-route shapes — narrow with `req.method` inside the handler.

#### Routes without schemas

Bare-method-ref routes like `'/logout': this.postLogout` (no `request:` field) get a type that omits the schema-output override; `req.appInfo.request` falls through to the default `Record<string, unknown>` from `BaseAppInfo`.

#### Middleware-provided types

To make a middleware contribute typed fields to `req.appInfo`, add a `static get provides()` getter:

```ts
class GetUserByToken extends AbstractMiddleware {
  static get provides() {
    return {} as { user?: InstanceType<TUser> };
  }

  async middleware(req, res, next) {
    // ... runtime logic ...
  }
}
```

The returned object is always `{}` — only the cast type matters. Codegen reads this; the runtime ignores it. Handlers downstream of this middleware (per the route's middleware chain) get `req.appInfo.user` typed.

The same pattern works for **project-side middlewares** that augment `req.appInfo`. Example — a `UserWithRole` middleware that resolves CASL permissions onto the request:

```ts
import type { MongoAbility } from "@casl/ability";
import AbstractMiddleware from "@adaptivestone/framework/services/http/middleware/AbstractMiddleware.js";

class UserWithRole extends AbstractMiddleware {
  static get provides() {
    return {} as { permissions: MongoAbility };
  }

  async middleware(req, res, next) {
    req.appInfo.permissions = await buildPermissions(req.appInfo.user);
    next();
  }
}
```

Any route with `UserWithRole` in its middleware chain now has `req.appInfo.permissions` typed as `MongoAbility` automatically.

For app-wide globals (e.g., `requestId`, `sentryTransaction`) that aren't tied to a specific middleware, augment `AppInfoExtensions`:

```ts
declare module "@adaptivestone/framework/services/http/types" {
  interface AppInfoExtensions {
    requestId: string;
  }
}
```

#### Extending the framework's User model

If your project's `User` model adds methods or fields beyond the framework's base (`getSuppliers()`, custom relations, etc.), `req.appInfo.user` from `GetUserByToken.provides` will still be typed as the framework's `TUser` — calls to project-specific methods won't compile.

Augment the framework's `User` module to add your project's fields:

```ts
// somewhere in your project, loaded before handlers compile
declare module "@adaptivestone/framework/models/User" {
  interface IUserMethods {
    getSuppliers(): Promise<string[]>;
  }
}
```

Now `req.appInfo.user.getSuppliers()` type-checks across all handlers.

#### Manual fallback (without codegen)

If you'd rather not run codegen, you can pull a typed shape from any Standard Schema validator with `StandardSchemaV1.InferOutput`:

```ts
import type { StandardSchemaV1 } from "@adaptivestone/framework/services/validate/types";
import { object, string } from "yup";

const loginSchema = object({
  email: string().email().required(),
  password: string().required(),
});

type LoginRequest = StandardSchemaV1.InferOutput<typeof loginSchema>;

async postLogin(
  req: FrameworkRequest & { appInfo: { request: LoginRequest } },
  res: Response,
) {
  // req.appInfo.request.email is typed
}
```

This works for Zod, Valibot, ArkType too. Trade-off: middleware-contributed fields (`req.appInfo.user` and friends) need to be intersected by hand on every handler, and renames don't propagate.

### File Validation

Files are uploaded via `multipart/form-data`. The parser preserves the raw form shape, which means **every multipart field arrives as an array** — a single value is a one-element array, several values are a longer array. Validate against the framework-exported `File` type, using your validator's own array support to declare cardinality:

```ts
import { File } from "@adaptivestone/framework/types.js";
import { z } from "zod";

request: z.object({
  // one file: validate the one-element array, unwrap to a File for the handler
  avatar: z.array(z.instanceof(File)).length(1).transform(([f]) => f),
  // many files (`<input type="file" multiple>`): keep the array
  avatars: z.array(z.instanceof(File)).nonempty(),
});
```

`req.appInfo.request.avatar` is a `File`; `req.appInfo.request.avatars` is `File[]`.

:::caution Cardinality is declared, not inferred from length
A single value and a one-element array look identical on the wire (`["A"]`), so you must **declare** which fields are scalar — never auto-unwrap by array length. A `multiple` field that receives one file still arrives as `["A"]`; because `avatars` is declared `z.array(...)` (no transform), it correctly stays a one-element `File[]`. Only fields you explicitly transform to a scalar (`.length(1).transform(...)`) are unwrapped — and a scalar field that receives two values fails `.length(1)`, which is the right outcome.
:::

`File` is exported as both a value (so `instanceof` works) and a type. It aliases the parser's file class today and re-points at the web-standard `File` after the transport-neutral parser swap — so your validation code stays stable across that change. The same `File` works with every validator: `z.instanceof(File)`, `v.instance(File)`, `type.instanceOf(File)`, or yup's `mixed().test("file", "not a file", (v) => v instanceof File)`.

#### How route types are generated for multipart

Route-type generation is **parser-agnostic** — the multipart always-array shape never reaches it. Codegen emits `req.appInfo.request: StandardSchemaV1.InferOutput<...["request"]>`, which reads the request schema's **output** type. Because the schema above transforms the one-element array down to a `File`, the generated handler type is the unwrapped shape (`{ avatar: File; avatars: File[] }`) — and it matches the runtime value. The schema is the single source of truth for both runtime and types.

:::info Planned — route-level single-element extraction
A **route-level option** is planned so a route can declare which multipart fields are scalar, and the router unwraps their single-element arrays *before* validation. The schema then stays the clean logical shape (`avatar: z.instanceof(File)`), codegen reads that output type directly, and there's no per-field `.array().length(1).transform(...)` to write. This keeps the array-handling in the parser layer (where the array-ness originates) instead of the schema. Until it ships, use the validator's array handling shown above.
:::

:::warning Deprecated: `YupFile`
The yup-specific `YupFile` helper (`@adaptivestone/framework/helpers/yup.js`) is **deprecated and will be removed in v6** — migrate to the `File` export above. It still works for now (and requires `yup` in your own dependencies, since the framework no longer bundles it):

```js
import { YupFile } from "@adaptivestone/framework/helpers/yup.js";

request: yup.object().shape({
  someFileName: new YupFile().required("error text"),
});
```
:::

:::warning
Please be aware that a file can only be uploaded by ‘multipart/form-data’, and because of this, you can’t use nested objects.
:::

### Different schemas per Content-Type

A single route can accept more than one `Content-Type` with a different body shape for each — for example, create a resource from JSON or upload it as `multipart/form-data`. Instead of one `request` schema, pass a **content-type map** (the shape mirrors OpenAPI's `requestBody.content`):

```ts
import { File } from "@adaptivestone/framework/types.js";
import { z } from "zod";

"/avatar": {
  handler: this.setAvatar,
  request: {
    "application/json": z.object({ url: z.string().url() }),
    "multipart/form-data": z.object({
      file: z.array(z.instanceof(File)).length(1).transform(([f]) => f),
    }),
  },
},
```

The body is parsed (the parser is already Content-Type-aware), then validated with the schema matching the request's `Content-Type`. An unmatched type returns **415 Unsupported Media Type**, listing the accepted ones.

`req.appInfo.request` becomes a **discriminated union** keyed by an injected `contentType` field, so the handler narrows cleanly — and codegen emits the union for you:

```ts
async setAvatar(req: SetAvatarRequest, res: Response) {
  if (req.appInfo.request.contentType === "multipart/form-data") {
    req.appInfo.request.file; // File
  } else {
    req.appInfo.request.url; // string
  }
}
```

:::note
Matching is on the media type only and is **case-insensitive** — parameters like `; charset=...` and `; boundary=...` are ignored. The injected `contentType` is the lower-cased media type, and it overwrites any body field of the same name, so don't declare a schema field named `contentType`. A `Content-Type` the body parser itself can't handle (e.g. malformed `multipart/form-data`) is rejected with a `400` by the parser *before* the `415` check. Middleware-declared request schemas (`relatedRequestParameters`) still apply on top, regardless of Content-Type.
:::

### Custom validators

To plug in a validator that doesn't already implement Standard Schema (e.g., raw [Joi](https://joi.dev/), or a hand-rolled function), implement the `~standard` slot directly. About 10 lines of glue:

```ts
import type { StandardSchemaV1 } from "@adaptivestone/framework/services/validate/types";

interface ProductInput { sku: string; price: number }

const productSchema: StandardSchemaV1<unknown, ProductInput> = {
  "~standard": {
    version: 1,
    vendor: "mycustom",
    validate(value) {
      const data = value as Partial<ProductInput>;
      if (typeof data.sku !== "string") {
        return { issues: [{ message: "sku is required", path: ["sku"] }] };
      }
      if (typeof data.price !== "number") {
        return { issues: [{ message: "price is required", path: ["price"] }] };
      }
      return { value: { sku: data.sku, price: data.price } };
    },
  },
};

// Use it on a route:
request: productSchema;
```

You also get `InferOutput<typeof productSchema>` for free. Standard Schema's spec lives at https://standardschema.dev/.

### Registering vendor drivers

For library-specific behavior (custom strip semantics, native JSON Schema export for OpenAPI, etc.), register a `ValidatorDriver`:

```ts
import { ValidateService, type ValidatorDriver } from "@adaptivestone/framework/services/validate/ValidateService";

const myJoiDriver: ValidatorDriver = {
  canHandle: (body) => body?.isJoi === true,
  async validate(body, data) {
    const { value, error } = body.validate(data, { stripUnknown: true });
    if (error) throw new ValidationError(joiToFrameworkPayload(error));
    return value;
  },
  toJsonSchema: (body) => myJoiToJsonSchema(body), // optional; for OpenAPI later
};

ValidateService.register(myJoiDriver);
```

Drivers are matched in registration order; user-registered drivers take priority over the built-ins.

### ValidationError

When validation fails, the framework throws a `ValidationError`. The instance's `.message` is the path-keyed payload object that ships out via `res.json({ errors: err.message })`, producing:

```json
{
  "errors": {
    "fieldName": ["error description"],
    "anotherField": ["another field error"]
  }
}
```

Each value is always an array of messages. A field that fails multiple validators surfaces all of them: `{password: ["min8", "startUpper"]}`.

For structured access (logging, observability), use `.issues`:

```ts
import { ValidationError } from "@adaptivestone/framework/services/validate/ValidationError";

try {
  /* ... */
} catch (e) {
  if (e instanceof ValidationError) {
    for (const issue of e.issues) {
      console.error(`[${issue.path?.join(".") ?? "root"}] ${issue.message}`);
    }
  }
}
```

### i18n

In any fields that can generate an error (required, etc.), you can use i18n keys to translate. The framework will handle the translation for you.

Please refer to the [i18n documentation](08-i18n.md).

## Handler

Handler - some async function (most likely in this controller file) that will do all the work. It is better to write the function in the same file.

:::warning
The handler can only be an **async** function.
:::

`req.appInfo.app`

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        '/': {
          handler: this.postSample,
          request: yup.object().shape({
            count: yup.number().max(100).required(),
          })
        }
      }
    }
  }
  // Send a request with data {count: "5000"}.
  // Will produce an error with status 400 and {errors: {count:['Text error']}}.

  postSample(req, res) {
    // On success validation, we pass here.
    // {count: "5000"}
    console.log(req.appInfo.request)
    // {count: 5000} -> casted to a number

    const SomeModel = this.app.getModel('SomeModel');
    const SomeModelAlternativeWay = req.appInfo.app.getModel('SomeModel');

    const { count } = req.appInfo.request;

    const someModel = await SomeModel.findOne({count});

    return res.status(200).json({modelId: someModel.id});
  }

}
export default ControllerName;
```

### Middleware

Middleware - an array of middlewares specially for the current route.

:::warning

Route middlewares take precedence over middlewares in controllers.

:::

```javascript
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      get: {
        '/routeName': {
          handler: ...,
          middleware: [MiddlewareName, MiddlewareName, etc]
        }
      },
    };
  }
}
export default ControllerName;
```

Similarly to controller middlewares, you can use middlewares with parameters.

:::note

The rules for the design of middlewares with parameters are described in the subsection "Middleware".

:::

Sample:

```javascript
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";
import RoleMiddleware from "@adaptivestone/framework/services/http/middleware/Role.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      get: {
        '/routeName': {
          handler: ...,
          middleware: [[RoleMiddleware, { roles: ['client'] }]]
        }
      },
    };
  }
}
export default ControllerName;
```

## Debugging your routes

### Boot-time route tree

After all controllers are registered, the framework prints the full route tree at the `verbose` log level — useful for spotting cross-controller middleware accumulation, splat scopes, or unexpected route shapes. Set `LOGGER_CONSOLE_LEVEL=verbose` (or your transport's equivalent) to see it.

```
/  (mw: GetUserByToken)
├── GET → home
├── auth  (mw: GetUserByToken, RateLimiter)
│   ├── login
│   │   └── POST → postLogin  [request]
│   └── logout
│       └── POST → postLogout
└── v1  (mw: ApiLimiter)
    └── container  (mw: ApiLimiter)
        ├── GET → getContainers  [query]
        └── POST → getContainers  [query]
```

`[request]` / `[query]` markers indicate routes with body / query schemas. `{…}` after a middleware name means it was registered with parameters.

### Warnings on misconfiguration

The framework logs a `warn`-level message and skips the offending entry when it sees these problems in your `routes` getter or middleware `Map`:

| Warning | Triggered when |
|---|---|
| `unknown verb 'X' in routes getter` | A key in `get routes()` isn't one of `get/post/put/patch/delete/head/options` |
| `route X Y has no handler function` | A route's value is an object but its `handler` field is missing or not callable |
| `middleware Map key is not a string` | A key in `static get middleware()`'s `Map` is not a string |
| `middleware Map key 'X' has unknown method prefix 'Y'` | A `Map` key looks like `METHOD/path` but `METHOD` is not a known HTTP verb — the whole key is treated as a path, which is usually a typo |

These warnings catch the common typos that used to silently produce 404s at request time.
