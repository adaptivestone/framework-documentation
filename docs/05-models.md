# Models

Framework based on [mongoose](https://mongoosejs.com/) library and provide direct access to mongoose.

It uses [ES6 class variant](https://mongoosejs.com/docs/guide.html#es6-classes) of mongoose to init. Also you can access framework

Model take care about database connection

:::note

Models files part of [framework inheritance process ](03-files-inheritance.md).

:::

## Access mongoose instance

Inside the class mongoose avaialable as

```js
this.mongooseModel;
```

## Basic model

```js
import AbstractModel from "@adaptivestone/framework/modules/AbstractModel.js";

class SomeModel extends AbstractModel {
  constructor(app) {
    super(app);
    // you can put some init stuff
  }

  initHooks() {
    super.initHooks();
    // place to init plugins, indexes, etc.
    // As it happens after loaded class into mongoos, but before mongoose inited class
    // this.mongooseSchema.plugin(PLUGIN_NAME);
  }

  // here mongoose scheme go
  // this is a fullu mongoose scheme
  // Please reffer to mongoose documentation https://mongoosejs.com/docs/guide.html
  get modelSchema() {
    return {
      someString: { type: String, required: true },
      firstName: String,
      lastName: String,
      email: String,
    };
  }

  // here mongoose scheme options go
  // this is a fullu mongoose scheme
  // Please reffer to mongoose documentation https://mongoosejs.com/docs/guide.html#options
  get modelSchemaOptions() {
    return {
      read: "primary",
    };
  }

  // Static method will be part on monngose class
  // this.app.getModel('SomeModel').someStaticMethod()
  static async someStaticMethod() {
    const somedata = await this
      .findByIdAndUpdate
      //.....
      ();
    const { app } = this.getSuper();
    return somedata;
  }

  // any methods will be part on instance method
  // await this.app.getModel('SomeModel').findById(124).someInstanceMethod()
  async someInstanceMethod() {
    // you can access app into the instance method
    const { app } = this.getSuper();

    // inside of instance method you can access model data
    this.someString;
  }

  // any getters will became a mongoose virtual
  // const SomeModels = this.app.getModel("SomeModel").
  // const someModelInstance = await SomeModel().create({ email: 'test@gmail.com' });;
  // `domain` is now a property on SomeModels documents.
  // someModelInstance.domain; // 'gmail.com'
  get domain() {
    return this.email.slice(this.email.indexOf("@") + 1);
  }

  // setters also be an virtual
  // const SomeModels = this.app.getModel("SomeModel").
  // const someModelInstance = new SomeModel();
  // Vanilla JavaScript assignment triggers the setter
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
```

:::tip

If you have some relations ("ref") on a mongoose model that you should care to load schema. As mongoose can only build relationships with schemas in memory. Google place to do that - inside constructor. Be aware on loop linking models

```js
constructoror(app){
	super(app);
	this.app.getModel(“ReferenceModelName”);
}
```

:::

:::warning

Models united onse per process and then united instances cached. Do NOT expect constructor or init hook calls on every model loading

:::

:::tip

Please do not name the model in plural form.

**Bad** - Coin**s**

**Good** - Coin

:::

## API

```js
getModel(modelName: string): MongooseModel<any>;
```

Example:

```js
const UserModel = this.app.getModel("User");
const userInstace = await UserModel.findOne({ email: "user@email.com" });
```

## Configuration

Main configuration variable "MONGO_DSN" environment variable. Based on it model will made connection to the database

## Built-in models

Framework came with few built-in models.

### User

It's a part of the authorization system. It takes care of storing users, hash passwords and provides some basic functions for token generation and getting users.

If you want to have your own user implementation you should overwrite it or disable.

Auth controller depends on this model

#### API

```js
const UserModel = this.app.getModel("User");
const user = await UserModel.getUserByEmailAndPassword("email","password"):
const userToken = await user.generateToken(); // generate and store token on databse
const userPublic = await user.getPublic();
const hashedPassword = await UserModel.hashPassword("password");
const sameUser = await UserModel.getUserByToken(userToken);
const sameUserAgain = await UserModel.getUserByEmail(user.email);
const recoveryToken = await UserModel.generateUserPasswordRecoveryToken(user);
const sameUSerAgain2 = await UserModel.getUserByPasswordRecoveryToken(recoveryToken);
const isSuccess = await user.sendPasswordRecoveryEmail(i18n);
const verificationToken = await UserModel.generateUserVerificationToken(user);
const sameUSerAgain3 = awaitUserModel.getUserByVerificationToken(verificationToken);
await UserModel.removeVerificationToken(verificationToken);
const isSuccess2 = await user.sendVerificationEmail(i18n);
```

### Migration

Migration model it's helper for migration subsystems. It stores migrated files to make sure that migrated executed once

Please refer to CLI/migrations for more details

You probably should not use this model directly

### Sequence

Sequence allows you to generate sequences by name. This is cross server safe method to generate sequences in distributed environment

```javascript
const SequenceModel = this.app.getModel("Sequence");
// will be 1
const someTypeSequence = await SequenceModel.getSequence("someType");
// will be 2
const someTypeSequence2 = await SequenceModel.getSequence("someType");
// will be 1 as type is another
const someAnotherTypeSequence = await SequenceModel.getSequence(
  "someAnotherType"
);
```

### Lock

Lock model is designed to provide ability to lock some resources in distributed environment.

This can be external requests, some actions in the system, etc.

Imagine that you have a log of traffic that asks external system for some data. You have cache of this data as weel, but initially you shaul asks internal api to get this data. And you want to make sure that you asking this api for that data only one time and other same time requests will wait for the result instead of asking api. This is where Lock model can help you.

```javascript

const LockModel = this.app.getModel("Lock");

  /**
   * acquire lock based on lock name
   * @param {string} name
   * @param {number} [ttlSeconds=30]
   * @returns {Promise<boolean>}
   */
  async acquireLock(name, ttlSeconds = 30)

  /**
   * release lock based on lock name
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async releaseLock(name)

  /**
   * wait lock based on lock name
   * @param {string} name
   * @returns {Promise}
   */
  async waitForUnlock(name)

  /**
   * get lock remaining time based on lock name
   * @param {string} name
   * @returns {Promise<{ttl: number}>}
   */
  async getLockData(name)


  /**
   * get lock remaining time based on lock name
   * @param {string[]} names
   * @returns {Promise<{name: string, ttl: number}[]>}
   */
  static async getLocksData(names)

```

Example of usage:

```javascript

async someHTTPRequestWithExpensiveExternalAPI(req,res){
  // we have some external request (this can be same time request from different users)
  const LockModel = this.app.getModel("Lock");
  // lets say its a AI processing of video (for example)
  const {videoId} = req.appInfo.request;

  // check if we already have it 
  const VideoAIModel = this.app.getModel("VideoAIModel");
  const videoAI = await VideoAIModel.findOne({videoId});
  if(videoAI){
    return res.json(videoAI.getPublic());
  }

  const lockName = `video-ai-processing-${videoId}`;

  // we have no that video, lets send it otp rocessing with lock 
  const isLockAcquired = await LockModel.acquireLock(lockName);
  if(isLockAcquired){
    const result = await videoAIService.processVideo(videoId);
    const videoModel = await VideoAIModel.create({videoId, result});
    // release lock 
    await LockModel.releaseLock(lockName);
    // return result
    return res.json(videoModel.getPublic());
  }

  // we have no lock, lets wait for it
  await LockModel.waitForUnlock(lockName);
  // lookslikeexternal process is done, lets check if we have result
  const videoAI2 = await VideoAIModel.findOne({videoId});
  if(videoAI2){
    return res.json(videoAI.getPublic());
  }

  // we have no result, lets return error
  return res.status(500).json({error: "something went wrong"});
}

```
