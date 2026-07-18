# Controllers

Controllers are a crucial component of the framework. The framework uses [Express.js](https://expressjs.com/) for the HTTP lifecycle (listening, body parsing, response API, the third-party middleware ecosystem) and a tree-based `RouteRegistry` for path matching, parameter extraction, method dispatch, and middleware ordering. Controllers contribute subtrees to the global registry — auto-loaded from the controllers folder, mounted via a single Express middleware.

:::note

Controller files are part of the [framework inheritance process](03-files-inheritance.md).

:::

The framework provides built-in error handling, automatic controller loading (including from subfolders), and request validation and casting.

:::note

In production, the framework uses the `cluster` module to start multiple instances (based on the number of CPU cores) and provide load balancing between them.
Keep in mind that you cannot access one process from another. For complex scenarios (like a WebSocket server), you will need to use inter-process communication techniques to send messages between processes.
:::

## Controller Structure

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    // Return routes info.
    // NECESSARY part.
  }

  getHttpPath() {
    // URL prefix for this controller. Default: `/{constructor-name-lowercase}`.
    // Override in a subclass to customize (e.g., `Home` → `/`).
  }

  static get middleware() {
    return new Map();
    // Path-/method-scoped middlewares for routes in THIS controller.
  }
}
export default ControllerName;
```

:::tip

Only the `routes` getter is required; other parts of the controller can be omitted if not needed.
:::

:::warning

Controllers should extend the "AbstractController" module.
:::

## Name Convention and Loading

The framework loads every file in `src/controllers/` except `*.test.js` and
`*.test.ts`. The default mount path comes from the controller's folder prefix
plus its **lowercased class name**. The filename does not determine the URL:
`src/controllers/admin/ImpactSurveys.ts` exporting `class ImpactSurveys`
mounts at `/admin/impactsurveys`.

Filename still matters for framework-internal controller overrides, so name the
file after the class. Never export the same controller class from two files:
the loader initializes both files and mounts the controller twice. Override
`getHttpPath()` when the default class-name path is not the URL you want.

### Explicit registration

In addition to file-based auto-loading, you can register a controller programmatically via `app.controllerManager.registerController(ControllerClass, prefix?)`. This is useful for:

- **Test fixtures** — register a controller only for a specific test (see the [Testing](../09-testsing.md) chapter).
- **Late registration** — controllers added after `Server.startServer()` boots, via the `callbackBefore404` hook so routes mount before the 404 handler.
- **Conditional controllers** — only register based on config, feature flags, or runtime detection.

```js
import MyController from "./controllers/MyController.js";

await server.startServer(async () => {
  // Runs after framework controllers init, before the 404 handler.
  // Routes mount on `/my/mycontroller/*` (prefix + lowercase class name).
  server.app.controllerManager?.registerController(MyController, "my");
});
```

Auto-loading internally uses the same `registerController` entry point — both paths produce identical instances.

For the example above:

```js
class ControllerName extends AbstractController {
```

The route will be `http://localhost:3300/controllername` because the class is
named `ControllerName`; renaming only its file would not change this URL.

Then, any method from the router will be accessible via the URL.

If you want to define a custom path, provide your own implementation of
`getHttpPath()`:

```js
  getHttpPath() {
    return "/super-duper-mega-special-route";
  }
```

By default, `getHttpPath()` combines the folder prefix with the lowercased
class name. It does not kebab-case multi-word names: `ImpactSurveys` becomes
`/impactsurveys`, so use an override when `/impact-surveys` is required.

### Project boot hook (`bootHttp`)

For app-wide HTTP wiring that doesn't belong to any single controller — webhooks, healthchecks, OAuth callbacks, or boot-time setup — pass a **`bootHttp`** function to the `Server` constructor. The framework calls it with the live `app` during `startServer`, after controllers are registered but before the adapter mounts, so anything it adds is in place from the first request.

Define it inline — `app` is inferred, no annotation needed:

```ts title="src/index.ts"
import Server from "@adaptivestone/framework/server.js";

const server = new Server({
  folders: {
    /* … */
  },
  bootHttp: async (app) => {
    // `httpServer` is set by the time bootHttp runs (typed nullable, so use `?.`).
    // An ad-hoc route that doesn't fit the controller convention:
    app.httpServer?.routeRegistry.registerRoute("POST", "/webhooks/stripe", {
      handler: stripeWebhookHandler,
    });

    // Or app-wide Express middleware (runs before the router):
    // app.httpServer?.express.use(myGlobalMiddleware);
  },
});
await server.startServer();
```

There's no required file or folder for it — it's just a function. If it grows, extract it to its own module and type it with `BootHttpHook`:

```ts title="src/bootHttp.ts"
import type { BootHttpHook } from "@adaptivestone/framework/server.js";

const bootHttp: BootHttpHook = async (app) => {
  /* … */
};

export default bootHttp;
```

It's wired **explicitly**, not auto-discovered from a folder: the framework finds everything else through configured folders, and those are all spoken for — `config/` merges its files as config, `controllers/` auto-loads its files as controllers — so there's no conflict-free folder to scan. `bootHttp` is **HTTP-specific** by design: it needs `app.httpServer`, which only exists once the HTTP server boots (CLI and worker processes never run it). Unlike the `callbackBefore404` hook (which you pass to `startServer` and which runs _after_ the adapter mounts), `bootHttp` runs _before_ the mount.

## Request Flow

![RequestFlow](/img/requestFlow.jpg)

## View

:::warning

Built-in view rendering was **removed in version 5**. The framework no longer ships a `views/` folder or a default template engine — it is API-first (returns JSON).

:::

If you need server-rendered HTML, the underlying Express 5 instance is available on `app.httpServer.express` (once the HTTP server has booted), so you can register a template engine yourself (see the [Express template-engine guide](https://expressjs.com/en/guide/using-template-engines.html)). For most applications, return JSON and render on the client.

## JSON

JSON is the most common data format for modern web applications, but its flexibility can sometimes lead to confusion.

We provide [basic documentation](https://andrey-systerr.notion.site/API-JSON-41f2032055ae4bddae5d033dc28eb1d3) on how we recommend working with JSON, and the framework is designed to follow these guidelines.

## Configuration

The configuration file is located at `config/http.js`.

Please take a moment to review it.

The most notable options are:

```js
port; // Port that the server will use. By default, process.env.HTTP_PORT or port 3300.
hostname; // IP to bind to. By default, process.env.HTTP_HOST or '0.0.0.0' (any). Could be dangerous.
corsDomains; // CORS-allowed domains.
```
