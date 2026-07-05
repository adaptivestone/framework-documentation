# Error handling

What happens when a route handler throws? The framework resolves the error through an ordered **error-handler registry**:

1. **Your registered handlers** — checked first, in registration order.
2. **Built-ins** — the `HttpError` mapper, then the Mongoose validation safety net.
3. **Fallback** — nothing matched: the error is logged at `error` level and the client gets `500 {"message": "Platform error. Please check later or contact support"}`.

The first entry whose error class matches (`instanceof`) and whose handler returns a response wins. That gives you two tools: **throw** typed HTTP errors from your own code, and **register** handlers for error types you don't own.

## Throwing HTTP errors from your code

Deep inside business logic you often know the right HTTP answer — the document doesn't exist, the user isn't allowed — but you don't have `res` there, and threading it through every function is noise. Throw instead:

```js
import { NotFoundError, ForbiddenError } from "@adaptivestone/framework/services/http/httpErrors.js";

class Posts extends AbstractController {
  get routes() {
    return {
      get: { "/:id": { handler: this.getOne } },
    };
  }

  async getOne(req, res) {
    const post = await this.app.getModel("Post").findById(req.params.id);
    if (!post) {
      throw new NotFoundError("Post not found");
      // → 404 {"message": "Post not found"}
    }
    if (String(post.ownerId) !== req.appInfo.user.id) {
      throw new ForbiddenError("Not your post");
      // → 403 {"message": "Not your post"}
    }
    return res.status(200).json({ data: post.getPublic() });
  }
}
```

It works from any depth — a service function three calls down can throw the same way.

Available classes (all from `services/http/httpErrors.js`):

| Class | Status | Default message |
| --- | --- | --- |
| `BadRequestError` | 400 | `Bad request` |
| `UnauthorizedError` | 401 | `Unauthorized` |
| `ForbiddenError` | 403 | `Forbidden` |
| `NotFoundError` | 404 | `Not found` |
| `ConflictError` | 409 | `Conflict` |
| `HttpError` | any | — (base class) |

Every constructor accepts `(message, body?)`. The response body is `{ message }` unless you pass an explicit `body`, which replaces it:

```js
throw new HttpError(422, "Unprocessable", { errors: { csv: "row 17 malformed" } });
// → 422 {"errors": {"csv": "row 17 malformed"}}
```

For a status you use often, subclass once and throw everywhere:

```js
import { HttpError } from "@adaptivestone/framework/services/http/httpErrors.js";

export class PaymentRequiredError extends HttpError {
  constructor(message = "Subscription expired") {
    super(402, message);
  }
}
```

Thrown `HttpError`s are logged at `verbose` level — they're deliberate control flow, not defects, so they don't pollute your error logs.

## Mapping errors you don't own

