# Controllers

Controllers are one of the most important parts of the framework. Framework works around [https://expressjs.com/](https://expressjs.com/) http framework and provide convenient way to build complex system around http infrastructure

:::note

Controllers files part of [framework inheritance process ](03_files-inheritance.md).

:::

Framework provides from scratch error handling, controllers autoload (including subfolders) and request validation and casting

## Controlles structure

```js
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");

class ControllerName extends AbstractController {
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
module.exports = Auth;
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

## Middleware

You can read more about middlewares on [https://expressjs.com/en/guide/using-middleware.html](https://expressjs.com/en/guide/using-middleware.html)

In general it’s a function that accepts request, response and next callback. This function can analyze requests and add more details to it (like parse JSON, GET query params or check user token). Middleware can pass requests to the next level (next middleware or handler) or can respond directly and finish requests.

This is really powerful and allow developer to reuse simple logic and build route on this simple building blocks

Default

```js
  static get middleware() {
    return new Map([['/*', [PrepareAppInfo, GetUserByToken, Auth]]]);
  }
```

### Middleware order

Middleware will be executed in the provided order. Based on that you can chain middleware where input on second middleware depends on output first middleware

### Global middlewares

Framework uses internally few middlewares. This middlewares not adjustable (for now) and executed on each request

[i18next-http-middleware](https://github.com/i18next/i18next-http-middleware)

[cors](https://github.com/expressjs/cors)

[express.static](https://expressjs.com/en/starter/static-files.html)

[express.json](https://expressjs.com/en/api.html#express.json)

[express.urlencoded](https://expressjs.com/en/api.html#express.urlencoded)

### Including middlewares into controllers

Controllers level middleware adjusted based on “middleware” getter

```js
  static get middleware() {
    return new Map([['METHOD/path', ["Middleware","Array"]]]);
    // return middlewares for THIS route only
  }
```

Where
'METHOD/path' is a method with a path. Any supported methods by express server supported here (GET, POST, PUT, DELETE, etc). Possible to start router with any method that supported by Express and middleware will be scoped by this method. If middleware route started from "/" then ALL method will be used

Path is part of the express regex path. [https://expressjs.com/en/5x/api.html#router.methods](https://expressjs.com/en/5x/api.html#router.methods)

Middleware array - array of middlewares (with params)

Sample

```javascript
  static get middleware() {
    return new Map([['GET/*', [PrepareAppInfo, GetUserByToken]]]);
  }
```

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        PrepareAppInfo,
        GetUserByToken,
        [RoleMiddleware, { roles: ['admin'] ]}]
      ]]
    ]);
  }
```

:::warning
Middleware here not a raw express middlewares. Please see below
:::

### Middleware parameters

Some middleware acept initial parameters pass into it,

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        PrepareAppInfo // middleware with no parameters
        [RoleMiddleware, { roles: ['admin'] ]}] // middleware with parameters
      ]]
    ]);
  }
```

To pass parameters wrap middleware into an array. First element will be middleware inself, second one - middleware parameters. Second on will be pass as it into middleware constructor

### Build in middleware

Frameworks have few middlewares that you can use

#### GetUserByToken

```js
const GetUserByToken = require("@adaptivestone/framework/services/http/middleware/GetUserByToken");
```

Grab a token and try to parse the user from it. It user exist will add req.appInfo.user variable

##### Parameters

No parameters

#### Auth

```js
const Auth = require("@adaptivestone/framework/services/http/middleware/Auth");
```

Allow to pass only if the user provided. Please use any middleware that provide user instance before

##### Parameters

No parameters

#### Role

Check user role (user.roles property). If the user has no role then stop request and return error. OR logic (any role will pass user)

```js
const Role = require("@adaptivestone/framework/services/http/middleware/Role");
```

##### Parameters

roles - array of roles to check. OR logic (any role)

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        [RoleMiddleware, { roles: ['admin','moderator'] ]}]
      ]]
    ]);
  }
```

#### RateLimiter

Rate limiter middleware. Limit amount of request.

```js
const RateLimiter = require("@adaptivestone/framework/services/http/middleware/RateLimiter");
```

As rate limited we are using [node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) module. Please refer to module documentation for more details

Basic idea of a rate limiter is that we have some weight of the call and some key that has ‘credits’ . Each call consumes ‘credits’ and when it is 0 then the request is blocked.

Same samples - login protection. We can generate rate limiters based on user email and limit for each email only by 5 calls per minute. Or we can construct more complex login that included user IPs, etc

##### Parameters

Be default rate key generated based on Route, IP and userID. But you can adjust it via config (global) or via middleware parameters

```javascript
  static get middleware() {
    return new Map([
      [
        'POST/login',
        [
          PrepareAppInfo,
          GetUserByToken,
          [
            RateLimiter,
            {
              consumeKeyComponents: { ip: false },
              limiterOptions: { points: 5 },
            },
          ],
        ],
      ],
    ]);
  }
```

Rate limited middleware allows you to include request components (req.body) for key generation. Please note that you have no access to req.appInfo.request on this stage

```javascript
  static get middleware() {
    return new Map([
      ['POST/login', [
        PrepareAppInfo,
        GetUserByToken,
        [RateLimiter,{consumeKeyComponents: { ip: false, request:['email','phone'] }}]
      ]]
    ]);
  }
```

You can find default parameters on ‘config/rateLimiter.js’. This parameters used if other parameters not provided.

Rate limiter have multiple backends (memory, redis and mongo). Buy default 'memory' backend activated

### Creating own middlewares (or integrate external)

You can create your own middleware. To do that you should extend AbstractMiddleware and provide at least two own functions - description and middleware. Please check code bellow

```js
const AbstractMiddleware = require("@adaptivestone/framework/services/http/middleware/AbstractMiddleware");

class CustomMiddleware extends AbstractMiddleware {
  static get description() {
    return "Middleware descrition";
  }

  async middleware(req, res, next) {
    // check something
    if (!req.body.yyyyy) {
      //  return and stop processing
      return res.status(400).json({});
    }
    if (this.params.iiii){
      // we can also check all params that we passed during init
    }
    // go to next one
    return next();
  }
}

module.exports = CustomMiddleware;
```

## Routes

TODO yup

[NEW] new route handler format with request validations and casting (yup based)

```javascript
  get routes() {
    return {
      post: {
        '/': {
          handler: this.postSample,
          request: yup.object().shape({
            count: yup.number().max(100)required(),
          })
        }
      }
    }
  }
  // send request with data  {count: "5000"}
  // will produce error with status 400 and {errors: {count:['Text error']}}


  postSample(req,res) =>{
    // on success validate we pass here.
    // {count: "5000"}
    console.log(req.appInfo.request)
    // {count: 5000} -> casted to number
  }

```

[UPDATE] add warning when using 'req.body' directly
[BREAKING] Possible breaking. AsyncFunction now required for router handler (it always was but without checking of code)

## View

By default the framework uses the express option to render views with a pug template. To render view you need to create view file on view folder and then call it with necessary parameters

```js
res.render("template", { title: "Hey", message: "Hello there!" });
```

## Configuration

Configuration file located on “config/http.js”

Please take a look into it

Most notable options:

```js
port; //port that server will be to use. By default process.env.HTTP_PORT or port 3300
hostname; // ip to bind for. By default  process.env.HTTP_HOST or  '0.0.0.0' (any). Could be dangrous.
corsDomains; // CORS allowed domain.
```
