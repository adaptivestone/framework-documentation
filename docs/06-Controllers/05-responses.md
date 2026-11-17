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

Handlers that write to `res` (`res.status(201).json(...)`) keep working. A handler does one or the other; see [Writing to `res` and returning a response](#writing-to-res-and-returning-a-response).

Errors are still **thrown** (`throw new NotFoundError(...)`), not returned; see [Error handling](04-error-handling.md).

## Response kinds

Every factory except `native` takes the status first.

| Factory | Body | Default media type |
| --- | --- | --- |
| `HttpResponse.json(status, body, options?)` | any JSON value (not `undefined`) | `application/json` |
| `HttpResponse.text(status, text, options?)` | string | `text/plain` |
| `HttpResponse.bytes(status, bytes, options?)` | `Uint8Array` (a `Buffer` is one) | `application/octet-stream` |
| `HttpResponse.stream(status, source, options?)` | `ReadableStream`, async iterable or Node `Readable` | `application/octet-stream` |
| `HttpResponse.redirect(status, location, options?)` | you pass none; `location` is a string or a `URL` | a short `text/plain` or `text/html` notice, chosen by `Accept` |
| `HttpResponse.empty(status, options?)` | no body | — |
| `HttpResponse.native(response)` | a Web `Response`, sent as it is | from the response |

```js
return HttpResponse.text(200, "<p>Hi</p>", { contentType: "text/html" });
return HttpResponse.empty(204);
return HttpResponse.redirect(303, `/orders/${order.id}`);
return HttpResponse.json(422, problem, { contentType: "application/problem+json" });
```

`options` is `{ headers, contentType }` (`redirect` and `empty` take only `headers`). Set the media type with `contentType`: `json`, `text`, `bytes` and `stream` reject a `content-type` entry in `headers`, and `redirect` rejects a `location` header. Both throw a `TypeError`.

JSON, text and bytes are sent the same way `res.json` and `res.send` send them: same serialization, `ETag` and conditional-GET (304) handling, and `charset=utf-8` on JSON and text.

## Status rules

A status a response kind cannot carry fails to compile when written as a literal, and throws a `RangeError` at run time:

- informational statuses (1xx) are never responses;
- 204, 205 and 304 never carry a body: only `HttpResponse.empty` accepts them;
- 206 is accepted by no factory except `native`, which sends a Web `Response` as it is;
- `redirect` accepts only 301, 302, 303, 307 and 308.

```ts
HttpResponse.json(204, {}); // does not compile: use HttpResponse.empty(204)
HttpResponse.empty(206); // does not compile
HttpResponse.empty(200); // compiles: a 200 without a body
```

A status computed at run time (a `number` variable) compiles and is checked when the response is built (`redirect` needs a value typed as one of its five statuses). A status outside 200–599 always throws a `RangeError`.

## Headers

`headers` accepts a plain object, a `Headers` object, or `[name, value]` pairs:

```js
return HttpResponse.json(200, report, {
  headers: { "Cache-Control": "no-store", "Set-Cookie": "seen=1; Path=/" },
});
```

Names are normalized to lower case and repeated names are combined, except `set-cookie`, which keeps one entry per cookie. A response's `headers` can be passed as `headers` to another factory, which is how you copy them when you build a new response from an existing one (for `native`, read them from `response.response.headers`).

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
  const user = await createUser(req.appInfo.request);
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

- The status and headers are sent together with the **first chunk**. An error before it is answered like any thrown error, through the [error-handler registry](04-error-handling.md) (usually a 500), and none of the stream's headers are sent. An error after it aborts the connection and is logged.
- When the client disconnects, the framework stops reading at once, also while it waits for a chunk, and stops the source: a `ReadableStream` is cancelled, and an async generator's `finally` block runs (once its current step finishes).
- A `HEAD` request gets the status and headers without a body; the source is stopped without being read.

## Web `Response` pass-through

`HttpResponse.native(response)` sends a Web `Response` as it is: status, status text, headers and body. Framing headers the server sets itself (`connection`, `transfer-encoding`, …) are dropped. A body is sent like a stream, with the rules above. `Response.error()`, or a response whose body was already read, throws a `TypeError`.

:::warning Proxying a `fetch()` response
`fetch()` decompresses the body but keeps the upstream `content-encoding` and `content-length` headers. Remove them before returning the response, or clients receive a body that does not match its headers.
:::

## Writing to `res` and returning a response

A handler does one or the other. If it sends the response through `res` and also returns an `HttpResponse`, the framework logs an error and does not send the returned one. Headers set on `res` *without* sending the response (`res.setHeader(...)`) are kept and merged with the returned response.

## Overriding built-in controllers

The built-in `Auth`, `Home` and `Health` handlers return their response. An override that calls the built-in handler should return its result:

```js
import OriginalAuth from "@adaptivestone/framework/controllers/Auth.js";

class Auth extends OriginalAuth {
  async postLogin(req, res) {
    audit("login attempt", req.appInfo.request.email);
    return super.postLogin(req, res); // return it
  }
}

export default Auth;
```

Overrides that write to `res` themselves keep working and keep compiling.

:::info Upgrading to 5.7.0

- An override that calls the built-in handler without returning the result (`await super.postLogin(req, res)`, or the same call without `await`) still answers with that response. Node prints a one-time `ASF_DEP_DROPPED_RESPONSE` deprecation warning for that handler. This is transitional: v6 will not send a response that was not returned.
- With `await`, that response is sent when your override finishes, not when the built-in handler does. Code after the call runs before the response goes out, and if it throws, the client gets the error response instead.
- After the call, `res.statusCode` shows the built-in answer's status, as before, so a check like `if (res.statusCode === 201)` keeps working. Nothing has been sent yet at that point (`res.headersSent` is false). In new code, read the status from the returned response: `const response = await super.postRegister(req, res)`, then `response.status`.
- An override that calls the built-in handler and then answers through `res` itself should do so before it returns. If it answers later (in a callback, for example), the built-in response can be sent first.
- The built-in handlers no longer call `res.json` or `res.status`. A wrapper around `res` that changed what they send no longer has an effect, and a status set on `res` before the call is replaced by the built-in status. Change the returned response instead.
- Do not wait for `res` to finish inside the override after the call: the response is sent only once the override returns, so that wait never completes.
- A built-in handler used directly as an Express route handler, outside the framework's routes, no longer answers by itself.
- The built-in handlers' return types now include `HttpResponse`, so an override annotated `Promise<Response>` that returns the built-in result no longer compiles. Widen the annotation or drop it.
- The `Auth` answers without a body (register 201, verify and recover 200) no longer send `Content-Type: application/json`.
- The built-in `Auth`, `Home` and `Health` answers, like every JSON response the framework builds (404, 405, 415, validation and body-parser errors, the 500), are sent as `application/json`. This replaces a `Content-Type` set on `res` earlier, for example by a middleware calling `res.type(...)`; before, they kept it. To send another media type on every response, set `contentType` in [`transformResponse`](#reshaping-every-response-transformresponse).

:::

## Reshaping every response: `transformResponse`

`transformResponse` is an optional `Server` option: one function that sees every response the framework is about to send and returns the response to send. Use it when your API has one wire convention for all bodies, including the ones the framework builds (validation errors, 404, 500), for example a `{ data }` envelope:

```js
import { HttpResponse } from "@adaptivestone/framework/services/http/responses.js";

const server = new Server({
  ...folderConfig,
  transformResponse: (response) =>
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

- It receives the response and `{ req }`, the request.
- It covers responses handlers return, validation and other error responses (including error-handler results), the 404 and 405 pages, the malformed-URL 400 and the 415. This includes the built-in `Auth`, `Home` and `Health` responses (login already answers `{ data: … }`, so an envelope wraps it twice unless you skip those). A response written to `res` directly, by a handler or a middleware, is **not** transformed.
- It must be synchronous: match on `response.kind` and return the kinds you don't reshape unchanged.
- If it throws, returns a Promise, or returns anything that is not an `HttpResponse`, the error is logged and the original response is sent. A broken transform never takes the API down.
- If it replaces a streaming response (a `stream`, or a `native` response with a body) with one that does not send that body, the dropped stream is cancelled. A replacement that wraps the original stream reads it itself, and is responsible for stopping it when the client disconnects.
- Pass the same option to [`configureTestServer`](../09-testsing.md#production-http-wiring-boothttp) so your tests see the same bodies.

To keep it in its own module, type it with `TransformResponseHook` from `@adaptivestone/framework/server.js`.

Most applications don't need it: by default every response goes out exactly as it was built.
