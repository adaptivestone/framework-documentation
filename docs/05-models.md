# Models

The framework is based on the [mongoose](https://mongoosejs.com/) library and provides direct access to mongoose.

The model takes care of the database connection.

:::note

Model files are part of the [framework inheritance process](03-files-inheritance.md).

:::

The model uses a class with statics and provides auto-typing for each model. There are also TypeScript helpers to extract types from the model class.

## Lifecycle

The framework can do the following for you:

1. Load model files
2. Initialize model files

There are internal options to do this (see the Commands section). It is mostly used in commands where you can skip initializing the model or load the model but not initialize it (there are a few use cases, mostly for type generation).

Under normal conditions, the framework will scan the model folder and load all models with the inheritance process.

This is mostly needed to avoid model 'circular dependency'.

## Base Model

Base model is a core for you model. It take care of structure and init model.
We have provided typescript examply, but you can ignore types if you want to you JavaScript only.
Types is a fully optional

```ts
import { BaseModel } from "@adaptivestone/framework/modules/BaseModel.js";

// in case you need to access appInstance - appInstance.getConfig('s3');
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";

// this is a typscript helpers
import type {
  GetModelTypeFromClass, // GetModelTypeFromClass return model types from class.
  GetModelTypeLiteFromSchema, // Same, but only use schema to avoid curular linking
} from "@adaptivestone/framework/modules/BaseModel.js";

import type { Schema } from "mongoose";

// type helper for static and instance methods
type SomeModelLite = GetModelTypeLiteFromSchema<typeof SomeModel.modelSchema>;

class SomeModel extends BaseModel {
  static initHooks(schema: Schema): void {
    // A place to initialize plugins, indexes, etc.
    // As it happens after the class is loaded into Mongoose, but before Mongoose initializes the class.
    // schema.plugin(PLUGIN_NAME);
    schema.index({ name: "text" }); // or indexes.

    // for hooks there are two types of 'this' - model asd queries
    // https://mongoosejs.com/docs/middleware.html#types-of-middleware
    schema.pre(
      'save',
      async function (this: InstanceType<SomeModelLite>) {
        ...
      }
    );
    schema.pre('findOneAndDelete', async function () {
      const docToDelete = await this.model.findOne<SomeModelLite>( // help to return proper model
        this.getQuery(),
      );
    });
  }

  // Here the Mongoose schema goes.
  // This is a full Mongoose schema.
  // Please refer to the Mongoose documentation: https://mongoosejs.com/docs/guide.html
  static get modelSchema() {
    return {
      someString: { type: String, required: true },
      firstName: String,
      lastName: String,
      email: String,
      orders: {
        type: mongoose.Schema.Types.ObjectId, // this is a correct type for ObjectID referenct. Only it generates valid types
        ref: "Order", // you should not care of inited model schemas. Framework will load and init all models for you
      },
    } as const; // this helpt to generate better types. TS only
  }

  // Here the Mongoose schema options go.
  // Please refer to the Mongoose documentation: https://mongoosejs.com/docs/guide.html#options
  static get schemaOptions() {
    return {
      read: "primary",
    } as const; // this helpt to generate better types. TS only
  }

  /**
   *  Object with a static methods
   * this.app.getModel('SomeModel').findByEmail('email');
   * this.app.getModel('SomeModel').getInfoStatic();
   *
   */
  static get modelStatics() {
    type OrderModelType = GetModelTypeFromClass<typeof Order>; // to help on populate

    return {
      findByEmail: async function findByEmail(
        this: SomeModelLite, // type helper to map for proper this
        email: string
      ) {
        const instance = await this.find({ email });
        return instance;
      },
      getInfoStatic: async function getInfoStatic(
        model: InstanceType<SomeModelLite> // typescript type helper
      ) {
        await model.populate("orders");
        return {
          _id: model.id,
          email: model.email,
        };
      },
      getInfoStaticWithOrders: async function getInfoStatic(
        // intersept model types to make sure that orders type is correctly (without interseption it going be only ObjectID)
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
   * as well we should have instance methods for model to interact with
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
      anotherMethod,
    } as const;
  }

  /**
   * as well we should have viruals methods for model to interact with
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
          // getter
          return `${this.firtsName} ${this.lastName}`;
        },
        async set(this: InstanceType<SomeModelLite>, v: string) {
          // setter
          const firstName = v.substring(0, v.indexOf(" "));
          const lastName = v.substring(v.indexOf(" ") + 1);
          this.set({ firstName, lastName });
        },
      },
    } as const;
  }

  // Setters will also be a virtual.
  // const SomeModels = this.app.getModel("SomeModel").
  // const someModelInstance = new SomeModel();
  // Vanilla JavaScript assignment triggers the setter.
  // someModelInstance.fullName = 'Jean-Luc Picard';
  set fullName(v) {
    // `v` is the value being set, so use the value to set
    // `firstName` and `lastName`.
    const firstName = v.substring(0, v.indexOf(" "));
    const lastName = v.substring(v.indexOf(" ") + 1);
    this.set({ firstName, lastName });
  }
}

export default SomeModel;

// good practice to return type from model
export type TSomeModel = GetModelTypeFromClass<SomeModel>;
```

:::warning

Models are united once per process, and then the united instances are cached. Do NOT expect constructor or `init` hook calls on every model loading.

:::

:::tip

Please do not name the model in plural form.

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

The main configuration variable is the "MONGO_DSN" environment variable. Based on it, the model will make a connection to the database.

## Built-in Models

The framework comes with a few built-in models.

### User

It's a part of the authorization system. It takes care of storing users, hashing passwords, and provides some basic functions for token generation and getting users.

If you want to have your own user implementation, you should overwrite or disable it.

The auth controller depends on this model.

#### API

```js
const UserModel = this.app.getModel("User");
const user = await UserModel.getUserByEmailAndPassword("email", "password");
const userToken = await user.generateToken(); // generate and store token in the database
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

The migration model is a helper for the migration subsystem. It stores migrated files to make sure that a migration is executed only once.

Please refer to CLI/migrations for more details.

You probably should not use this model directly.

### Sequence

The Sequence model allows you to generate sequences by name. This is a cross-server-safe method to generate sequences in a distributed environment.

```javascript
const SequenceModel = this.app.getModel("Sequence");
// will be 1
const someTypeSequence = await SequenceModel.getSequence("someType");
// will be 2
const someTypeSequence2 = await SequenceModel.getSequence("someType");
// will be 1 as the type is different
const someAnotherTypeSequence = await SequenceModel.getSequence(
  "someAnotherType"
);
```

### Lock

The Lock model is designed to provide the ability to lock some resources in a distributed environment.

This can be for external requests, some actions in the system, etc.

Imagine that you have a lot of traffic that asks an external system for some data. You have a cache of this data as well, but initially, you shall ask the internal API to get this data. And you want to make sure that you are asking this API for that data only one time and other same-time requests will wait for the result instead of asking the API. This is where the Lock model can help you.

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
  // We have some external requests (these can be same-time requests from different users).
  const LockModel = this.app.getModel("Lock");
  // Let's say it's an AI processing of a video (for example).
  const { videoId } = req.appInfo.request;

  // Check if we already have it.
  const VideoAIModel = this.app.getModel("VideoAIModel");
  const videoAI = await VideoAIModel.findOne({ videoId });
  if (videoAI) {
    return res.json(videoAI.getPublic());
  }

  const lockName = `video-ai-processing-${videoId}`;

  // We don't have that video, let's send it to processing with a lock.
  const isLockAcquired = await LockModel.acquireLock(lockName);
  if (isLockAcquired) {
    const result = await videoAIService.processVideo(videoId);
    const videoModel = await VideoAIModel.create({ videoId, result });
    // Release the lock.
    await LockModel.releaseLock(lockName);
    // Return the result.
    return res.json(videoModel.getPublic());
  }

  // We don't have a lock, let's wait for it.
  await LockModel.waitForUnlock(lockName);
  // It looks like the external process is done, let's check if we have the result.
  const videoAI2 = await VideoAIModel.findOne({ videoId });
  if (videoAI2) {
    return res.json(videoAI.getPublic());
  }

  // We don't have a result, let's return an error.
  return res.status(500).json({ error: "Something went wrong" });
}
```
