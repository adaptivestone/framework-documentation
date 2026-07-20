# OpenAPI

The framework generates an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0/) document from your controllers. Paths, parameters, request bodies, security, and tags are all derived from the route definitions you already write — point Swagger UI, Redoc, or a client-SDK generator at the output.

## Generate

```bash
node src/cli.ts openapi                       # print to stdout
node src/cli.ts openapi --output openapi.json # write to a file
```

Add a script to `package.json`:

```json
"openapi": "node src/cli.ts openapi"
```

```bash
npm run openapi -- --output openapi.json
```

:::note
The command loads your controllers but **opens no database or network connection and binds no port** — it walks the route registry and reads your schemas in-process. It's safe to run in CI. (Unlike codegen, which is on your hot path, this is a cold, occasional command, so it loads the real controller instances to read live schema objects.)
:::

## What gets documented

Everything comes from the route definitions you already have — there is nothing OpenAPI-specific to maintain separately:

| OpenAPI field | Source |
|---|---|
| `operationId` | handler method name |
| `tags` | controller class name |
| `summary` | route [`description`](06-Controllers/02-routes.md#route-third-level-route-object-level) |
| path `parameters` | `:name` path segments |
| query `parameters` | route [`query:`](06-Controllers/02-routes.md#query) schema (+ middleware query schemas) |
| `requestBody` | route [`request:`](06-Controllers/02-routes.md#request) schema or [content-type map](06-Controllers/02-routes.md#different-schemas-per-content-type) (+ middleware request schemas) |
| `security` | middleware [`static get usedAuthParameters()`](#documenting-auth-security-schemes) |
| `info` / `servers` | your `package.json` + the `http` config (`port`, `myDomain`) |

Output is **OpenAPI 3.1** (JSON Schema 2020-12) only.

## Request bodies come from your schemas

Body and query shapes are produced by introspecting the **same validation schemas** you already use at runtime — through the validator driver's `toJsonSchema`. How much detail you get depends on the validator:

| Validator | OpenAPI body |
|---|---|
| [Zod](https://zod.dev/) | full JSON Schema via native `z.toJSONSchema` — types, formats, `min`/`max`, patterns, enums, defaults |
| [Yup](https://github.com/jquense/yup) | JSON Schema from `.describe()` — types, `required`, enums, nullable, arrays, `date` → `date-time` |
| [ArkType](https://arktype.io/) / any schema exposing a `.toJsonSchema()` method | its native output |
| [`defineSchema`](06-Controllers/02-routes.md#zero-dependency-schemas-defineschema) / a hand-rolled `~standard` function | **not introspectable** — a placeholder schema + a warning |

### Zod request-input semantics

OpenAPI describes what a client sends, not the value after Zod transforms it.
For example, `z.string().transform(Number)` is documented as a string.
`z.coerce.date()` is documented as a `{ "type": "string", "format":
"date-time" }` request value. Other Zod values that cannot be represented in
JSON Schema, such as custom `instanceof` checks, safely degrade to `{}` rather
than aborting the whole document.

For file uploads, use a content-type map with an explicit
`multipart/form-data` entry. A custom runtime `instanceof` check cannot by
itself tell OpenAPI that a field contains binary data.

:::note Use a declarative schema if you want a documented body
`defineSchema` and custom `~standard` functions are *imperative* — they validate but expose no shape, so the generator can't describe them and emits a placeholder object instead. If an endpoint's body should appear in the spec, declare it with Zod or Yup. The command prints a warning listing every schema it couldn't introspect, e.g.:

```
OpenAPI: 1 schema(s) could not be fully introspected:
  POST /auth/login body: schema introspection unavailable.
```
:::

Schema conversion is contained per route and middleware schema. Warnings name
the HTTP method, route, and schema position. An unavailable body schema gets a
placeholder object, an unavailable query schema is omitted, and other healthy
routes remain fully documented. Genuine command boot, generator, and file-write
failures still exit nonzero.

This is why the generator must load your controllers at runtime rather than read the generated types: JSON Schema can only be produced from the live schema object (`z.toJSONSchema(...)`, `schema.describe()`), not from a TypeScript type.

## Documenting auth (security schemes)

A middleware advertises the security scheme(s) it enforces with a `static get usedAuthParameters()` getter. The generator reads it **off the class — no instantiation** — adds each entry to `components.securitySchemes`, and attaches a `security` requirement to every operation whose middleware chain includes that middleware.

```ts
import AbstractMiddleware from "@adaptivestone/framework/services/http/middleware/AbstractMiddleware.js";

class TokenAuth extends AbstractMiddleware {
  static get usedAuthParameters() {
    return [
      // http bearer scheme
      { name: "bearerAuth", type: "http", scheme: "bearer", description: "Bearer token" },
      // or an apiKey header
      { name: "X-Api-Key", type: "apiKey", in: "header", description: "API key" },
    ];
  }

  async middleware(req, res, next) {
    // ... runtime auth logic ...
  }
}
```

| Field | Meaning |
|---|---|
| `name` | scheme key in `components.securitySchemes` (for `apiKey`, also the header/query name) |
| `type` | `'apiKey'` or `'http'` |
| `in` | for `apiKey`: `'header'` (default) / `'query'` / `'cookie'` |
| `scheme` | for `http`: `'bearer'`, `'basic'`, … |
| `description` | shown in the docs UI |

The built-in [`GetUserByToken`](06-Controllers/03-middleware.md) already declares its `Authorization` header + bearer schemes, so any route behind it is documented as secured automatically.

## Current limitations

- **Response bodies are not yet schema-documented.** Every operation carries a generic `200`/`400`/`401`/`404` response with a text description but no body schema. (Documenting response shapes is on the roadmap — it needs a declared `response:` schema, since a response has no runtime schema object to introspect.)
- **Catch-all (`{*splat}`) routes** are approximated as a single `{splat}` path parameter, because OpenAPI has no catch-all; the command warns when it does this.
- The route `description` becomes the operation `summary`; there is no separate long description, `deprecated` flag, or per-tag description yet.