Libraries throw their own error types — the Mongo driver, payment SDKs, queue clients. Register a handler for the class, typically from the [`bootHttp` hook](01-intro.md#project-boot-hook-boothttp) (the `Server` constructor option that runs with the live app):

```js
import { MongoServerError } from "mongodb";

const server = new Server({
  ...folderConfig,
  bootHttp: async (app) => {
    app.httpServer?.registerErrorHandler(MongoServerError, (err) =>
      err.code === 11000
        ? { status: 409, body: { message: "Already exists" } }
        : null, // null = "not mine after all" → try the next entry
    );
  },
});
```

The handler contract:

- **Signature**: `(err, req) => { status, body } | null` — async is fine, the result is awaited.
- `err` is typed as an instance of the class you registered — `err.code` autocompletes, no casts.
- `req` is the same request the route handler had — `req.appInfo.request`, `req.appInfo.i18n`, etc.
- Return `{ status, body }` to produce the response (the framework sends it — handlers never touch `res`, so double-send protection and logging stay in one place).
- Return `null`/`undefined` to pass the error to the next entry.
- `registerErrorHandler` returns an **unregister function** — handy in tests.
- Third argument `{ logLevel }` controls how the handled error is logged (default `warn`):

```js
app.httpServer?.registerErrorHandler(
  StripeCardError,
  (err) => ({ status: 402, body: { message: err.declineReason } }),
  { logLevel: "verbose" },
);
```

If a handler itself throws, the framework logs it (with the stack) and falls back to the 500 — a broken error handler can never crash the request pipeline.

Handler-side types, if you want to extract the function:

```ts
import type { ErrorHandlerFn, ErrorHandlerResult } from "@adaptivestone/framework/services/http/builtinErrorHandlers.js";
```

### Reading the request in a handler

`req` is the full framework request, so a handler can build responses from everything the route knew — path params, validated body and query, locale, client IP. A fuller example: a task-creation route hits a unique index, and the handler turns the raw driver error into an answer that names what collided and where:

```js
// Route: POST /project/:projectId/tasks?notify=email
//        request: object({ title: string().required() })
//        query:   object({ notify: string() })
// Model: title has a unique index per project → E11000 on duplicates.

app.httpServer?.registerErrorHandler(MongoServerError, (err, req) => {
  if (err.code !== 11000) {
    return null; // other driver errors → next entry (→ 500 fallback)
  }

  // Which unique field collided — E11000 carries it in `keyValue`.
  const [field] = Object.keys(err.keyValue ?? {});

  return {
    status: 409,
    body: {
      // Translated for the request's locale, like any handler would do.
      message: req.appInfo.i18n?.t("errors.taskExists") ?? "Task already exists",
      field,                                    // "title"
      projectId: req.params.projectId,          // raw path param (string)
      attempted: req.appInfo.request?.title,    // validated body value
      notify: req.appInfo.query?.notify ?? null, // validated query value
    },
  };
});
```

What's available on `req`:

| Source | What it is | Caveat |
| --- | --- | --- |
| `req.params` | Path params (`:projectId`) | Raw **strings**, not validated — same rule as in handlers (see the note in [Routes → Validation](02-routes.md#validation)) |
| `req.appInfo.request` | Validated, cast request body | Only set when the route declares a `request:` schema — guard with `?.` in handlers registered for many routes |
| `req.appInfo.query` | Validated, cast query string | Same — needs a `query:` schema |
| `req.appInfo.i18n` | `t()` + detected `language` | Present on framework routes; typed optional |
| `req.appInfo.ip` | Client IP (proxy-aware) | From the global IP detector |
| `req.appInfo.user` | Authenticated user document | Only on routes running the auth middleware (`GetUserByToken`) |
| `req.method`, `req.path`, `req.headers`, … | Anything Express exposes | — |

One design boundary to keep in mind: the handler decides the **response**; the framework does the sending and the logging. If you find a handler reaching for `res` or a logger, that logic probably belongs in the route handler's own `try/catch` instead.

## Matching order

Entries are matched by `instanceof` in **registration order — not by class specificity**. Your handlers always run before the built-ins, so you can intercept or override anything, including the built-ins themselves.

:::warning
An early handler for a base class shadows later handlers for its subclasses. If you register a handler for `HttpError` and later one for `NotFoundError`, the `HttpError` one wins for every `NotFoundError` thrown — it was registered first and `NotFoundError instanceof HttpError` is true. Register the specific classes first, or branch inside one handler.
:::

## Built-in: the Mongoose validation safety net

The recommended practice is to mirror model constraints in your route schema — a `maxLength: 50` in the model should have a `.max(50)` in the route's `request:` schema, so bad input fails fast with a clean, translated 400 (see [Validation](02-routes.md#validation)).

But when a constraint slips through, `doc.save()` throws a Mongoose `ValidationError`, and a built-in registry entry catches it:

- If **every** failing model path is a field the client actually sent (a key of the validated `request:`/`query:` input), the client gets `400 {"errors": {"name": "..."}}` — same shape as route validation errors — and the framework logs a `warn`: your route schema is missing a constraint worth mirroring.
- If **any** failing path is internal or renamed (the client sent `name`, the model field is `userName`), it stays an honest **500**. Model field names are never leaked to the client, and a server-side data bug is never blamed on the client.

Each message is **rebuilt from the validation kind and the schema constraint** — `maxlength` → `"Must be at most 255 characters"`, a `Number` cast failure → `"Must be a number"`, `enum` → `"Must be one of: …"` — and **never includes the value the client submitted**. Mongoose's own default messages interpolate that value (a phone number, a password pasted into the wrong field), which would otherwise leak it into the response and the log. For the same reason a *custom* message set on the model (`maxLength: [50, 'Name too long']`) is **not** passed through — it's rebuilt generically, since a custom string can't be told apart from a templated default that embedded the value. The `warn` log line for a handled error is sanitized the same way; a failure that stays a 500 logs the original error in full. These fallback messages are plain English and not translated; put user-facing, i18n wording on the route schema.

Note this covers Mongoose *validation* errors only. A duplicate-key violation (`E11000`) is a `MongoServerError` from the driver, not a `ValidationError` — map it yourself as shown above if you want a 409.

:::tip
The safety net is a fallback, not the contract. Route schemas are the API's source of truth: they produce field-accurate, i18n-translated errors under the names the client knows. The safety net exists so a missed constraint degrades to a useful 400 instead of a mystery 500.
:::

## What still becomes a 500

- Any error no registry entry claims (including `null` returns all the way down).
- A registry handler that throws while handling.
- Mongoose validation failures on internal/renamed fields (see above).

All of these are logged at `error` level with the original error, so the details are in your logs — the client only ever sees the generic message.
