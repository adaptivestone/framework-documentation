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

## Validation

The framework dispatches validation through [Standard Schema](https://standardschema.dev/) — a vendor-neutral interface. Any conforming validator works as a route's `request:` or `query:` schema with no glue code:

| Validator | Standard Schema support |
|---|---|
| [Yup](https://github.com/jquense/yup) | ≥1.7 |
| [Zod](https://zod.dev/) | ≥3.24 |
| [Valibot](https://valibot.dev/) | all current versions |
| [ArkType](https://arktype.io/) | all current versions |

Yup is shown in the examples below since the framework historically taught it, but the same shapes are accepted from any Standard Schema-conforming library.

### Yup example

```js
request: yup.object().shape({
  count: yup.number().max(100).required("error text"),
});
query: yup.object().shape({
  page: yup.number(),
});
```

A more complete example:

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

For Yup schemas, the framework automatically strips unknown fields (security-relevant when handlers spread `req.appInfo.request` into model creates). You don't need `.noUnknown()` — the framework calls `cast(data, { stripUnknown: true })` for you.

### Zod example

```js
import { z } from "zod";

request: z.object({
  count: z.number().max(100),
  message: z.string().min(30, "minimum 30 chars"),
});
query: z.object({
  page: z.number().optional(),
});
```

Zod (and Valibot, ArkType) strip unknown fields by default — no extra configuration needed. To allow unknown fields explicitly, use the library's pass-through API (Zod's `.passthrough()`, Valibot's `looseObject`, ArkType's `'+': 'ignore'`).

### TypeScript types from schemas

Pull a typed shape from any Standard Schema validator with `StandardSchemaV1.InferOutput`:

```ts
import type { StandardSchemaV1 } from "@adaptivestone/framework/services/validate/types";
import { object, string } from "yup";

const loginSchema = object({
  email: string().email().required(),
  password: string().required(),
});

type LoginRequest = StandardSchemaV1.InferOutput<typeof loginSchema>;
// → { email: string; password: string }

async postLogin(
  req: FrameworkRequest & { appInfo: { request: LoginRequest } },
  res: Response,
) {
  // req.appInfo.request.email is typed as string
}
```

Same call works for Zod, Valibot, ArkType — replace `loginSchema` with whichever library's schema and the inferred type follows.

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

### Custom validators

To plug in a validator that doesn't already implement Standard Schema (e.g., raw [Joi](https://joi.dev/), or a hand-rolled function), implement the `~standard` slot directly. About 10 lines of glue:

```ts
import type { StandardSchemaV1 } from "@adaptivestone/framework/services/validate/types";

interface ProductInput { sku: string; price: number }

const productSchema: StandardSchemaV1<unknown, ProductInput> = {
  "~standard": {
    version: 1,
    vendor: "mycustom",
    validate(value) {
      const data = value as Partial<ProductInput>;
      if (typeof data.sku !== "string") {
        return { issues: [{ message: "sku is required", path: ["sku"] }] };
      }
      if (typeof data.price !== "number") {
        return { issues: [{ message: "price is required", path: ["price"] }] };
      }
      return { value: { sku: data.sku, price: data.price } };
    },
  },
};

// Use it on a route:
request: productSchema;
```

You also get `InferOutput<typeof productSchema>` for free. Standard Schema's spec lives at https://standardschema.dev/.

### Registering vendor drivers

For library-specific behavior (custom strip semantics, native JSON Schema export for OpenAPI, etc.), register a `ValidatorDriver`:

```ts
import { ValidateService, type ValidatorDriver } from "@adaptivestone/framework/services/validate/ValidateService";

const myJoiDriver: ValidatorDriver = {
  canHandle: (body) => body?.isJoi === true,
  async validate(body, data) {
    const { value, error } = body.validate(data, { stripUnknown: true });
    if (error) throw new ValidationError(joiToFrameworkPayload(error));
    return value;
  },
  toJsonSchema: (body) => myJoiToJsonSchema(body), // optional; for OpenAPI later
};

ValidateService.register(myJoiDriver);
```

Drivers are matched in registration order; user-registered drivers take priority over the built-ins.

### ValidationError

When validation fails, the framework throws a `ValidationError`. The instance's `.message` is the path-keyed payload object that ships out via `res.json({ errors: err.message })`, producing:

```json
{
  "errors": {
    "fieldName": ["error description"],
    "anotherField": ["another field error"]
  }
}
```

Each value is always an array of messages. A field that fails multiple validators surfaces all of them: `{password: ["min8", "startUpper"]}`.

For structured access (logging, observability), use `.issues`:

```ts
import { ValidationError } from "@adaptivestone/framework/services/validate/ValidationError";

try {
  /* ... */
} catch (e) {
  if (e instanceof ValidationError) {
    for (const issue of e.issues) {
      console.error(`[${issue.path?.join(".") ?? "root"}] ${issue.message}`);
    }
  }
}
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
