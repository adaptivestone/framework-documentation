# Routes

Routes relative to controller route. You SHOULD not use the full route here.

Route Objects have multiple levels.

## Route first level (method level)

On a first level only ‘method’ (post, put, delete, etc) exists. Only request with this methods will go depers on real routes.

```js
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        // post routes
      },
      get: {
        // get routes
      },
      put: {
        // put routes
      },
      // etc
    };
  }
}
module.exports = ControllerName;
```

## Route second level (path level)

Inside methods (second level) we have a path. It follows https://expressjs.com/en/guide/routing.html#route-paths express documentation

:::tip
In most cases few options in enough

```js
"/fullpath";

// grab variables  paramOne and paramTwo into req.params
"/fullpath/:paramOne/:paramTwo";

// like previous but "paramTwo" snow optional
"/fullpath/:paramOne/:paramTwo?";
```

:::

:::note

Order of routes matters. First matched route will be execute
:::

Example

```js
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        "/someUrl": {
          handler: this.postSomeUrl,
          request: yup.object().shape({
            count: yup.number().max(100)required(),
          })
        }
      },
    };
  }
}
module.exports = ControllerName;
```

## Route third level (route object level)

On the third level we have an "route object" special object that will describe our route.

```js
{
  handler: this.postSomeUrl, // required
  request: yup.object().shape({ // optional
    count: yup.number().max(100)required(),
  }),
  query: yup.object().shape({ // optional
    page: yup.number().required(),
  }),
  middleware: [RateLimiter] // optional
  description: yup.string() // optional
}

```

Here:

```js
Handler; // some async function (most likely on this controller file) that will do all job
Request; //special interface that will do validation body parameters for you
Query; //special interface that will do validation query parameters for you
Middleware; // array of middlewares specially for current route
Description; // description of this route (used when generating documentation)
```

## Request

Request did a validation and casting of an upcoming req.body.

As we want to use already well defined solutions we believe that [yup](https://github.com/jquense/yup) is a great sample of how schema should be validated.

But you still have ability to provide own validation based on interface

:::warning
Request works on a body level.
:::

Request contains all fields from req.body and pass it into validation

:::warning
Please note that GET methods have no BODY
:::

Parameters after validation available as req.appInfo.request.

:::warning
Do not use req.body directly. Always use parameters via req.appInfo.request

:::

## Query

Query did a validation and casting of an upcoming req.query.

Yup scheme is described similarly to request.

:::warning
Query works on a query level.
:::

Query contains all fields from req.query and pass it into validation

Parameters after validation available as req.appInfo.query

:::warning
Do not use req.query directly. Always use parameters via req.appInfo.query

:::

## Yup validation

```js
  request: yup.object().shape({
    count: yup.number().max(100)required("error text"),
  })
  query: yup.object().shape({
    page: yup.number(),
  })
```

Please follow yup documentation for a deeper understanding of how schemas work. All parameters is located here [https://github.com/jquense/yup#api](https://github.com/jquense/yup#api)

Example:

```js
request: yup.object().shape({
  name: yup.string().required("validation.name"), // you can use i18n keys here
  email: yup.string().email().required("Email required field"), // or just text
  message: yup
    .string()
    .required("Message required field")
    .min(30, "minimum 30 chars"), // additional validators for different types exists
  pin: yup.number().integer().min(1000).max(9999).required("pin.pinProvided"),
  status: yup
    .string()
    .required("Status required field")
    .oneOf(["WAITING", "CANCELED"]), // pne of
  transaction: yup
    .object() // ddep level object
    .shape({
      to: yup.string().required(),
      amount: yup.number().required(),
      coinName: yup.string().oneOf(["btc", "etc"]).default("etc"), // default
    })
    .required(),
});
```

### File validation

For a file validation we provide a special yup class YupFile. It really simple to use it

```js
const { YupFile } = require("@adaptivestone/framework/helpers/yup");

request: yup.object().shape({
  someFileName: new YupFile().required("error text"),
  otherFiled: yup.string().required(), // yes you can mix it with regular data
});
```

:::warning
Please be aware that file only can be uploaded by ‘multipart/formdata’ and because of it you can’t use nested objects 
:::

### Own validation

To create own validator your object should have two methods:

```js
async validate(req.body) //throw an error on validation vailed
async cast(req.body) // should strip unknown parametes
```

Or error throw error object should provide “errors” array - error (why validation failed) and "path" string - body parameter

```js
try {
  await request.validate(req.body);
} catch (e) {
  // e.path
  // e.errors
}

req.appInfo.request = request.cast;
```

### i18n

On any fields that can generate an error (required, etc) you can use i18n keys to translate. Framework will handle translation for you

Please reffer to [i18n documentation](08-i18n.md)

## Handler

Handler - some async function (most likely on this controller file) that will do all the job. Better to write function on the same file

:::warning
Handler only can be an **async** function.  
:::

req.appInfo.app

```js
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");

class ControllerName extends AbstractController {
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

    const SomeModel = this.app.getModel('SomeModel');
    const SomeModelAlternativeWay = req.appInfo.app.getModel('SomeModel');

    const { count } = req.appInfo.request;

    const someModel = await SomeModel.findOne({count});

    return res.status(200).json({modelId:someModel.id});
  }

}
module.exports = ControllerName;
```

### Middleware

Middleware - array of middlewares specially for current route

:::warning

Route middlewares takes precedence over middlewares into controllers

:::

```javascript
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");

class ControllerName extends AbstractController {
  get routes() {
    return {
      get: {
        '/routeName': {
          handler: ...
          middleware: [MiddlewareName, MiddlewareName, etc]
        }
      },
    };
  }
}
module.exports = ControllerName;
```

Similarly controller middlewares you can use middlewares with parameters

:::note

Rules for the design of middlewares with parameters are described in the subsection "Middleware"

:::

Sample

```javascript
const AbstractController = require("@adaptivestone/framework/modules/AbstractController");
const RoleMiddleware = require("@adaptivestone/framework/services/http/middleware/Role");

class ControllerName extends AbstractController {
  get routes() {
    return {
      get: {
        '/routeName': {
          handler: ...
          middleware: [[RoleMiddleware, { roles: ['client'] }]]
        }
      },
    };
  }
}
module.exports = ControllerName;
```