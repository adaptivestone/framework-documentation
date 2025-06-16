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

import type { Schema } from "mongoose";

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
    } as const;
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
          return `${this.firtsName} ${this.lastName}`;
        },
        async set(this: InstanceType<SomeModelLite>, v: string) {
          // Setter
          const firstName = v.substring(0, v.indexOf(" "));
          const lastName = v.substring(v.indexOf(" ") + 1);
          this.set({ firstName, lastName });
        },
      },
    } as const;
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
const hashedPassword = await UserModel.hashPassword("password");
const sameUser = await UserModel.getUserByToken(userToken);
const sameUserAgain = await UserModel.getUserByEmail(user.email);
const recoveryToken = await UserModel.generateUserPasswordRecoveryToken(user);
const sameUserAgain2 = await UserModel.getUserByPasswordRecoveryToken(
  recoveryToken
);
const isSuccess = await user.sendPasswordRecoveryEmail(i18n);
const verificationToken = await UserModel.generateUserVerificationToken(user);
const sameUserAgain3 = await UserModel.getUserByVerificationToken(
  verificationToken
);
await UserModel.removeVerificationToken(verificationToken);
const isSuccess2 = await user.sendVerificationEmail(i18n);
```

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
