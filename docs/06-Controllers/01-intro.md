# Controllers

Controllers are one of the most important parts of the framework. Framework works around [https://expressjs.com/](https://expressjs.com/) http framework and provide convenient way to build complex system around http infrastructure

:::note

Controllers files part of [framework inheritance process ](03-files-inheritance.md).

:::

Framework provides from scratch error handling, controllers autoload (including subfolders) and request validation and casting

## Controlles structure

```js
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");

class ControllerName extends AbstractController {
  constructor(app, prefix) {
    // optional constructor. In case you want to keep req.params from main router
    // by default params from parent router omitted
    // usefull when some params exists on "getExpressPath" path
    super(app, prefix, true);
  }

  get routes() {
    // return routes info
    // NECESSARY part
  }
  getExpressPath() {
    // return path for exprress (in 99% cases optional)
  }

  static get middleware() {
    return new Map();
    // return middlewares for THIS route only
  }
}
module.exports = ControllerName;
```

:::tip

Only "routes" is necessary part. Other parts can be keep as it
:::

:::warning

Controllers should extends "AbstractController" modules
:::

## Name convention and loading

Framework will load any file (except \*.test.js files) and initi is a http module. But the default name on the file will be a route name. But this behavior can be changed by providing own **getExpressPath** function

For sample above

```js
class ControllerName extends AbstractController {
```

Route will be “http://localhost:3300/controllername”

Then any method from router will be appear to url

If you want to have own path please provide you implementation of getExpressPath function

```js
  getExpressPath() {
    return "superDuperMegaSpecialRoute";
  }
```

By default getExpressPath resolved current folder and filename and use it as a route name

## Request flow

![RequestFlow](/img/requestFlow.jpg)

## View

By default the framework uses the express option to render views with a pug template. To render view you need to create view file on view folder and then call it with necessary parameters

```js
res.render("template", { title: "Hey", message: "Hello there!" });
```

## JSON

JSON is the most common way to communicate on the modern internet. But it is too flexible and sometimes developers can be confused. How to use it in an appropriate way

We provide [basic documentation](https://andrey-systerr.notion.site/API-JSON-41f2032055ae4bddae5d033dc28eb1d3) of how we expect to work with JSON. Framework follow that rules

## Configuration

Configuration file located on “config/http.js”

Please take a look into it

Most notable options:

```js
port; //port that server will be to use. By default process.env.HTTP_PORT or port 3300
hostname; // ip to bind for. By default  process.env.HTTP_HOST or  '0.0.0.0' (any). Could be dangrous.
corsDomains; // CORS allowed domain.
```
