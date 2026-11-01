# Middleware and handlers with `ctx`

Since 5.7, middleware and route handlers can take one **request context**, `ctx`, instead of Express's `(req, res, next)`. Middleware extend the new `Middleware` base; controllers opt in with `static get contractVersion()`. It is opt-in: middleware and controllers written for 5.x keep working unchanged, also on the same route. Version 6 makes `ctx` the only form, so new code should use it.

```js
import Middleware from "@adaptivestone/framework/services/http/middleware/Middleware.js";

class GetTenant extends Middleware {
  static get description() {
    return "Finds the tenant from the X-Tenant header";
  }

  async middleware(ctx, next) {
    ctx.appInfo.tenant = await findTenant(ctx.header("x-tenant"));
    return next();
  }
}

export default GetTenant;
```

## Writing a middleware

`middleware(ctx, next)` ends in one of three ways:

| Outcome          | Write                       | What happens                                                                  |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Continue         | `return next()`             | The rest of the route runs; its response is returned to you.                  |
| Stop             | `return HttpResponse.…(…)`  | That response is sent; later middleware and the handler do not run.           |
| Fail             | `throw error`               | The error goes through the [error handlers](04-error-handling.md), once.      |

```js
import { HttpError } from "@adaptivestone/framework/services/http/httpErrors.js";
import Middleware from "@adaptivestone/framework/services/http/middleware/Middleware.js";
import { HttpResponse } from "@adaptivestone/framework/services/http/responses.js";

class RequireTenant extends Middleware {
  static get description() {
    return "Rejects requests without a known tenant";
  }

  async middleware(ctx, next) {
    if (!ctx.header("x-tenant")) {
      return HttpResponse.json(400, {
        error: "TENANT001",
        message: this.translate(ctx, "middleware.tenant.missing", "Tenant is required"),
      });
    }
    if (!(await tenantExists(ctx.header("x-tenant")))) {
      throw new HttpError(404, { code: "TENANT002", message: "Unknown tenant" });
    }
    return next();
  }
}
```

`await next()` gives you the response the rest of the route produced, and an error thrown later in the route reaches you first. So one middleware can wrap the whole route, for example a database transaction:

```js
class Transaction extends Middleware {
  static get description() {
    return "Runs the route in a database transaction";
  }

  async middleware(ctx, next) {
    const session = await startSession();
    ctx.appInfo.session = session;
    try {
      const response = await next();
      await session.commit();
      return response;
    } catch (err) {
      await session.abort();
      throw err; // the error handlers still answer it
    } finally {
      await session.end();
    }
  }
}
```

Rules for `next`:

- Always **return** it (or what it resolved to). A middleware that returns nothing fails the request; outside production the error names the middleware. In TypeScript a forgotten `return` is a compile error.
- Call it **once**, while your middleware runs. A second call fails the request; a call after your middleware has finished is refused.
- It always returns a Promise, so `return next()` works in sync and async middleware alike.

