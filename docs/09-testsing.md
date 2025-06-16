# Testing

The framework comes with [Vitest](https://vitest.dev/) support. When you name files with the `.test.(js|ts)` extension, they will be added to the tests.

:::tip
Please put test files near the main files that you are testing and give them the same name.
If you want to test “Auth.js”, please create a file named “Auth.test.js” and put it in the same folder.

:::

## Framework (app) Instance

Of course, inside a test, you need to have access to the framework instance. It will be available via appInstanceHelper

```js
import { appInstance } from "@adaptivestone/framework/helpers/appInstance.js";
```

## Run Tests

```bash
npm test
```

## Before Scripts

The test entry point is at the project level in ‘src/test/setupVite.js’. This file prepares all folder configs, requires the framework setup, and prepares the global setup for tests.

The minimum Vite config file should contain:

```js
  test: {
    globalSetup: [ // This script will start Mongo (DIST in important there)
      'node_modules/@adaptivestone/framework/dist/tests/globalSetupVitest',
    ],
    setupFiles: [
      './src/tests/setup.js', // This is a local config file (see below)
      '@adaptivestone/framework/tests/setupVitest', // This is the entry point for testing from the framework
    ],
  }
```

### global.testSetup

This is a special variable that configures the global behavior of tests.

You have two hooks that will happen globally before and after the test run:

```
global.testSetup.beforeAll
global.testSetup.afterAll
```

In addition, you have the ability to disable the default user creation by adjusting the variable:

```
global.testSetup.disableUserCreate
```

Example:

```js src/tests/setup.js on project level
global.testSetup = {
  disableUserCreate: true, // We disabled the default user creation
  beforeAll: async () => {
    const User = appInstance.getModel("User");
    global.user = await User.create({
      email: "test@test.com",
      password: "testPassword",
      role: ["admin"], // This is new behavior
    }).catch((e) => {
      console.error(e);
      console.info(
        "That error can happen in case you have a custom user model. Please use the global.testSetup.disableUserCreate flag to skip user creation."
      );
    });
    global.authToken = await global.user.generateToken();
    // Here you can initialize some connections, like for a test instance of Elasticsearch or Redis.
  },
  afterAll: async () => {
    // If you made a connection, do not forget to close it after the test.
  },
};
```

### Default User for Testing

you able to call creating of default user. User not created by default. You should call in manually

```js
import {
  defaultUser, // instance if user if default user was created
  defaultAuthToken, // default token for auth if user was created
  createDefaultTestUser, // create default user and populate defaultUser and defaultAuthToken.
} from "@adaptivestone/framework/tests/testHelpers.js";

const { user, token } = await createDefaultTestUser();
// defaultUser - same user
// defaultAuthToken - same token
```

## Mongo Instance

As the framework is designed to work with MongoDB and provide easy integration with it, it also comes with MongoDB integration in tests.

The integration is done with the help of the [MongoDbMemoryServer](https://github.com/nodkz/mongodb-memory-server) package.

By default, the framework starts the Mongo memory server and stops it afterward. So you can use Mongo during your tests.

### Mongo Tests on ARM64 Machines (Docker)

For ARM64, we have an interesting situation. Mongo Inc. provides binaries for Ubuntu but not for Debian, but official Node images exist for Debian but not for Ubuntu.

To solve this situation, we provide our own Node Docker image based on Ubuntu. You can find it here: [ubuntu-node-docker](https://gitlab.com/adaptivestone/ubuntu-node).

## Running Tests in CI (GitLab)

An important thing about testing is that tests should be executed automatically on every Git commit. That is where CI (Continuous Integration) comes in.

A `.gitlab-ci.yml` sample is below:

```yaml
stages:
  - install
  - checks

install:
  stage: install
  image: registry.gitlab.com/adaptivestone/ubuntu-node:latest
  script:
    - node -v
    - npm install
  artifacts:
    paths:
      - node_modules/
    expire_in: 2 hour

codestyle:
  stage: checks
  image: registry.gitlab.com/adaptivestone/ubuntu-node:latest
  needs:
    - install
  dependencies:
    - install
  allow_failure: true
  script:
    - npm run codestyle

tests:
  stage: checks
  image: registry.gitlab.com/adaptivestone/ubuntu-node:latest
  needs:
    - install
  dependencies:
    - install
  script:
    - npm run test
```

## Running Tests in CI (GitHub)

It is better to look at the [repo](https://github.com/adaptivestone/framework/blob/main/.github/workflows/test.yml).

```yml
# yaml-language-server: $schema=https://json.schemastore.org/github-workflow.json

name: Test

on:
  push:
    branches: ["*"]

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    services:
      redis:
        image: redis:latest
        ports:
          - 6379:6379

    env:
      LOGGER_CONSOLE_LEVEL: "error"
      REDIS_URI: redis://localhost

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "latest"
          cache: "npm"

      - name: npm clean install
        run: npm ci

      - name: Run Test
        run: npm test

      - name: Upload results to Codecov
        uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

## Server isntance access

Possible that in testing you will need to have low level access to server itself. We have helper there too

```js
import { serverInstance } from "@adaptivestone/framework/tests/testHelpers.ts";
```

## HTTP Endpoint Testing

The framework provides a special function `getTestServerURL` to help you construct full url for testing.

```js
import { getTestServerURL } from "@adaptivestone/framework/tests/testHelpers.js";
const url = getTestServerURL("/auth");
```

Full example:

```js
import {
  getTestServerURL,
  defaultAuthToken,
} from "@adaptivestone/framework/tests/testHelpers.ts";

describe("module", () => {
  describe("function", () => {
    it("test", async () => {
      expect.assertions(1);
      const { status } = await fetch(getTestServerURL("/some/endpoint"), {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Authorization: defaultAuthToken,
        },
        body: JSON.stringify({
          // request object
          oneData: 1,
          secondDate: 2,
        }),
      }).catch(() => {});
      expect(status).toBe(400);
    });
  });
});
```

## Test Helpers

Framework provides set of helpers to simplyfy testing

```js
import {
  getTestServerURL, // return server url for teesting  getTestServerURL('auth');
  defaultUser, // instance if user if default user was created
  defaultAuthToken, // default token for auth if user was created
  serverInstance, // server instance for low level interaction
  createDefaultTestUser, // create default user and populate defaultUser and defaultAuthToken.
  setDefaultUser, // in case you want to have own user implementation setDefaultUser(yourUser)
  setDefaultAuthToken, // in case you want to have own user implementation setDefaultAuthToken(token)
} from "@adaptivestone/framework/tests/testHelpers.js";
```

## Mock

In most cases, your code depends on external services, but you still need to perform testing. Calling an external service for each test can be expensive and is not necessary. For this problem, Vitest provides mock options. That is when you, instead of calling the real SDK of a service, will call a fake function that provides the result without API calls.

[https://vitest.dev/api/vi.html#vi-mock](https://vitest.dev/api/vi.html#vi-mock)

### Mocking a Function

[https://vitest.dev/api/vi.html#mocking-functions-and-objects](https://vitest.dev/api/vi.html#mocking-functions-and-objects)

You are able to redefine an import for your own import.

```js
vi.doMock("../file.js", () => ({
  fileFunction: async () => ({
    isSuccess: true,
  }),
}));
```

Redefine one method in a file:

```javascript
import S3 from "../S3.js";
vi.spyOn(S3, "validateCreds").mockImplementation(() => true);
```

There are many more mocking options. Please refer to the Vitest documentation for others.

<!-- Manual mocks are defined by writing a module in a **mocks**/ subdirectory immediately adjacent to the module. For example, to mock a module called user in the models directory, create a file called user.js and put it in the models/**mocks** directory. Note that the **mocks** folder is case-sensitive, so naming the directory **MOCKS** will break on some systems.

:::note
You should call moch load function before performing any operation on it

```js
jest.mock("path");
jest.createMockFromModule("module");
```

:::

### @google-cloud/translate example (NODE_MODULES)

Assume that we have some translation helper (synthetic example) that just do and translation and register it in database for speed up for next time

/src/helpers/translateHelper.js

```js
import { v2 } from "@google-cloud/translate";
const translate = new v2.Translate();

// no errors hanling because it example. You should hanlde error on production mode
// no model passing
const translateHelper = async (text, language) => {
  const alreadyTranslatedData = await TranslatedModel.find({ text, language });
  if (alreadyTranslatedData) {
    return alreadyTranslatedData.translatedText;
  }

  const translated = await translate.translate(text, language);
  const data = await TranslatedModel.create({
    text,
    language,
    translatedText: translated[0],
  });
  return translated[0];
};

export default translateHelper;
```

Right now you want to test that function works correctly. So as @google-cloud/translate.js an node_modules module we creating file

```js
/__mocks__/@google-cloud/translate.js
```

File extends original google translate and overwrite some function to avoid API calls

```js /__mocks__/@google-cloud/translate.js
const googleTranslate = jest.genMockFromModule("@google-cloud/translate");

class Translate {
  translate(text, lang) {
    return [`${text}_${lang}`, "this is test"];
  }
}

googleTranslate.v2.Translate = Translate;
export default googleTranslate;
```

Now insside you helper test file

```js
jest.mock('@google-cloud/translate');

import translateHelper from '/src/helpers/translateHelper.js';


describe('mock testing', () => {
  it('should return translated text', async () => {
    expect.assertions(1);
    const translated = await translateHelper("text","fr");
    expect(translated).toBe("text_fr");
  })

  it('should store text on database', async () => {
    expect.assertions(1);
    const translated = await TranslatedModel.find({text:"text", "fr"});
    expect(translated.translatedText).toBe("text_fr");
  })
})


``` -->
