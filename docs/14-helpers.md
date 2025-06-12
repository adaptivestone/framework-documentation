# Helpers

The framework provides some helpers to make your code easier to work with.

## App instance

You are able to access the app instance from anywhere.

```ts
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";
```

The app instance is the heart of the framework, and you are able to get models, configs, etc. from it.

```ts
const Model = appInstance.getModel("ModelName");
const s3config = appInstance.getConfig("s3");
// etc
```