Everything else is as for 5.x middleware: `static get description()`, `authSchemes`, `requiresAuth`, `relatedQueryParameters`, `relatedRequestParameters` and `provides` work the same; parameters come from the [same registration forms](03-middleware.md#middleware-parameters) and are read from `this.params`; `this.translate(ctx, key, defaultValue)` replaces `this.translate(req, …)`. Register a `Middleware` wherever you register a 5.x one — a controller's `static get middleware()` map or a route's `middleware:` list — or for every request with the [`Server` option `middleware`](03-middleware.md#your-own-app-wide-middleware).

## The request context

| Member                 | What it is                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `method`               | `GET`, `POST`, …                                                                              |
| `path`                 | Decoded path without the query: `/files/my report`.                                           |
| `url`                  | The full request URL as a `URL`.                                                              |
| `route`                | The matched route template: `/users/:id`.                                                     |
| `header(name)`         | A request header, case-insensitive; repeated values joined with `, `. `headers` has them all. |
| `params`, `query`      | Raw path params and query. Validated values are on `appInfo.params` / `appInfo.query`.        |
| `body`                 | The parsed body. The validated body is on `appInfo.request`.                                  |
| `cookies.get(name)`    | A request cookie, URL-decoded; `undefined` when absent.                                       |
| `ip`                   | The client address from [IpDetector](03-middleware.md#ipdetector).                            |
| `id`                   | The client's `X-Request-Id`, or a generated one.                                              |
| `signal`               | An `AbortSignal` that aborts when the client goes away — pass it to `fetch` or database calls. |
| `appInfo`              | Per-request state. It is the same object 5.x code sees as `req.appInfo`.                      |
| `response`             | Headers and cookies for the response — see below.                                             |
| `onFinish(callback)`   | Run code after the response has ended — see below.                                            |
| `failed`, `error`      | Whether the response came from the error handlers, and the original error.                    |

Code that has no `ctx` at hand — a model hook, a logger, a helper — can get it with `requestContext()`:

```js
import { requestContext } from "@adaptivestone/framework/services/http/requestScope.js";

export function currentTenant() {
  return requestContext()?.appInfo.tenant;
}
```

It returns `undefined` outside a request. In 5.x the request scope is opened on routes that use a `Middleware` or a `ctx` handler; on a route with only 5.x code it is `undefined` too.

## Headers and cookies

Middleware often add a header before any response exists. `ctx.response` collects them and applies them to **whatever response is sent**: the handler's, a middleware's early stop, or an error response.

```js
async middleware(ctx, next) {
  ctx.response.setHeader("x-tenant", ctx.appInfo.tenant.id); // replaces an earlier value
  ctx.response.appendHeader("vary", "x-tenant"); // adds to it
  return next();
}
```

When the response itself sets the same header, the response's value wins (`Set-Cookie` values are all kept, `Vary` values merged). Once the response has started, adding a header throws instead of being silently lost.

Cookies work the same way:

```js
const sid = ctx.cookies.get("sid");
ctx.response.setCookie("sid", newSessionId, { maxAge: 60 * 60 * 24 * 30 });
ctx.response.deleteCookie("remember");
```

| Option        | Default    | Notes                                                                                         |
| ------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `path`        | `/`        |                                                                                               |
| `httpOnly`    | `true`     | Set `false` only for cookies browser scripts must read.                                       |
| `sameSite`    | `'lax'`    | `'strict'`, `'lax'` or `'none'` (`'none'` needs `secure`).                                    |
| `secure`      | `true`     | Except outside production for plain-HTTP requests to `localhost` (local development).        |
| `maxAge`      | —          | **Seconds**, like the `Max-Age` attribute. Express's `res.cookie` takes milliseconds.         |
| `expires`     | —          | A `Date`. Without `maxAge` or `expires` the cookie ends with the browser session.             |
| `domain`      | —          |                                                                                               |
| `partitioned`, `priority` | — | `priority`: `'low'`, `'medium'` or `'high'`.                                              |

Setting a cookie with the same name, `domain` and `path` again replaces it. `deleteCookie` takes the `domain` and `path` the cookie was set with. Invalid names or values throw.

## After the response: `onFinish`

```js
async middleware(ctx, next) {
  ctx.onFinish(({ outcome, status, durationMs }) => {
    metrics.record({ route: ctx.route, outcome, status, durationMs, failed: ctx.failed });
  });
  return next();
}
```

The callback runs once, after the response has ended: `finished` (the last byte was handed to the operating system), `aborted` (the client went away) or `failed`. Callbacks run newest first; one that throws is logged and the others still run. Use it instead of `res.on("finish")`.

## Handlers with `ctx`

A controller opts in with `static get contractVersion()`. Its handlers then get `ctx` and **return** an [`HttpResponse`](05-responses.md):

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";
import { NotFoundError } from "@adaptivestone/framework/services/http/httpErrors.js";
import { HttpResponse } from "@adaptivestone/framework/services/http/responses.js";

class Users extends AbstractController {
  static get contractVersion() {
    return 2;
  }

  get routes() {
    return {
      get: { "/:id": { handler: this.getUser, params: userIdSchema } },
      post: { "/": { handler: this.create, request: createUserSchema } },
    };
  }

  async getUser(ctx) {
    const user = await this.app.getModel("User").findById(ctx.appInfo.params.id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return HttpResponse.json(200, { data: user.getPublic() });
  }

  async create(ctx) {
    const user = await this.app.getModel("User").create(ctx.appInfo.request);
    return HttpResponse.json(201, { data: user.getPublic() });
  }
}
```

Validation, the error handlers and route middleware work exactly as before. A handler that returns anything but an `HttpResponse` is answered with a logged 500. Methods a controller inherits from a 5.x parent class keep `(req, res)`, so you can move one controller at a time.

In TypeScript, generated route types include a `<MethodName>Context` next to every `<MethodName>Request`, with the same validated `appInfo` (including what route middleware [provide](03-middleware.md#typed-contributions-to-reqappinfo)) and path params:

```ts
import type { CreateContext, GetUserContext } from "./Users.routes.gen.ts";

class Users extends AbstractController {
  static get contractVersion() {
    return 2 as const;
  }

  async create(ctx: CreateContext) {
    const name: string = ctx.appInfo.request.name; // typed from createUserSchema
    // …
  }
}
```

## Mixing with 5.x code

A route can have 5.x middleware, `Middleware` and either kind of handler in any order:

- A 5.x middleware keeps `(req, res, next)`: `next()` continues the route, `next(err)` or a throw fails it with the original error.
- An error from 5.x code reaches the `Middleware` around it first, so the transaction above rolls back.
- When 5.x code writes the response through `res`, `await next()` returns a response of kind `sent`. It has the status that was sent; pass it on unchanged — it cannot be replaced. Headers and cookies staged on `ctx.response` before that are still added to it.

## In `transformResponse` and error handlers

Both hooks can work with the same `ctx`, so code written for them now keeps working in v6:

- [`transformResponse`](05-responses.md#reshaping-every-response-transformresponse) receives `{ req, ctx }`; read `ctx`.
- An [error handler](04-error-handling.md#handlers-that-take-ctx) registered with `{ contractVersion: 2 }` receives `(err, ctx)`.

On a route with only 5.x code the context is created the first time one of them reads it.

## Testing a middleware

`createTestContext()` builds a context without a server. Use it instead of hand-made objects, since the context can gain members in minor releases.

```js
import assert from "node:assert/strict";
import { it } from "node:test";
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";
import { HttpResponse } from "@adaptivestone/framework/services/http/responses.js";
import {
  createTestContext,
  finishTestContext,
} from "@adaptivestone/framework/tests/createTestContext.js";
import RequireTenant from "./RequireTenant.js";

it("rejects a request without a tenant", async () => {
  const ctx = createTestContext({ url: "/projects?page=2", headers: {} });
  const response = await new RequireTenant(appInstance).middleware(ctx, async () =>
    HttpResponse.empty(204),
  );
  assert.equal(response.status, 400);
  finishTestContext(ctx); // runs the onFinish callbacks
});
```

`createTestContext` accepts `method`, `url`, `origin` (default `http://localhost`), `headers`, `route`, `params`, `query`, `body`, `appInfo` and `signal`.

## Migrating a 5.x middleware

1. Extend `Middleware` instead of `AbstractMiddleware`.
2. Replace `middleware(req, res, next)` with `middleware(ctx, next)` and read the request from `ctx` (`req.appInfo` → `ctx.appInfo`, `req.get(name)` → `ctx.header(name)`, `req.cookies` → `ctx.cookies.get(name)`).
3. Keep `return next()`.
4. Replace `next(err)` with `throw err`.
5. Replace `res.status(…).json(…)` with a returned `HttpResponse`, and `res.set(…)` / `res.cookie(…)` with `ctx.response.setHeader(…)` / `setCookie(…)` (cookie `maxAge` is in seconds).
6. Move `res.on("finish")` work to `ctx.onFinish`.
