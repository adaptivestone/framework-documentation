# Middleware

You can read more about middlewares on [https://expressjs.com/en/guide/using-middleware.html](https://expressjs.com/en/guide/using-middleware.html)

In general it’s a function that accepts request, response and next callback. This function can analyze requests and add more details to it (like parse JSON, GET query params or check user token). Middleware can pass requests to the next level (next middleware or handler) or can respond directly and finish requests.

This is really powerful and allow developer to reuse simple logic and build route on this simple building blocks

Default

```js
  static get middleware() {
    return new Map([['/*', [GetUserByToken, Auth]]]);
  }
```

## Middleware order

Middleware will be executed in the provided order. Based on that you can chain middleware where input on second middleware depends on output first middleware

## Global middlewares

Framework uses internally few middlewares. This middlewares not adjustable (for now) and executed on each request

[cors](https://github.com/expressjs/cors)

[express.static](https://expressjs.com/en/starter/static-files.html)

[PrepareAppInfo](#prepareappinfo)

[RequestLogger](#requestlogger)

[RequestParser](#requestparser)

[I18n](#i18n)

## Including middlewares into controllers

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
    return new Map([['GET/*', [GetUserByToken]]]);
  }
```

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        GetUserByToken,
        [RoleMiddleware, { roles: ['admin'] }]
      ]]
    ]);
  }
```

:::warning
Middleware here not a raw express middlewares. Please see below
:::

## Including middlewares into route object

Middlewares can also be added into route object (subchapter “Routes”)

## Middleware parameters

Some middleware acept initial parameters pass into it,

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        GetUserByToken // middleware with no parameters
        [RoleMiddleware, { roles: ['admin'] }] // middleware with parameters
      ]]
    ]);
  }
```

To pass parameters wrap middleware into an array. First element will be middleware inself, second one - middleware parameters. Second on will be pass as it into middleware constructor

## Build in middleware

Frameworks have few middlewares that you can use

### Auth

```js
const Auth = require("@adaptivestone/framework/services/http/middleware/Auth");
```

Allow to pass only if the user provided. Please use any middleware that provide user instance before (like GetUserByToken)

#### Parameters

No parameters

### GetUserByToken

```js
const GetUserByToken = require("@adaptivestone/framework/services/http/middleware/GetUserByToken");
```

Grab a token and try to parse the user from it. Will find user on databased by token. If user exist will add req.appInfo.user variable.

#### Parameters

No parameters


### I18n

```js
const I18n = require("@adaptivestone/framework/services/http/middleware/I18n");
```

Internationalization module based on [i18next](https://www.npmjs.com/package/i18next). Provides req.appInfo.i18n that can be used to translate 

Middleware provides few detectors
- X-Lang header
- Query 
- User 

Please check [i18n documentation](08-i18n.md) for more details



#### Parameters

No parameters

### Pagination

```js
const Pagination = require("@adaptivestone/framework/services/http/middleware/Pagination");
```

Pagination middleware provides helper that grabs URL search parameters (page, limit) and calculate necessary appInfo properties (skip, limit and page)

#### Parameters

limit = 10 - default limit if not provided

maxLimit = 100 max limit for documents

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        [Pagination, { limit: 10,maxLimit: 50}]
      ]]
    ]);
  }
```

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [Pagination]
    ]);
  }
```

```javascript
// http://localhost:3300/someUrl?limit=10&page=2
const { limit, skip, page } = req.appInfo.pagination;
```

### PrepareAppInfo

```js
const PrepareAppInfo = require("@adaptivestone/framework/services/http/middleware/PrepareAppInfo");
```

PrepareApp info is a special small middleware that generates res.appInfo = {}. To make sure that all middleware after will use appInfo without checking if it exists.
Done for internal usage

#### Parameters

No parameters


### RateLimiter

Rate limiter middleware. Limit amount of request.

```js
const RateLimiter = require("@adaptivestone/framework/services/http/middleware/RateLimiter");
```

As rate limited we are using [node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) module. Please refer to module documentation for more details

Basic idea of a rate limiter is that we have some weight of the call and some key that has ‘credits’ . Each call consumes ‘credits’ and when it is 0 then the request is blocked.

Same samples - login protection. We can generate rate limiters based on user email and limit for each email only by 5 calls per minute. Or we can construct more complex login that included user IPs, etc

#### Parameters

Be default rate key generated based on Route, IP and userID. But you can adjust it via config (global) or via middleware parameters

```javascript
  static get middleware() {
    return new Map([
      [
        'POST/login',
        [
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
        GetUserByToken,
        [RateLimiter,{consumeKeyComponents: { ip: false, request:['email','phone'] }}]
      ]]
    ]);
  }
```

You can find default parameters on ‘config/rateLimiter.js’. This parameters used if other parameters not provided.

Rate limiter have multiple backends (memory, redis and mongo). Buy default 'memory' backend activated


### RequestLogger

```js
const RequestLogger = require("@adaptivestone/framework/services/http/middleware/RequestLogger");
```

Small middleware that logs request info (route, method, status and time). 

Logs example:

```js
[middlewareRequestLogger]  2023-01-24T07:00:35.680Z  info : Request is  [GET] /project/123
[middlewareRequestLogger]  2023-01-24T07:00:35.747Z  info : Finished Request is  [GET] /project/123.  Status: 200. Duration 67 ms
```

#### Parameters

No parameters


### RequestParser

```js
const RequestParser = require("@adaptivestone/framework/services/http/middleware/RequestParser");
```

This is a main middleware to parse request (application/json, multipart/formdata, octet-stream, urlencoded)
It is based on the [formidable](https://www.npmjs.com/package/formidable) package.
After parse data available on tre req.body


#### Parameters

No parameters


### Role

Check user role (user.roles property). If the user has no role then stop request and return error. OR logic (any role will pass user)

```js
const Role = require("@adaptivestone/framework/services/http/middleware/Role");
```

#### Parameters

roles - array of roles to check. OR logic (any role)

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        [RoleMiddleware, { roles: ['admin','moderator'] }]
      ]]
    ]);
  }
```

## Creating own middlewares (or integrate external)

You can create your own middleware. To do that you should extend AbstractMiddleware and provide at least two own functions - description and middleware. Please check code bellow

```js
const AbstractMiddleware = require("@adaptivestone/framework/services/http/middleware/AbstractMiddleware");

class CustomMiddleware extends AbstractMiddleware {
  static get description() {
    return "Middleware descrition";
  }

  // optional
  static get usedAuthParameters() {
    // Array of parameters that are used for authorization within the middleware
    return [
      {
        name: "Authorization", // name of the parameter
        type: "apiKey", // apiKey, http, oauth2, openIdConnect
        in: "header", // header, query, cookie
        description: this?.description,
      },
    ];
  }

  async middleware(req, res, next) {
    // check something
    if (!req.body.yyyyy) {
      //  return and stop processing
      return res.status(400).json({});
    }
    if (this.params.iiii) {
      // we can also check all params that we passed during init
    }
    // go to next one
    return next();
  }
}

module.exports = CustomMiddleware;
```
