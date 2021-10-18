---
sidebar_position: 3
---

# Files inheritance 

Framework provides a flexible way to overwrite some functionalities from core. You can create file with same name on same folder and framework will use this file instead on build one 

Let’s go with a sample. We have a User model built directly with a framework with some user related stuff. We want to provide fully different implementation of this model

To do that we will create an user model file on project level model folder

```js
project/ 
├─ node_modules/
│  ├─ @adaptivestone/
│  │  ├─ framework/
│  │  │  ├─ models/
│  │  │  │  ├─ User.js // build in model. Mark in as "User_original"
├─ src/
│  ├─ models/ // contains model files 
│  │  ├─ User.js // file that will be used. Mark in as "User_project"

```

```js
const User = this.app.getModel("User"); // will return "User_project" model
```

That also happens on **all** level of code. If some code inside the framework will ask for the “User” model it will get the “User_project” model.

Same approach works for: models, controllers, config


## How to 

### Extend module with a new functional instead of completely overwrite it 

That's easy. Just require original file and extend it 

```js
const OriginalUserModel = require('@adaptivestone/framework/models/User');

class User extends OriginalUserModel {
  getPublic() {
    return {
      userName: this.name
    };
  }

}
```

### Disable functions completely

To disable something (like default controller) best way to overwrite it with empty implementation 


```js
const AbstractController = require('@adaptivestone/framework/modules/AbstractController');

class Auth extends AbstractController {}

module.exports = Auth;

```
