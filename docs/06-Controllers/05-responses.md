# Responses

Since 5.7, a route handler can **return** its response instead of writing to `res`. The framework sends it:

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";
import { HttpResponse } from "@adaptivestone/framework/services/http/responses.js";

class Users extends AbstractController {
  get routes() {
    return {
      post: { "/": { handler: this.create, request: createUserSchema } },
    };
  }

  async create(req) {
    const user = await this.app.getModel("User").create(req.appInfo.request);
    return HttpResponse.json(201, { data: user.getPublic() });
  }
}
```

Writing to `res` (`res.status(201).json(...)`) keeps working through all of 5.x. Version 6 removes `res` from ordinary handlers, so new code should return responses. A controller can also opt in to handlers that take the request context instead of `req` — see [Handlers with `ctx`](06-context.md#handlers-with-ctx).

Errors are still **thrown** (`throw new NotFoundError(...)`), not returned; see [Error handling](04-error-handling.md).

## Response kinds

Every factory takes the status first.

| Factory | Body | Default media type |
| --- | --- | --- |
| `HttpResponse.json(status, body, options?)` | any JSON value (not `undefined`) | `application/json` |
| `HttpResponse.text(status, text, options?)` | string | `text/plain` |
| `HttpResponse.bytes(status, bytes, options?)` | `Uint8Array` (a `Buffer` is one) | `application/octet-stream` |
| `HttpResponse.stream(status, source, options?)` | `ReadableStream`, async iterable or Node `Readable` | `application/octet-stream` |
| `HttpResponse.redirect(status, location, options?)` | — (301, 302, 303, 307 or 308) | — |
| `HttpResponse.empty(status, options?)` | no body | — |
| `HttpResponse.native(response)` | a Web `Response`, sent as it is | from the response |

```js
return HttpResponse.text(200, "<p>Hi</p>", { contentType: "text/html" });
return HttpResponse.empty(204);
return HttpResponse.redirect(303, `/orders/${order.id}`);
return HttpResponse.json(422, problem, { contentType: "application/problem+json" });
```

`options` is `{ headers, contentType }` (`redirect` and `empty` take only `headers`). Set the media type with `contentType`: a `content-type` entry in `headers` is rejected, and so is a `location` header on a redirect.

JSON, text and bytes are sent the same way `res.json` and `res.send` send them: same serialization, `ETag` and conditional-GET (304) handling, and `charset=utf-8` on JSON and text.

## Status rules

A status a response kind cannot carry fails to compile when written as a literal, and throws a `RangeError` at run time:

- informational statuses (1xx) are never responses;
- 204, 205 and 304 never carry a body: only `HttpResponse.empty` accepts them;
- 206 is reserved for range-aware file responses (a later addition), so no factory accepts it.

A status computed at run time (a `number` variable) compiles and is checked when the response is built.

## Headers

`headers` accepts a plain object, a `Headers` object, or `[name, value]` pairs:

```js
return HttpResponse.json(200, report, {
  headers: { "Cache-Control": "no-store", "Set-Cookie": "seen=1; Path=/" },
});
```

Names are normalized to lower case and repeated names are combined, except `set-cookie`, which keeps one entry per cookie. A response's `headers` can be passed as `headers` to another factory, which is how you copy them when you build a new response from an existing one.

Headers already set on the request's response (security headers, CORS, anything your middleware set) stay. A returned header with the same name replaces one set earlier, `set-cookie` is appended, and `vary` is merged.

## Typing handlers

The factories keep the literal status, media type and body type, so the return type documents the handler:

```ts
import {
  HttpResponse,
  type EmptyResponse,
  type JsonResponse,
} from "@adaptivestone/framework/services/http/responses.js";

async create(req: PostCreateRequest): Promise<JsonResponse<201, { data: UserDto }>> {
  return HttpResponse.json(201, { data: toDto(user) });
}

async remove(req: DeleteRemoveRequest): Promise<EmptyResponse<204>> {
  await removeUser(req.appInfo.params.id);
  return HttpResponse.empty(204);
}
```

Also exported: `TextResponse`, `BytesResponse`, `StreamResponse`, `RedirectResponse`, `NativeResponse`, and `HttpResponse` (any response).

## Streams

```js
async export(req) {
  const cursor = this.app.getModel("Order").find().cursor();
  return HttpResponse.stream(200, toCsvLines(cursor), { contentType: "text/csv" });
}
```

- The status and headers are sent together with the **first chunk**. An error before it is answered like any thrown error (through the [error-handler registry](04-error-handling.md), usually a 500). An error after it aborts the connection and is logged.
- When the client disconnects, the source is stopped: a `ReadableStream` is cancelled, and an async generator's `finally` block runs.
- A `HEAD` request gets the status and headers; the source is cancelled without being read.

## Web `Response` pass-through

`HttpResponse.native(response)` sends a Web `Response` as it is: status, status text, headers and body. Framing headers the server sets itself (`connection`, `transfer-encoding`, …) are dropped.

:::warning Proxying a `fetch()` response
`fetch()` decompresses the body but keeps the upstream `content-encoding` and `content-length` headers. Remove them before returning the response, or clients receive a body that does not match its headers.
:::

## Writing to `res` and returning a response

A handler does one or the other. If it writes the response through `res` and also returns an `HttpResponse`, the framework logs an error and does not send the returned one. Headers set on `res` *without* sending the response are kept and merged with the returned response.

## Overriding built-in controllers

The built-in `Auth`, `Home` and `Health` controllers return their responses. An override that calls the built-in handler must return its result:

```js
class Auth extends FrameworkAuth {
  async postLogin(req, res) {
    audit("login attempt", req.appInfo.request.email);
    return super.postLogin(req, res); // return it
  }
}
```

An override that only awaits it (`await super.postLogin(req, res)`) still answers with that response in 5.x, and the framework emits a one-time `ASF_DEP_DROPPED_RESPONSE` warning. Version 6 will not send a response that was not returned. Overrides that write to `res` themselves keep working and keep compiling.

## Reshaping every response: `transformResponse`

`transformResponse` is an optional `Server` option: one function that sees every response the framework is about to send and returns the response to send. Use it when your API has one wire convention for all bodies, including the ones the framework builds (validation errors, 404, 500), for example a `{ data }` envelope:

```js
import { HttpResponse } from "@adaptivestone/framework/services/http/responses.js";

const server = new Server({
  ...folderConfig,
  transformResponse: (response, { req }) =>
    response.kind === "json"
      ? HttpResponse.json(
          response.status,
          { data: response.body },
          { headers: response.headers, contentType: response.contentType },
        )
      : response,
});
```

| Request | Without a transform | With the transform above |
| --- | --- | --- |
| handler returns `HttpResponse.json(200, { id: 1 })` | `{"id":1}` | `{"data":{"id":1}}` |
| `GET /nope` | `{"error":"NOT_FOUND","message":"Not found"}` | `{"data":{"error":"NOT_FOUND","message":"Not found"}}` |

- It covers responses handlers return, validation and other error responses, the 404 and 405 pages, and error-handler results. A handler that writes to `res` itself is **not** transformed.
- It must be synchronous and return an `HttpResponse`: match on `response.kind` and return the kinds you don't reshape unchanged.
- If it throws or returns anything else, the error is logged and the original response is sent; a broken transform never takes the API down.
- Pass the same option to [`configureTestServer`](../09-testsing.md#production-http-wiring-boothttp) so your tests see the same bodies.
- The generated [OpenAPI document](../17-openapi.md) describes untransformed bodies.

Most applications don't need it: by default every response goes out exactly as it was built.
