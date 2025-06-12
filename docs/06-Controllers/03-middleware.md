# Middleware

You can read more about middlewares at [https://expressjs.com/en/guide/using-middleware.html](https://expressjs.com/en/guide/using-middleware.html).

In general, it’s a function that accepts a request, a response, and a `next` callback. This function can analyze requests and add more details to them (like parsing JSON, getting query params, or checking a user token). Middleware can pass requests to the next level (the next middleware or handler) or can respond directly and finish the request.

This is really powerful and allows developers to reuse simple logic and build routes on these simple building blocks.

Default:

```js
  static get middleware() {
    return new Map([['/{*splat}', [GetUserByToken, Auth]]]);
  }
```

## Middleware Order

Middleware will be executed in the order provided. Based on that, you can chain middleware where the input of the second middleware depends on the output of the first middleware.

## Global Middlewares

The framework internally uses a few middlewares. These middlewares are not adjustable (for now) and are executed on each request.

[Cors](#cors)

[PrepareAppInfo](#prepareappinfo)

[IpDetector](#ipdetector)

[RequestLogger](#requestlogger)

[RequestParser](#requestparser)

[I18n](#i18n)

## Including Middlewares into Controllers

Controller-level middleware is adjusted based on the “middleware” getter.

```js
  static get middleware() {
    return new Map([['METHOD/path', ["Middleware","Array"]]]);
    // return middlewares for THIS route only
  }
```

Where 'METHOD/path' is a method with a path. Any methods supported by the Express server are supported here (GET, POST, PUT, DELETE, etc.). It is possible to start a router with any method that is supported by Express, and the middleware will be scoped by this method. If the middleware route starts with `/`, then ALL methods will be used.

The path is part of the Express regex path: [https://expressjs.com/en/5x/api.html#router.methods](https://expressjs.com/en/5x/api.html#router.methods).

The middleware array is an array of middlewares (with params).

Sample:

```javascript
  static get middleware() {
    return new Map([['GET/{*splat}', [GetUserByToken]]]);
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
The middleware here are not raw Express middlewares. Please see below.
:::

## Including Middlewares into a Route Object

Middlewares can also be added into a route object (subchapter “Routes”).

## Middleware Parameters

Some middleware accept initial parameters passed into them.

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        GetUserByToken, // middleware with no parameters
        [RoleMiddleware, { roles: ['admin'] }] // middleware with parameters
      ]]
    ]);
  }
```

To pass parameters, wrap the middleware in an array. The first element will be the middleware itself, and the second one will be the middleware parameters. The second one will be passed as is into the middleware constructor.

## Built-in Middleware

The framework has a few middlewares that you can use.

### Auth

```js
import Auth from "@adaptivestone/framework/services/http/middleware/Auth.js";
```

Allows passing only if the user is provided. Please use any middleware that provides a user instance beforehand (like `GetUserByToken`).

#### Parameters

No parameters.

### Cors

```js
import Cors from "@adaptivestone/framework/services/http/middleware/Cors.js";
```

Adds CORS headers if the origin matches the config.

#### Parameters

`origins` - an array of strings or regex to check the origin. Required parameter.

```javascript
  static get middleware() {
    return new Map([
      ['GET/someUrl', [
        [Cors, { origins: ['http://localhost',/./] }]
      ]]
    ]);
  }
```

### GetUserByToken

```js
import GetUserByToken from "@adaptivestone/framework/services/http/middleware/GetUserByToken.js";
```

Grabs a token and tries to parse the user from it. It will find the user in the database by the token. If the user exists, it will add the `req.appInfo.user` variable.

#### Parameters

No parameters.

### I18n

```js
import I18n from "@adaptivestone/framework/services/http/middleware/I18n.js";
```

An internationalization module based on [i18next](https://www.npmjs.com/package/i18next). It provides `req.appInfo.i18n` that can be used for translation.

The middleware provides a few detectors:

- X-Lang header
- Query
- User

Please check the [i18n documentation](08-i18n.md) for more details.

#### Parameters

No parameters.

### IpDetector

```js
import IpDetector from "@adaptivestone/framework/services/http/middleware/IpDetecor.js";
```

This middleware will detect the client's IP. It works well with different proxies (AWS ELB, Nginx, etc.) and detects the real client IP.

:::note
If the request IP is from a `trustedProxy` (trusted source) only, then the module will try to parse the IP from the provided `X-Forwarded-For` header and grab the client IP from there. Otherwise, the request IP will be used.
:::
This is a core middleware, and some other middlewares (like `RateLimiter`) depend on it.

#### Parameters

All parameters go into the config file. There are two parameters there: `headers` and `trustedProxy`.

`headers` is an array of headers to parse the IP address from. By default, it is 'X-Forwarded-For'.

`trustedProxy` is an IP, CIDR, or range of IPv4 and IPv6 that is trusted to parse headers from.

```javascript
  headers: ['X-Forwarded-For'],
  trustedProxy: [ // list of trusted proxies.
    '169.254.0.0/16', // ipv4 cidr
    'fe80::/10', // ipv6 cidr
    '127.0.0.1', // ip itself
    '1.1.1.1-1.1.1.3', // ip range
  ],
```

IP data is available at:

```javascript
req.appInfo.ip;
```

:::warning
Select `trustedProxy` really carefully, as anyone can add any headers to your request.
:::

Nginx sample to add a header:

```bash
server {
    location xxxx/ {
      proxy_set_header  X-Forwarded-For $remote_addr;
    }
  }

```

### Pagination

```js
import Pagination from "@adaptivestone/framework/services/http/middleware/Pagination.js";
```

The pagination middleware provides a helper that grabs URL search parameters (`page`, `limit`) and calculates the necessary `appInfo` properties (`skip`, `limit`, and `page`).

#### Parameters

`limit` = 10 - default limit if not provided.

`maxLimit` = 100 - max limit for documents.

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
import PrepareAppInfo from "@adaptivestone/framework/services/http/middleware/PrepareAppInfo.js";
```

`PrepareAppInfo` is a special small middleware that generates `res.appInfo = {}`. This is to make sure that all subsequent middleware can use `appInfo` without checking if it exists.
It is for internal use.

#### Parameters

No parameters.

### RateLimiter

A rate limiter middleware. Limits the amount of requests.

```js
import RateLimiter from "@adaptivestone/framework/services/http/middleware/RateLimiter.js";
```

For rate limiting, we are using the [node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) module. Please refer to the module documentation for more details.

The basic idea of a rate limiter is that we have some weight for the call and some key that has ‘credits’. Each call consumes ‘credits’, and when it reaches 0, the request is blocked.

Some samples - login protection. We can generate rate limiters based on the user's email and limit each email to only 5 calls per minute. Or we can construct a more complex login that includes user IPs, etc.

#### Parameters

By default, the rate key is generated based on the Route, IP, and userID. But you can adjust it via the config (globally) or via middleware parameters.

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

The rate limiter middleware allows you to include request components (`req.body`) for key generation. Please note that you have no access to `req.appInfo.request` at this stage.

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

You can find the default parameters in ‘config/rateLimiter.js’. These parameters are used if other parameters are not provided.

The rate limiter has multiple backends (memory, Redis, and Mongo). By default, the 'memory' backend is activated.

### RequestLogger

```js
import RequestLogger from "@adaptivestone/framework/services/http/middleware/RequestLogger.js";
```

A small middleware that logs request info (route, method, status, and time).

Logs example:

```js
[middlewareRequestLogger]  2023-01-24T07:00:35.680Z  info : Request is  [GET] /project/123
[middlewareRequestLogger]  2023-01-24T07:00:35.747Z  info : Finished Request is  [GET] /project/123.  Status: 200. Duration 67 ms
```

#### Parameters

No parameters.

### RequestParser

```js
import RequestParser from "@adaptivestone/framework/services/http/middleware/RequestParser.js";
```

This is the main middleware to parse requests (`application/json`, `multipart/form-data`, `application/octet-stream`, `application/x-www-form-urlencoded`).
It is based on the [formidable](https://www.npmjs.com/package/formidable) package.
After parsing, the data is available in `req.body`.

#### Parameters

No parameters.

### Role

Checks the user role (`user.roles` property). If the user does not have the role, it stops the request and returns an error. It uses OR logic (any of the specified roles will allow the user to pass).

```js
import Role from "@adaptivestone/framework/services/http/middleware/Role.js";
```

#### Parameters

`roles` - an array of roles to check. It uses OR logic (any role will pass).

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        [RoleMiddleware, { roles: ['admin','moderator'] }]
      ]]
    ]);
  }
```

### StaticFiles

:::warning

Deprecated and removed in version 5. It is better to use an HTTP server (Nginx, etc.) to handle static files.
:::

```bash
# nginx sample
server {

	root /var/www/application/src/public;

	server_name _;
	client_max_body_size 64M;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ @backend;
	}

	location @backend {
		proxy_pass http://localhost:3300;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
	}
}

```

```js
import StaticFiles from "@adaptivestone/framework/services/http/middleware/StaticFiles.js";
```

Handles static files. Mostly for development purposes. In production, it is better to handle files via a web server.

#### Parameters

`folders` - an array of folders to handle files from. Required parameter.

```javascript
  static get middleware() {
    return new Map([
      ['POST/someUrl', [
        [StaticFiles, { folders: ['/var/www/public','/opt/public'] }]
      ]]
    ]);
  }
```

## Creating Your Own Middlewares (or Integrating External Ones)

You can create your own middleware. To do that, you should extend `AbstractMiddleware` and provide at least two of your own functions: `description` and `middleware`. Please check the code below.

```js
import AbstractMiddleware from "@adaptivestone/framework/services/http/middleware/AbstractMiddleware.js";

class CustomMiddleware extends AbstractMiddleware {
  static get description() {
    return "Middleware description";
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

  // optional
  get relatedQueryParameters() {
    // A Yup object that defines middleware-related `req.query` parameters. It allows you to validate and get those parameters in `req.appInfo.query` relative to the route in which the middleware is declared.
    return yup.object().shape({
      limit: yup.number(), // For example
    });
  }

  // optional
  get relatedRequestParameters() {
    // A Yup object that defines middleware-related `req.body` parameters. It allows you to validate and get those parameters in `req.appInfo.request` relative to the route in which the middleware is declared.
    return yup.object().shape({
      name: yup.string().required(), // For example
    });
  }

  async middleware(req, res, next) {
    // check something
    if (!req.body.yyyyy) {
      //  return and stop processing
      return res.status(400).json({});
    }
    if (this.params.iiii) {
      // we can also check all the params that we passed during init
    }
    // go to the next one
    return next();
  }
}

export default CustomMiddleware;
```
