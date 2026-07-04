# Models

The framework is based on the [Mongoose](https://mongoosejs.com/) library and provides direct access to it.

The model handles database connections.

:::note

Model files are part of the [framework inheritance process](03-files-inheritance.md).

:::

The model uses a class with static methods and properties, providing auto-typing for each model. TypeScript helpers are also available to extract types from the model class.

## Lifecycle

The framework can do the following:

1. Load model files
2. Initialize model files

There are internal options for this (see the Commands section), which are mostly used in commands where you can skip model initialization or load the model without initializing it. This is useful in a few use cases, primarily for type generation.

Under normal conditions, the framework scans the `model` folder and loads all models using the inheritance process.

This is primarily to avoid model 'circular dependencies.'

### Duplicate framework copies

Every model extends `BaseModel` from `@adaptivestone/framework`. If **two different copies** of the framework end up installed (a duplicate/undeduped install), a model can extend `BaseModel` from one copy while the loader runs from the other. `instanceof BaseModel` compares prototype identity, so it is `false` across that copy boundary — and boot used to silently misroute such a model into the legacy (`AbstractModel`) branch, surfacing only later as a confusing downstream failure.

Boot now recognizes the model by its static shape (a `BaseModel` subclass without the `instanceof`) and **fails fast**, naming the offending model:

```text
Model 'Article' extends BaseModel from a DIFFERENT copy of @adaptivestone/framework than the one loading models, so `instanceof BaseModel` is false and it cannot be initialized. This means @adaptivestone/framework is installed more than once (a duplicate/undeduped install). Fix the duplication so a single copy is shared: run `npm ls @adaptivestone/framework` to find the extra copy, then dedupe (align versions, delete node_modules and reinstall, and check your lockfile).
```

The model loader prefixes this with the model name and file (`Failed to initialize model '<Name>' (<file>): …`). The fix is to collapse the duplicate so a single copy is shared:

```bash
npm ls @adaptivestone/framework
```

then dedupe — align versions, delete `node_modules` and reinstall, and check your lockfile. Genuinely legacy (`AbstractModel`-based) models still route to the legacy branch unchanged.

:::tip Module authors

If you publish a package that defines framework models (or otherwise imports `@adaptivestone/framework`), declare the framework as a **peer dependency**, not a regular dependency — that way the host app supplies the single shared copy instead of your package pulling in a second one. `npm link` during local development is the most common trigger for a duplicate copy, since the linked package resolves the framework from its own `node_modules`.

:::

## Base Model

The base model is the core of your models. It handles their structure and initialization.
We have provided a TypeScript example, but you can ignore the types if you only want to use JavaScript.
Using types is fully optional.

```ts
import { BaseModel } from "@adaptivestone/framework/modules/BaseModel.js";

// in case you need to access appInstance - appInstance.getConfig('s3');
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";

// These are TypeScript helpers.
import type {
  GetModelTypeFromClass, // `GetModelTypeFromClass` returns model types from the class.
  GetModelTypeLiteFromSchema, // Same as above, but only uses the schema to avoid circular linking.
} from "@adaptivestone/framework/modules/BaseModel.js";

import mongoose, { type Schema } from "mongoose";

// Type helper for static and instance methods.
type SomeModelLite = GetModelTypeLiteFromSchema<typeof SomeModel.modelSchema>;

class SomeModel extends BaseModel {
  static initHooks(schema: Schema): void {
    // A place to initialize plugins, indexes, and so on.
    // This happens after the class is loaded into Mongoose but before Mongoose initializes it.
    // schema.plugin(PLUGIN_NAME);
    schema.index({ name: "text" }); // or indexes.

    // For hooks, there are two types of `this`: model and queries.
    // https://mongoosejs.com/docs/middleware.html#types-of-middleware
    schema.pre(
      'save',
      async function (this: InstanceType<SomeModelLite>) {
        ...
      }
    );
    schema.pre('findOneAndDelete', async function () {
      const docToDelete = await this.model.findOne<SomeModelLite>( // Helps to return the correct model.
        this.getQuery(),
      );
    });
  }

  // The Mongoose schema goes here.
  // This is a complete Mongoose schema.
  // Please refer to the Mongoose documentation: https://mongoosejs.com/docs/guide.html
  static get modelSchema() {
    return {
      someString: { type: String, required: true },
      firstName: String,
      lastName: String,
      email: String,
      orders: {
        type: mongoose.Schema.Types.ObjectId, // This is the correct type for an ObjectID reference. Only this type generates valid types.
        ref: "Order", // You don't need to worry about initialized model schemas; the framework will load and initialize all models for you.
      },
    } as const; // This helps generate better types (TypeScript only).
  }

  // The Mongoose schema options go here.
  // Please refer to the Mongoose documentation: https://mongoosejs.com/docs/guide.html#options
  static get schemaOptions() {
    return {
      read: "primary",
    } as const; // This helps to generate better types. (TypeScript only)
  }

  /**
   *  Object with static methods.
   * this.app.getModel('SomeModel').findByEmail('email');
   * this.app.getModel('SomeModel').getInfoStatic();
   *
   */
  static get modelStatics() {
    type OrderModelType = GetModelTypeFromClass<typeof Order>; // To help with the `populate` method.

    return {
      findByEmail: async function findByEmail(
        this: SomeModelLite, // A type helper to map to the correct `this` context.
        email: string
      ) {
        const instance = await this.find({ email });
        return instance;
      },
      getInfoStatic: async function getInfoStatic(
        model: InstanceType<SomeModelLite> // A TypeScript type helper.
      ) {
        await model.populate("orders");
        return {
          _id: model.id,
          email: model.email,
        };
      },
      getInfoStaticWithOrders: async function getInfoStatic(
        // Intercepts model types to ensure that the `orders` type is correct (without interception, it will be just an `ObjectID`).
        model: InstanceType<SomeModelLite> & {
          orders: InstanceType<OrderModelType>[];
        }
      ) {
        await model.populate("orders");
        return {
          _id: model.id,
          email: model.email,
          orders: model.orders,
        };
      },
    };
  }

  /**
   * We should also have instance methods for the model to interact with.
   * const SomeModel = appInstance.getModel('SomeModel');
   * const someModel = await SomeModel.findOne({email:"cfff"});
   * const data = await someModel.getInfo(); // call instance method
   */
  static get modelInstanceMethods() {
    type ShippingInstanceType = InstanceType<SomeModelLite>;

    return {
      getInfo: async function getInfo(this: SomeModelLite) {
        return {
          _id: this._id,
          email: this.email,
        };
      },
            // anotherMethod,
    };
  }

  /**
   * We should also have virtual methods for the model to interact with.
   * const SomeModel = appInstance.getModel('SomeModel');
   * const someModel = await SomeModel.findOne({email:"cfff"});
   * const fullName = await someModel.fullName // virtual field
   * someModel.fullName = 'Jean-Luc Picard';
   */
  static get modelVirtuals() {
    return {
      fullName: {
        // virtual field
        options: {
          type: Object, // schema
        },
        get(this: InstanceType<SomeModelLite>) {
          // Getter
          return `${this.firstName} ${this.lastName}`;
        },
        async set(this: InstanceType<SomeModelLite>, v: string) {
          // Setter
          const firstName = v.substring(0, v.indexOf(" "));
          const lastName = v.substring(v.indexOf(" ") + 1);
          this.set({ firstName, lastName });
        },
      },
    }; // make sure that you not put it as a const
  }

}

export default SomeModel;

// It's good practice to return the type from the model.
export type TSomeModel = GetModelTypeFromClass<SomeModel>;
```

:::warning

Models are instantiated once per process, and their instances are then cached. Do not expect constructor or `init` hook calls on every model load.

:::

:::tip

Please do not use the plural form for model names.

**Bad** - Coin**s**

**Good** - Coin

:::

:::tip Annotating `this` on instance methods

An instance method may declare an explicit `this:` to type its body — handy when
the body assumes a narrower shape than the raw document (a populated ref, a
non-null [plugin-reshaped field](#typing-plugin-reshaped-fields), sibling
methods):

```ts
getInfo: async function (this: SomeModelLite) {
  return { _id: this._id, email: this.email };
},
```

That annotation types the **body only**. You still call the method directly on
the document — `doc.getInfo()` — on any model handle; the framework drops the
authored `this` from the caller-facing type, since a method accessed on its own
document always has the right `this` at runtime. No `(schema.methods.x as …)
.call(doc, …)` cast is needed.

:::

## Typing plugin-reshaped fields

Some Mongoose plugins reshape a field's value at runtime: `mongoose-intl` turns a
`String` field into a `{ native, machine }` sub-document, an encryption plugin
swaps a string for a cipher object, a custom getter returns a different type. The
framework infers a field's type from `type:` (here, `string`), so the static type
no longer matches what is actually stored — and you end up casting at every read.

Mark such a field with `TsTypeOverride<T>` to declare its real compile-time type.
The marker is a phantom (`__tsType`, never set at runtime), so the plugin keeps
doing the reshaping; only the static type changes.

```ts title="/src/models/Event.ts"
import { BaseModel } from "@adaptivestone/framework/modules/BaseModel.js";
import type { TsTypeOverride } from "@adaptivestone/framework/modules/BaseModel.js";
import type { IntlSubDocValue } from "mongoose-intl"; // your plugin's value type

// A small factory keeps schemas readable: a `String` field the intl plugin
// reshapes into an `IntlSubDocValue` at runtime.
function intlString<C extends object>(field: C) {
  return field as C & TsTypeOverride<IntlSubDocValue<string>>;
}

export default class Event extends BaseModel {
  static get modelSchema() {
    return {
      title: intlString({ type: String, intl: true }),
      schedule: [{ title: intlString({ type: String, intl: true }) }],
      plainField: { type: String }, // unmarked → still `string`
    } as const;
  }
}
```

The static type now follows the runtime value everywhere — no casts:

```ts
const Event = this.app.getModel("Event");
const event = await Event.findOne();
event?.title?.native; // `title` is IntlSubDocValue<string>
event?.schedule?.[0]?.title?.machine; // any depth (nested + subdoc arrays)
event?.plainField; // unmarked field is still `string`
```

:::note

The override is **opt-in** and a strict **no-op** for any field without the
marker — existing models are unaffected. It recurses into nested objects and
subdocument arrays, so a reshaped field can appear at any depth. The same marker
works for any runtime-reshaping plugin (encrypted fields, custom getters, …), not
just `mongoose-intl`.

:::

## Typing populated references

A reference field (`{ type: Schema.Types.ObjectId, ref: "User" }`) is typed as an
`ObjectId` — that is what is stored, and what you get back when the field is
**not** populated. After `.populate(...)` the runtime value is the referenced
document, but the inferred type stays `ObjectId` (Mongoose cannot know at the
schema level which queries populate it). There are two cast-free ways to type the
populated value, depending on how often you populate the field.

**Per call — `.populate<T>()`.** When you populate occasionally, pass the
populated shape as the type argument at the call site. The returned document is
typed with that field replaced:

```ts
const Boat = this.app.getModel("Boat");
const boat = await Boat.findOne();
const populated = await boat!.populate<{ owner: { email: string } }>("owner");
populated.owner.email; // typed — no cast
```

**Always — mark the field.** When a field is almost always read populated, mark it
with `TsTypeOverride` as the **union** of both states (`ObjectId` when not
populated, the document when it is). Reads then narrow without a cast:

```ts title="/src/models/Boat.ts"
import { BaseModel } from "@adaptivestone/framework/modules/BaseModel.js";
import type { TsTypeOverride } from "@adaptivestone/framework/modules/BaseModel.js";
import { Schema, type Types } from "mongoose";

type PopulatedOwner = { email: string; name: string };

function ref<C extends object, T>(field: C) {
  return field as C & TsTypeOverride<Types.ObjectId | T>;
}

export default class Boat extends BaseModel {
  static get modelSchema() {
    return {
      owner: ref<{ type: typeof Schema.Types.ObjectId; ref: "User" }, PopulatedOwner>({
        type: Schema.Types.ObjectId,
        ref: "User",
      }),
    } as const;
  }
}
```

```ts
const boat = await this.app.getModel("Boat").findOne();
// `owner` is `ObjectId | PopulatedOwner | undefined` — narrow before use:
if (boat?.owner && "email" in boat.owner) {
  boat.owner.email; // typed as PopulatedOwner
}
```

:::note

Refs that are not marked stay plain `ObjectId`, and `.populate<T>()` always works
regardless. Prefer the marker only for fields you consistently populate — the
union forces a narrowing check, which is the honest cost of a field that is
sometimes an id and sometimes a document.

:::

## API

```ts
getModel(modelName: string): MongooseModel<any>;
```

Example:

```js
const UserModel = this.app.getModel("User");
const userInstance = await UserModel.findOne({ email: "user@email.com" });
```

## Configuration

The main configuration variable is the `MONGO_DSN` environment variable, which the model uses to connect to the database.

## Built-in Models

The framework comes with a few built-in models.

### User

It is part of the authorization system and handles user storage, password hashing, and provides basic functions for token generation and user retrieval.

If you want to create your own user implementation, you should override or disable this one.

The authentication controller depends on this model.

#### API

```js
const UserModel = this.app.getModel("User");
const user = await UserModel.getUserByEmailAndPassword("email", "password");
const userToken = await user.generateToken(); // Generates and stores a token in the database
const userPublic = await user.getPublic();
// `hashPassword` is a standalone helper, not a model static:
// import { hashPassword } from "@adaptivestone/framework/helpers/crypto.js";
const hashedPassword = await hashPassword("password");
const sameUser = await UserModel.getUserByToken(userToken);
const sameUserAgain = await UserModel.getUserByEmail(user.email);
// The token generators live in `userHelpers`, not on the model:
// import { userHelpers } from "@adaptivestone/framework/models/User.js";
const recoveryToken = await userHelpers.generateUserPasswordRecoveryToken(user);
const sameUserAgain2 = await UserModel.getUserByPasswordRecoveryToken(
  recoveryToken
);
const isSuccess = await user.sendPasswordRecoveryEmail(i18n);
const verificationToken = await userHelpers.generateUserVerificationToken(user);
const sameUserAgain3 = await UserModel.getUserByVerificationToken(
  verificationToken
);
const isSuccess2 = await user.sendVerificationEmail(i18n);
```

#### Customizing the User model

To replace the framework's `User`, drop your own `User.ts` into your project's
`models/` folder. The [inheritance process](03-files-inheritance.md) makes it win
over the framework's, and `getModel("User")` / `req.appInfo.user` are typed
against **your** model automatically (run `generatetypes` after adding it).

There are two ways to customize it.

**Add fields** — extend the framework's `User` and spread its schema:

```ts title="/src/models/User.ts"
import FrameworkUser from "@adaptivestone/framework/models/User.js";

export default class User extends FrameworkUser {
  static get modelSchema() {
    return {
      ...FrameworkUser.modelSchema,
      company: { type: String },
    } as const;
  }
}
```

The inherited auth statics and instance methods (`getUserByEmailAndPassword`,
`generateToken`, `getPublic`, …) keep working on your model with no casts.

**Reshape fields** — when you need to change a field's _shape_ (for example an
i18n `name`, or a singular `role` instead of `roles[]`), TypeScript can't express
a type _replacement_ through `extends` (the static-getter override is checked
covariantly, so it fails with `TS2417`). Compose instead: extend `BaseModel` and
reuse the framework's auth logic by spreading it in.

```ts title="/src/models/User.ts"
import { BaseModel } from "@adaptivestone/framework/modules/BaseModel.js";
import FrameworkUser from "@adaptivestone/framework/models/User.js";
import type { Schema } from "mongoose";

export default class User extends BaseModel {
  static get modelSchema() {
    return {
      name: { native: { type: String }, machine: { type: String } },
      email: { type: String },
      password: String,
      sessionTokens: [{ token: String, valid: Date }],
      role: { type: String },
      // …the rest of your schema
    } as const;
  }

  static get modelStatics() {
    return { ...FrameworkUser.modelStatics } as const;
  }

  static get modelInstanceMethods() {
    return { ...FrameworkUser.modelInstanceMethods } as const;
  }

  static initHooks(schema: Schema) {
    FrameworkUser.initHooks(schema); // keeps the password-hashing pre-save hook
  }
}
```

The shipped auth helpers are typed against small structural contracts
(`UserAuthDoc` / `UserAuthInstance` / `UserAuthModel`), so they stay callable on
your reshaped model without casts.

:::note

The auth statics (`getUserByEmailAndPassword`, `getUserByToken`, …) only read a
few fields — `email`, `password`, and the token arrays. Any model that keeps
those reuses them as-is. `getPublic` returns the framework's public shape, so
override it if your model reshapes the fields it reads (such as `name`).

:::

### Migration

The migration model is a helper for the migration subsystem. It stores the names of migrated files to ensure that each migration is only executed once.

Please refer to the `CLI/migrations` section for more details.

You should probably not use this model directly.

### Sequence

The Sequence model allows you to generate sequences by name. This is a cross-server-safe method for generating sequences in a distributed environment.

```javascript
const SequenceModel = this.app.getModel("Sequence");
// Will be 1.
const someTypeSequence = await SequenceModel.getSequence("someType");
// Will be 2.
const someTypeSequence2 = await SequenceModel.getSequence("someType");
// Will be 1, as the type is different.
const someAnotherTypeSequence = await SequenceModel.getSequence(
  "someAnotherType"
);
```

### Lock

The Lock model provides the ability to lock resources in a distributed environment.

This can be used for external requests, system actions, etc.

Imagine you have a high volume of traffic requesting data from an external system. You also have a cache for this data, but you must initially query the internal API to retrieve it. To prevent overwhelming the API, you want to ensure that you only request the data once and that other simultaneous requests wait for the result instead of making redundant calls. This is where the Lock model can help.

```javascript

const LockModel = this.app.getModel("Lock");

  /**
   * Acquires a lock based on the lock name.
   * @param {string} name
   * @param {number} [ttlSeconds=30]
   * @returns {Promise<boolean>}
   */
  async acquireLock(name, ttlSeconds = 30)

  /**
   * Releases a lock based on the lock name.
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async releaseLock(name)

  /**
   * Waits for a lock based on the lock name.
   * @param {string} name
   * @returns {Promise}
   */
  async waitForUnlock(name)

  /**
   * Gets the lock's remaining time based on the lock name.
   * @param {string} name
   * @returns {Promise<{ttl: number}>}
   */
  async getLockData(name)


  /**
   * Gets the locks' remaining time based on the lock names.
   * @param {string[]} names
   * @returns {Promise<{name: string, ttl: number}[]>}
   */
  static async getLocksData(names)

```

Example of usage:

```javascript

async someHTTPRequestWithExpensiveExternalAPI(req, res) {
  // We have some external requests, which can be simultaneous requests from different users.
  const LockModel = this.app.getModel("Lock");
  // Let's say it's AI processing of a video, for example.
  const { videoId } = req.appInfo.request;

  // Check if we already have it.
  const VideoAIModel = this.app.getModel("VideoAIModel");
  const videoAI = await VideoAIModel.findOne({ videoId });
  if (videoAI) {
    return res.json(videoAI.getPublic());
  }

  const lockName = `video-ai-processing-${videoId}`;

  // We don't have that video, so let's send it for processing using a lock.
  const isLockAcquired = await LockModel.acquireLock(lockName);
  if (isLockAcquired) {
    const result = await videoAIService.processVideo(videoId);
    const videoModel = await VideoAIModel.create({ videoId, result });
    // Release the lock.
    await LockModel.releaseLock(lockName);
    // Return the result.
    return res.json(videoModel.getPublic());
  }

  // We don't have a lock, so let's wait for one.
  await LockModel.waitForUnlock(lockName);
  // It looks like the external process is finished, so let's check for the result.
  const videoAI2 = await VideoAIModel.findOne({ videoId });
  if (videoAI2) {
    return res.json(videoAI.getPublic());
  }

  // If there's no result, we'll return an error.
  return res.status(500).json({ error: "Something went wrong" });
}
```

### KeyValue

A minimal persistent key/value store backed by MongoDB. Think of it as a tiny, shared "settings drawer" for your app: a place to keep small pieces of state that should survive restarts and be readable by every process — a lightweight cache, runtime configuration, feature flags, the cursor of a background job, and so on.

The model is intentionally schema-only — it adds no custom methods. The key is the document `_id` (a string), and the value is a `Mixed` field, so it can hold anything Mongoose can serialise (string, number, boolean, array, or nested object). You interact with it through the standard Mongoose API that every model already exposes.

```ts
static get modelSchema() {
  return {
    _id: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  } as const;
}
```

#### Usage

```js
const KeyValue = this.app.getModel("KeyValue");

// Set (create or overwrite). `upsert: true` makes it idempotent.
await KeyValue.findByIdAndUpdate(
  "config:theme",
  { value: "dark" },
  { upsert: true },
);

// Get. Returns the document or `null` when the key is missing.
const doc = await KeyValue.findById("config:theme");
const theme = doc?.value ?? "light"; // fall back to a default

// Any serialisable value works.
await KeyValue.findByIdAndUpdate(
  "config:features",
  { value: { newDashboard: true, limits: [10, 50, 100] } },
  { upsert: true },
);

// Read many keys at once.
const docs = await KeyValue.find({ _id: { $in: ["config:theme", "config:features"] } });
const map = new Map(docs.map((d) => [d._id, d.value]));

// Delete.
await KeyValue.deleteOne({ _id: "config:theme" });
```

:::tip

Use a `namespace:key` convention for the `_id` (for example `config:theme`, `cache:user-42`, `flag:beta-signup`). It keeps keys readable and makes prefix queries with a regular expression easy:

```js
const allConfig = await KeyValue.find({ _id: /^config:/ });
```

:::

#### Caching pattern

Because every process reads the same collection, `KeyValue` is a convenient cross-server cache for values that are expensive to compute but cheap to store.

```js
async function getExchangeRates(app) {
  const KeyValue = app.getModel("KeyValue");
  const cached = await KeyValue.findById("cache:exchange-rates");
  if (cached) {
    return cached.value;
  }

  const rates = await fetchExpensiveRatesFromExternalApi();
  await KeyValue.findByIdAndUpdate(
    "cache:exchange-rates",
    { value: rates },
    { upsert: true },
  );
  return rates;
}
```

Pair it with the [`Lock`](#lock) model when several requests might try to populate the same cache key at once, so the expensive work runs only once.

:::note

`KeyValue` is **persistent storage**, not an expiring cache — entries live until you delete them. There is no built-in time-to-live. If you need automatic expiration, add an `expireAt` date field and a TTL index in `initHooks`, the same way the `Lock` model does:

```ts
static initHooks(schema: Schema) {
  schema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
}
```

For request-scoped or in-memory caching, see the [Cache](11-cache.md) section instead.

:::

#### Concurrency

`value` is a `Mixed` field, so it is replaced as a whole — concurrent writers are last-write-wins. Do not read a value, mutate it in your code, and write it back if multiple processes update the same key; you may lose updates. For counters or fields that must change atomically, use MongoDB update operators directly (`$inc`, `$set` on a sub-path) or reach for the [`Sequence`](#sequence) model.
