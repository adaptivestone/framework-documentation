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

The framework will load any file (except for `*.test.js` and `*.test.ts` files) and initialize it as an HTTP module. By default, the filename will be used as the route name. This behavior can be customized by providing your own `getHttpPath` function.

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

The route will be “http://localhost:3300/controllername”.

Then, any method from the router will be accessible via the URL.

If you want to define a custom path, you can provide your own implementation of the `getHttp-Path` function.

```js
  getHttpPath() {
    return "superDuperMegaSpecialRoute";
  }
```

By default, `getHttpPath` resolves the current folder and filename and uses them to construct the route name.

## Request Flow

![RequestFlow](/img/requestFlow.jpg)

## View

By default, the framework uses Express to render views with the Pug template engine. To render a view, create a template file in the `views` folder and then call it with the required parameters:
++++...
[message is too long]

```js
res.render("template", { title: "Hey", message: "Hello there!" });
```

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
