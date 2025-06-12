# Controllers

Controllers are a crucial component of the framework, which is built on top of the [Express.js](https://expressjs.com/) HTTP framework. They provide a convenient way to build complex systems with a robust HTTP infrastructure.

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
  constructor(app, prefix) {
    // Optional constructor. In case you want to keep req.params from the main router.
    // By default, params from the parent router are omitted.
    // Useful when some params exist on the "getHttpPath" path.
    super(app, prefix, true);
  }

  get routes() {
    // Return routes info.
    // NECESSARY part.
  }
  getHttpPath() {
    // Return the path for Express (in 99% of cases, optional).
  }

  static get middleware() {
    return new Map();
    // Return middlewares for THIS route only.
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
