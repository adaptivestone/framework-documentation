# Routes

Routes are relative to the controller route. You SHOULD NOT use the full route here.

Route objects have multiple levels.

## Route First Level (Method Level)

On the first level, only the ‘method’ (post, put, delete, etc.) exists. Only requests with these methods will go deeper into the real routes.

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

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
      // etc.
    };
  }
}
export default ControllerName;
```

## Route Second Level (Path Level)

Inside the methods (second level), we have a path. It follows the https://expressjs.com/en/guide/routing.html#route-paths Express documentation.

:::tip
In most cases, a few options are enough:

```js
"/fullpath";

// Grab variables paramOne and paramTwo into req.params
"/fullpath/:paramOne/:paramTwo";

// Like the previous one, but "paramTwo" is now optional
"/fullpath/:paramOne/{:paramTwo}";
```

:::

:::note

The order of routes matters. The first matched route will be executed.
:::

Example:

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        "/someUrl": {
          handler: this.postSomeUrl,
          request: yup.object().shape({
            count: yup.number().max(100).required(),
          }),
        },
      },
    };
  }
}
export default ControllerName;
```

## Route Third Level (Route Object Level)

On the third level, we have a "route object," a special object that will describe our route.

```js
{
  handler: this.postSomeUrl, // required
  request: yup.object().shape({ // optional
    count: yup.number().max(100).required(),
  }),
  query: yup.object().shape({ // optional
    page: yup.number().required(),
  }),
  middleware: [RateLimiter], // optional
  description: yup.string() // optional
}

```

Here:

```js
Handler; // Some async function (most likely in this controller file) that will do all the work.
Request; // A special interface that will do validation of body parameters for you.
Query; // A special interface that will do validation of query parameters for you.
Middleware; // An array of middlewares specially for the current route.
Description; // A description of this route (used when generating documentation).
```

## Request

Request does validation and casting of an upcoming `req.body`.

As we want to use already well-defined solutions, we believe that [yup](https://github.com/jquense/yup) is a great example of how a schema should be validated.

But you still have the ability to provide your own validation based on an interface.

:::warning
Request works on a body level.
:::

Request contains all fields from `req.body` and passes them into validation.

:::warning
Please note that GET methods have no BODY.
:::

Parameters after validation are available as `req.appInfo.request`.

:::warning
Do not use `req.body` directly. Always use parameters via `req.appInfo.request`.

:::

## Query

Query does validation and casting of an upcoming `req.query`.

The Yup schema is described similarly to the request.

:::warning
Query works on a query level.
:::

Query contains all fields from `req.query` and passes them into validation.

Parameters after validation are available as `req.appInfo.query`.

:::warning
Do not use `req.query` directly. Always use parameters via `req.appInfo.query`.

:::

## Yup Validation

```js
request: yup.object().shape({
  count: yup.number().max(100).required("error text"),
});
query: yup.object().shape({
  page: yup.number(),
});
```

Please follow the Yup documentation for a deeper understanding of how schemas work. All parameters are located here: [https://github.com/jquense/yup#api](https://github.com/jquense/yup#api).

Example:

```js
request: yup.object().shape({
  name: yup.string().required("validation.name"), // You can use i18n keys here.
  email: yup.string().email().required("Email required field"), // Or just text.
  message: yup
    .string()
    .required("Message required field")
    .min(30, "minimum 30 chars"), // Additional validators for different types exist.
  pin: yup.number().integer().min(1000).max(9999).required("pin.pinProvided"),
  status: yup
    .string()
    .required("Status required field")
    .oneOf(["WAITING", "CANCELED"]), // One of.
  transaction: yup
    .object() // Deep-level object.
    .shape({
      to: yup.string().required(),
      amount: yup.number().required(),
      coinName: yup.string().oneOf(["btc", "etc"]).default("etc"), // Default.
    })
    .required(),
});
```

### File Validation

For file validation, we provide a special Yup class, `YupFile`. It is really simple to use.

```js
import { YupFile } from "@adaptivestone/framework/helpers/yup.js";

request: yup.object().shape({
  someFileName: new YupFile().required("error text"),
  otherFiled: yup.string().required(), // Yes, you can mix it with regular data.
});
```

:::warning
Please be aware that a file can only be uploaded by ‘multipart/form-data’, and because of this, you can’t use nested objects.
:::

### Own Validation

To create your own validator, your object should have two methods:

```js
async validate(req.body) // Throw an error on validation failed.
async cast(req.body) // Should strip unknown parameters.
```

The error object should provide an “errors” array - error (why validation failed) and a "path" string - body parameter.

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

In any fields that can generate an error (required, etc.), you can use i18n keys to translate. The framework will handle the translation for you.

Please refer to the [i18n documentation](08-i18n.md).

## Handler

Handler - some async function (most likely in this controller file) that will do all the work. It is better to write the function in the same file.

:::warning
The handler can only be an **async** function.
:::

`req.appInfo.app`

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      post: {
        '/': {
          handler: this.postSample,
          request: yup.object().shape({
            count: yup.number().max(100).required(),
          })
        }
      }
    }
  }
  // Send a request with data {count: "5000"}.
  // Will produce an error with status 400 and {errors: {count:['Text error']}}.

  postSample(req, res) {
    // On success validation, we pass here.
    // {count: "5000"}
    console.log(req.appInfo.request)
    // {count: 5000} -> casted to a number

    const SomeModel = this.app.getModel('SomeModel');
    const SomeModelAlternativeWay = req.appInfo.app.getModel('SomeModel');

    const { count } = req.appInfo.request;

    const someModel = await SomeModel.findOne({count});

    return res.status(200).json({modelId: someModel.id});
  }

}
export default ControllerName;
```

### Middleware

Middleware - an array of middlewares specially for the current route.

:::warning

Route middlewares take precedence over middlewares in controllers.

:::

```javascript
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      get: {
        '/routeName': {
          handler: ...,
          middleware: [MiddlewareName, MiddlewareName, etc]
        }
      },
    };
  }
}
export default ControllerName;
```

Similarly to controller middlewares, you can use middlewares with parameters.

:::note

The rules for the design of middlewares with parameters are described in the subsection "Middleware".

:::

Sample:

```javascript
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";
import RoleMiddleware from "@adaptivestone/framework/services/http/middleware/Role.js";

class ControllerName extends AbstractController {
  get routes() {
    return {
      get: {
        '/routeName': {
          handler: ...,
          middleware: [[RoleMiddleware, { roles: ['client'] }]]
        }
      },
    };
  }
}
export default ControllerName;
```
