# File Inheritance

The framework provides a flexible way to overwrite some functionalities from the core. You can create a file with the same name in the same folder, and the framework will use this file instead of the built-in one.

Let’s go with an example. We have a User model built directly with the framework with some user-related stuff. We want to provide a fully different implementation of this model.

To do that, we will create a user model file at the project level in the model folder.

```js
project/
├─ node_modules/
│  ├─ @adaptivestone/
│  │  ├─ framework/
│  │  │  ├─ models/
│  │  │  │  ├─ User.ts // Built-in model. Mark it as "User_original"
├─ src/
│  ├─ models/ // Contains model files
│  │  ├─ User.ts // File that will be used. Mark it as "User_project"

```

```js
const User = this.app.getModel("User"); // Will return the "User_project" model
```

This also happens at **all** levels of the code. If some code inside the framework asks for the “User” model, it will get the “User_project” model.

The same approach works for models, controllers, and configs.

## How To

### Extend a module with new functionality instead of completely overwriting it

That's easy. Just require the original file and extend it.
Please note: TypeScript types are fully optional. You are able to use plain JavaScript too.

```ts
import OriginalUserModel from "@adaptivestone/framework/models/User.ts";

class User extends OriginalUserModel {
  static get modelStatics() {
    type UserModelLite = GetModelTypeLiteFromSchema<
      typeof User.modelSchema,
      ExtractProperty<typeof User, "schemaOptions">
    >;

    return {
      ...OriginalUserModel.modelStatics, // Grab the original model methods
      getPublic: function getPublic(this: InstanceType<UserModel>) {
        return {
          userName: this.name,
        };
      },
    };
  }
}
```

### Disable functions completely

To disable something (like a default controller), the best way is to overwrite it with an empty implementation.

```js
import AbstractController from "@adaptivestone/framework/modules/AbstractController.js";

class Auth extends AbstractController {}

export default Auth;
```
