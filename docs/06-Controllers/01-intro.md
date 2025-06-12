# Controllers

Controllers are one of the most important parts of the framework. The framework works around the [https://expressjs.com/](https://expressjs.com/) HTTP framework and provides a convenient way to build a complex system around HTTP infrastructure.

:::note

Controller files are part of the [framework inheritance process](03-files-inheritance.md).

:::

The framework provides error handling, controller autoloading (including subfolders), and request validation and casting from scratch.

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

Only "routes" is a necessary part. Other parts can be kept as is.
:::

:::warning

Controllers should extend the "AbstractController" module.
:::

## Name Convention and Loading

The framework will load any file (except \*.test.(js|ts) files) and initialize it as an HTTP module. The default name of the file will be the route name. This behavior can be changed by providing your own **getHttpPath** function.

For the sample above:

```js
class ControllerName extends AbstractController {
```

The route will be “http://localhost:3300/controllername”.

Then, any method from the router will appear in the URL.

If you want to have your own path, please provide your implementation of the `getHttpPath` function.

```js
  getHttpPath() {
    return "superDuperMegaSpecialRoute";
  }
```

By default, `getHttpPath` resolves the current folder and filename and uses it as a route name.

## Request Flow

![RequestFlow](/img/requestFlow.jpg)

## View

By default, the framework uses the Express option to render views with a Pug template. To render a view, you need to create a view file in the view folder and then call it with the necessary parameters.

```js
res.render("template", { title: "Hey", message: "Hello there!" });
```

## JSON

JSON is the most common way to communicate on the modern internet. But it is too flexible, and sometimes developers can be confused. How to use it in an appropriate way?

We provide [basic documentation](https://andrey-systerr.notion.site/API-JSON-41f2032055ae4bddae5d033dc28eb1d3) of how we expect to work with JSON. The framework follows those rules.

## Configuration

The configuration file is located in “config/http.js”.

Please take a look at it.

Most notable options:

```js
port; // Port that the server will use. By default, process.env.HTTP_PORT or port 3300.
hostname; // IP to bind to. By default, process.env.HTTP_HOST or '0.0.0.0' (any). Could be dangerous.
corsDomains; // CORS-allowed domains.
```
