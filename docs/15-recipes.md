# Recipes

A task-oriented cookbook for the things you build most often. Each recipe is a minimal, copy-paste starting point — follow the links into [Controllers](06-Controllers/01-intro.md) and [Routes](06-Controllers/02-routes.md) for the full reference.

:::note
Framework **package** imports use the published `.js` extension (the package ships compiled `.js`). Your own project files can be `.ts`.
:::

## Where the handler types come from

The recipes below type handlers with two things — here's where each comes from:

- **`FrameworkRequest`** — imported from `@adaptivestone/framework/services/http/HttpServer.js`. It's the Express `Request` plus the base `req.appInfo` (`app`, `ip`, `request`, `query`, `i18n`). Use it for handlers that only read `req.params` / `req.body` and don't need validated input or middleware-provided fields. `Response` and `NextFunction` come from `express`.
- **Generated `<Method>Request` aliases** — emitted by `npm run gen` into `<Controller>.routes.gen.ts`, one per handler method (`postCreate` → `PostCreateRequest`). Each one extends the base context with what *that route* actually carries: typed `req.params`, your `request:` / `query:` schema output on `req.appInfo`, and every field the route's middleware chain declares via `static get provides()` (`req.appInfo.user`, `req.appInfo.pagination`, …).

Rule of thumb: if the handler reads `req.appInfo.request` / `.query` / `.user` / `.pagination` or precise `req.params`, use the generated alias; otherwise `FrameworkRequest` is enough. See [Typed handler signatures](06-Controllers/02-routes.md#typed-handler-signatures-codegen).

## Add a controller

Drop a file in `src/controllers/`. The filename becomes the route prefix (`Article.ts` → `/article`), and every method listed in `routes` becomes an endpoint. No registration step — the framework auto-loads the file.

```ts
// src/controllers/Article.ts
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";
import type { FrameworkRequest } from "@adaptivestone/framework/services/http/HttpServer.js";
import type { Response } from "express";

class Article extends AbstractController {
  get routes() {
    return {
      get: {
        "/": { handler: this.list },
        "/:id": { handler: this.getOne },
      },
    };
  }

  async list(req: FrameworkRequest, res: Response) {
    const Article = this.app.getModel("Article");
    return res.status(200).json({ data: await Article.find() });
  }

  async getOne(req: FrameworkRequest, res: Response) {
    const Article = this.app.getModel("Article");
    return res.status(200).json({ data: await Article.findById(req.params.id) });
  }
}

export default Article;
```

These handlers read only `req.params` and the model, so the base `FrameworkRequest` is enough. To customize the prefix, override `getHttpPath()`. See [Controllers](06-Controllers/01-intro.md).

:::warning
`req.params.id` is **not** validated by the framework. Passing a malformed id to `findById` throws a Mongoose `CastError` (a 500). Guard it — see [Validate an ObjectId](#validate-an-objectid).
:::

## Add a route with a body schema

Declare a `request:` schema inline. The framework validates and casts the body **before** your handler runs, strips unknown keys, and exposes the typed result on `req.appInfo.request`. Run `npm run gen` to emit `Article.routes.gen.ts` (where `PostCreateRequest` lives) and type the handler with it.

```ts
// src/controllers/Article.ts
import type { PostCreateRequest } from "./Article.routes.gen.ts";
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";
import type { Response } from "express";
import { object, string } from "yup";

class Article extends AbstractController {
  get routes() {
    return {
      post: {
        "/": {
          handler: this.postCreate,
          request: object().shape({
            title: string().trim().min(3).max(300).required(),
            body: string().trim().required(),
          }),
        },
      },
    };
  }

  async postCreate(req: PostCreateRequest, res: Response) {
    // req.appInfo.request.title / .body are typed (from the schema) and already validated
    const Article = this.app.getModel("Article");
    const created = await Article.create(req.appInfo.request);
    return res.status(201).json({ data: created });
  }
}
```

The handler type `PostCreateRequest` is generated from the method name (`postCreate` → `PostCreateRequest`). Any [Standard Schema](https://standardschema.dev/) validator works (yup, zod, valibot, arktype), or the zero-dependency [`defineSchema`](14-helpers.md). See [Routes → Validation](06-Controllers/02-routes.md#validation).

## Validate an ObjectId

The framework validates `request:` (body) and `query:` schemas before your handler runs — but **not** path params. A handler that passes a raw `:id` straight to Mongoose (`Model.findById(req.params.id)`) throws a Mongoose **`CastError`** on a malformed id, and a `CastError` is not a `ValidationError`, so it surfaces as a **500**, not a clean 400. Validate ids explicitly.

**Body / query fields** — add the check to the schema you already declare. A strict 24-hex pattern is enough:

```ts
import { object, string } from "yup";

// in a route:
query: object().shape({
  authorId: string().matches(/^[0-9a-fA-F]{24}$/, "must be a valid id"),
}),
// zod equivalent: z.object({ authorId: z.string().regex(/^[0-9a-fA-F]{24}$/) })
```

A bad value is rejected with the framework's standard `{ errors: { authorId: [...] } }` 400 — it never reaches your handler.

**Path params (`:id`)** — params aren't schema-validated, so guard them in the handler before touching the model:

```ts
import mongoose from "mongoose";
import type { FrameworkRequest } from "@adaptivestone/framework/services/http/HttpServer.js";
import type { Response } from "express";

async getOne(req: FrameworkRequest, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    // Match the framework's validation-error shape: { errors: { field: [msg] } }
    return res.status(400).json({ errors: { id: ["must be a valid id"] } });
  }
  const Article = this.app.getModel("Article");
  return res.status(200).json({ data: await Article.findById(req.params.id) });
}
```

:::note Strict vs loose
`mongoose.isValidObjectId` is lenient — it also accepts any 12-character string (and some numbers). For a tighter check, use the 24-hex regex (`/^[0-9a-fA-F]{24}$/`).
:::

For many `:id` routes, factor the guard into a small reusable middleware (see [Write a middleware that contributes to `req.appInfo`](#write-a-middleware-that-contributes-to-reqappinfo)) and just list it in each route's `middleware`.

:::note Planned
A declarative `params:` route schema — validating and coercing path params the same way `request:` / `query:` do, with the typed result on `req.appInfo.params` — is planned for a future release. Until then, validate params in the handler (or a middleware) as shown above.
:::

## Wire pagination

Add the built-in `Pagination` middleware to the route. It reads `page` / `limit` from the query and puts `{ page, limit, skip }` on `req.appInfo.pagination`. Because that field is middleware-provided, type the handler with its generated alias (`ListRequest`) — `Pagination`'s `provides` flows into it.

```ts
import Pagination from "@adaptivestone/framework/services/http/middleware/Pagination.js";
import type { ListRequest } from "./Article.routes.gen.ts";
import type { Response } from "express";

get routes() {
  return {
    get: {
      "/": {
        handler: this.list,
        middleware: [[Pagination, { limit: 20, maxLimit: 100 }]],
      },
    },
  };
}

async list(req: ListRequest, res: Response) {
  const { skip, limit, page } = req.appInfo.pagination; // typed via Pagination's `provides`
  const Article = this.app.getModel("Article");
  const [items, total] = await Promise.all([
    Article.find().skip(skip).limit(limit),
    Article.countDocuments(),
  ]);
  return res.status(200).json({ data: { items, page, limit, total } });
}
```

`[Pagination, { limit, maxLimit }]` is the tuple form — a middleware class plus its params. See [Middleware → Pagination](06-Controllers/03-middleware.md#pagination).

## Require authentication

Put `GetUserByToken` (parses the token → `req.appInfo.user`) and `Auth` (rejects unauthenticated requests) in the chain. After `Auth`, `req.appInfo.user` is typed as required in the generated alias — no `if (!user)` guard needed.

```ts
import GetUserByToken from "@adaptivestone/framework/services/http/middleware/GetUserByToken.js";
import Auth from "@adaptivestone/framework/services/http/middleware/Auth.js";
import type { ListMineRequest } from "./Article.routes.gen.ts";
import type { Response } from "express";

get routes() {
  return {
    get: {
      "/mine": {
        handler: this.listMine,
        middleware: [GetUserByToken, Auth],
      },
    },
  };
}

async listMine(req: ListMineRequest, res: Response) {
  // req.appInfo.user is required here (Auth's `provides`)
  const Article = this.app.getModel("Article");
  return res.status(200).json({
    data: await Article.find({ owner: req.appInfo.user._id }),
  });
}
```

To apply one chain to **every** route in the controller, use the middleware Map instead:

```ts
static get middleware() {
  return new Map([["/{*splat}", [GetUserByToken, Auth]]]);
}
```

See [Middleware](06-Controllers/03-middleware.md).

## Write a middleware that contributes to `req.appInfo`

Extend `AbstractMiddleware`, set your field on `req.appInfo`, and declare `static get provides()` so handlers downstream get it typed. Type the middleware's own `req` with the field it writes (an inline intersection on the base `FrameworkRequest`).

```ts
// src/middleware/WithArticleCount.ts
import AbstractMiddleware from "@adaptivestone/framework/services/http/middleware/AbstractMiddleware.js";
import type { FrameworkRequest } from "@adaptivestone/framework/services/http/HttpServer.js";
import type { Response, NextFunction } from "express";

class WithArticleCount extends AbstractMiddleware {
  static get description() {
    return "Adds the total article count to req.appInfo";
  }

  static get provides() {
    return {} as { articleCount: number };
  }

  async middleware(
    req: FrameworkRequest & { appInfo: { articleCount?: number } },
    res: Response,
    next: NextFunction,
  ) {
    const Article = this.app.getModel("Article");
    req.appInfo.articleCount = await Article.countDocuments();
    return next();
  }
}

export default WithArticleCount;
```

The object `provides` returns is always `{}` — only its cast type matters (codegen reads it; the runtime ignores it). Any route with `WithArticleCount` in its chain now has `req.appInfo.articleCount: number` in its generated alias. See [Routes → Middleware-provided types](06-Controllers/02-routes.md#middleware-provided-types).

## Override a framework controller

Create a controller with the same filename as a built-in one and extend it — your version wins via the [file-inheritance](03-files-inheritance.md) mechanism. Override only the handlers you want to change.

```ts
// src/controllers/Auth.ts
import OriginalAuth from "@adaptivestone/framework/controllers/Auth.js";
import type { FrameworkRequest } from "@adaptivestone/framework/services/http/HttpServer.js";
import type { Response } from "express";

class Auth extends OriginalAuth {
  async postLogin(req: FrameworkRequest, res: Response) {
    // your custom login — call super for the default behavior, or replace it
    return super.postLogin(req, res);
  }
}

export default Auth;
```

The same approach works for models and configs. See [File Inheritance](03-files-inheritance.md).

## Test a controller with the framework helpers

The framework boots a real test server and an in-memory Mongo. Use `getTestServerURL()` for the base URL and `appInstance.getModel()` to seed and reset data.

```ts
// src/controllers/Article.test.ts
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";
import { getTestServerURL } from "@adaptivestone/framework/tests/testHelpers.js";
import { beforeEach, describe, expect, it } from "vitest";

describe("Article controller", () => {
  beforeEach(async () => {
    await appInstance.getModel("Article").deleteMany({});
  });

  it("creates an article", async () => {
    const res = await fetch(getTestServerURL("/article"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello world", body: "..." }),
    });
    expect(res.status).toBe(201);
  });
});
```

For authenticated requests, create a user and send its token in the `Authorization` header. See the [Testing](09-testsing.md) chapter for the full setup, helpers, and CI examples.
