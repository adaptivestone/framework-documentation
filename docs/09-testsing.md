# Testing

The framework comes with [Vitest](https://vitest.dev/) support. When you name files with the `.test.(js|ts)` extension, they will be added to the tests. The test lifecycle is runner-agnostic, so you can also drive it from Node's built-in [`node:test`](https://nodejs.org/api/test.html) — see [Using with `node:test`](#using-with-nodetest).

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

The test entry point is at the project level in ‘src/tests/setup.ts’. This file prepares all folder configs, requires the framework setup, and prepares the global setup for tests.

The minimum Vite config file should contain:

```js
  test: {
    globalSetup: [ // This script will start Mongo (DIST in important there)
      'node_modules/@adaptivestone/framework/dist/tests/globalSetupVitest',
    ],
    setupFiles: [
      './src/tests/setup.ts', // this is a config files with directory location
      '@adaptivestone/framework/tests/setupVitest.js', // This is the entry point for testing from the  framework
      './src/tests/setupHooks.ts', // This is a local config file (see below)
    ],
  }
```

### Global setup (once per test running)

You are able to provide additional setup and teardown functions to global setup.
Just add your implementation in an additional (or instead of) globalSetup

```js
  test: {
    globalSetup: [
      'node_modules/@adaptivestone/framework/dist/tests/globalSetupVitest',
      './src/tests/globalSetup.ts', // custom file for global setup and teardown
    ],
    // ...
  }
```

### Custom hooks (beforeAll, etc) per test

Testing helpers provide isolation of modules, and we run preparation of the framework and teardown for each test as well.

```js
  test: {
    //...
    setupFiles: [
      './src/tests/setup.ts', // this is a config files with directory location
      '@adaptivestone/framework/tests/setupVitest.js', // This is the entry point for testing from the  framework
      './src/tests/setupHooks.ts', // <-- we are able to provide custom logic there
    ],
  }
```

You can provide any amount of testing configs

Example:

```ts ./src/tests/setupHooks.ts
import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createDefaultTestUser } from "./testHelpers.ts";

beforeAll(async () => {
  await createDefaultTestUser();
});

afterAll(async () => {
  // do something
});

beforeEach(async () => {
  // do something
});

afterEach(async () => {
  // do something
});
```

### Default User for Testing

You are able to call the creation of a default user. The user is not created by default. You should call it manually.

```js
import {
  defaultUser, // instance of user if default user was created
  defaultAuthToken, // default token for auth if user was created
  createDefaultTestUser, // create default user and populate defaultUser and defaultAuthToken.
} from "@adaptivestone/framework/tests/testHelpers.js";

const { user, token } = await createDefaultTestUser();
// defaultUser - same user
// defaultAuthToken - same token
```

## Using with `node:test`

The framework's test lifecycle is **runner-agnostic**: the setup logic lives in plain async functions (`@adaptivestone/framework/tests/setupFramework.js`) with no vitest dependency, so you can drive it from Node's built-in [`node:test`](https://nodejs.org/api/test.html) runner. `vitest` is an optional peer dependency — node:test users don't need it installed.

Wire it per file (mirrors `setupVitest`):

```ts
import "@adaptivestone/framework/tests/setupNodeTest.js"; // server per file + per-test redis isolation
import { test } from "node:test";
import assert from "node:assert/strict";
import { getTestServerURL } from "@adaptivestone/framework/tests/testHelpers.js";

test("returns 400 on a bad body", async () => {
  const { status } = await fetch(getTestServerURL("/some/endpoint"), { method: "POST" });
  assert.equal(status, 400);
});
```

### The one difference: global Mongo

vitest runs all files in one process and starts the in-memory Mongo once via `globalSetup`. node:test runs **each file in its own process**, so there is no per-file place to start a shared Mongo. Use node:test's [global setup hook](https://nodejs.org/api/test.html#global-setup-and-teardown) (`--test-global-setup`) — the exact analog of vitest's `globalSetup`. Write a tiny entry module:

```ts title="globalSetup.ts"
import {
  startTestMongo,
  stopTestMongo,
} from "@adaptivestone/framework/tests/setupFramework.js";

export async function globalSetup() {
  await startTestMongo(); // sets TEST_MONGO_URI; every test process inherits it
}

export async function globalTeardown() {
  await stopTestMongo();
}
```

Run the whole suite through it (one Mongo, shared across every file):

```bash
node --test --test-global-setup=./globalSetup.ts
```

:::note
`--test-global-setup` is experimental (Stability 1) but ships in every Node ≥ 24 — the framework's own node:test suite uses it. If you'd rather avoid the flag, point `TEST_MONGO_URI` at an external Mongo (a CI service or a local instance) and skip the in-memory server.
:::

The runner-agnostic building blocks (exported from `@adaptivestone/framework/tests/setupFramework.js`):

| Export | Runs | Purpose |
|---|---|---|
| `startTestMongo` / `stopTestMongo` | once per run | in-memory Mongo replica set; sets `TEST_MONGO_URI` |
| `startTestServer` / `stopTestServer` | per file | boot / tear down a server against a fresh DB |
| `setTestRedisNamespace` / `clearTestRedisNamespace` | per test | isolate the cache / rate-limiter keyspace |

`setupVitest` and `setupNodeTest` are thin wrappers that wire these into each runner's hooks.

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

:::note

The `redis` service below is only needed if your tests exercise the **redis** cache or rate-limiter driver. With the default in-memory cache (and the default `mongo` rate limiter), you can drop the `redis` service and `REDIS_URI` entirely — `clearTestRedisNamespace` is a no-op when no Redis is reachable.

:::

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

## Server instance access

It's possible that in testing you will need to have low-level access to the server itself. We have a helper there too.

```js
import { serverInstance } from "@adaptivestone/framework/tests/testHelpers.js";
```

## Test-only controllers

When testing edge cases — broken handlers, unusual middleware combinations, schemas designed to fail — you don't have to put fixture controllers in your production controllers folder. Register them explicitly via `app.controllerManager.registerController(ControllerClass, prefix?)`.

The framework's `Server.startServer()` accepts a `callbackBefore404` hook that runs after the controller manager initializes the auto-loaded controllers but before the 404 handler is attached, so explicitly registered controllers mount in the right order.

```ts ./src/tests/setupHooks.ts
import { beforeAll } from "vitest";
import { serverInstance } from "@adaptivestone/framework/tests/testHelpers.js";
import BrokenController from "./fixtures/BrokenController.ts";
import FakeAuthMiddleware from "./fixtures/FakeAuthMiddleware.ts";

// If you control startServer yourself, register inside callbackBefore404:
//   await server.startServer(async () => {
//     server.app.controllerManager?.registerController(BrokenController, "broken");
//   });
//
// If you use the framework's standard test setup, register in beforeAll —
// late registration still works for tests because the test's HTTP requests
// only fire AFTER setup completes (so the 404 handler ordering is irrelevant
// in practice; the controller's routes are reachable on Express).
beforeAll(() => {
  serverInstance.app.controllerManager?.registerController(BrokenController, "broken");
});
```

`prefix` is the URL prefix segment — `registerController(BrokenController, "broken")` mounts on `/broken/brokencontroller/*`. Pass `''` (or omit) to mount at `/<classname>/`.

This pattern keeps fixture controllers out of your production controllers folder and gives each test full control over which controllers exist for it.

## HTTP Endpoint Testing

The framework provides a special function `getTestServerURL` to help you construct a full URL for testing.

```js
import { getTestServerURL } from "@adaptivestone/framework/tests/testHelpers.js";
const url = getTestServerURL("/auth");
```

Full example:

```js
import {
  getTestServerURL,
  defaultAuthToken,
} from "@adaptivestone/framework/tests/testHelpers.js";

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

The framework provides a set of helpers to simplify testing.

```js
import {
  getTestServerURL, // return server URL for testing  getTestServerURL('auth');
  defaultUser, // instance of user if default user was created
  defaultAuthToken, // default token for auth if user was created
  serverInstance, // server instance for low level interaction
  createDefaultTestUser, // create default user and populate defaultUser and defaultAuthToken.
  setDefaultUser, // in case you want to have own user implementation setDefaultUser(yourUser)
  setDefaultAuthToken, // in case you want to have own user implementation setDefaultAuthToken(token)
} from "@adaptivestone/framework/tests/testHelpers.js";
```

## Mock

In most cases, your code depends on external services, but you still need to perform testing. Calling an external service for each test can be expensive and is not necessary. For this problem, Vitest provides mock options. This is when, instead of calling the real SDK of a service, you call a fake function that provides the result without API calls.

[https://vitest.dev/api/vi.html#vi-mock](https://vitest.dev/api/vi.html#vi-mock)

### Mocking a Function

[https://vitest.dev/api/vi.html#mocking-functions-and-objects](https://vitest.dev/api/vi.html#mocking-functions-and-objects)

You can redefine an import for your own import.

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

{/*
Manual mocks are defined by writing a module in a **mocks** subdirectory immediately adjacent to the module. For example, to mock a module called user in the models directory, create a file called user.js and put it in the models/**mocks** directory. Note that the **mocks** folder is case-sensitive, so naming the directory **MOCKS** will break on some systems.

:::note
You should call moch load function before performing any operation on it

```js
vi.mock("path");
```

:::

### @google-cloud/translate example (NODE_MODULES)

Assume that we have some translation helper (synthetic example) that just does a translation and registers it in the database to speed it up for the next time.

/src/helpers/translateHelper.js

```js
import { v2 } from "@google-cloud/translate";
const translate = new v2.Translate();

// no error handling because it's an example. You should handle errors in production mode
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

Right now you want to test that the function works correctly. So as @google-cloud/translate.js is a node_modules module, we are creating a file:

```js
/__mocks__/@google-cloud/translate.js
```

The file extends the original Google Translate and overwrites some functions to avoid API calls.

```js /__mocks__/@google-cloud/translate.js
// A manual mock in __mocks__ just exports the fake module — no auto-mock helper needed.
class Translate {
  translate(text, lang) {
    return [`${text}_${lang}`, "this is test"];
  }
}

export default { v2: { Translate } };
```

Now inside your helper test file:

```js
vi.mock('@google-cloud/translate');

import translateHelper from '/src/helpers/translateHelper.js';


describe('mock testing', () => {
  it('should return translated text', async () => {
    expect.assertions(1);
    const translated = await translateHelper("text","fr");
    expect(translated).toBe("text_fr");
  })

  it('should store text in the database', async () => {
    expect.assertions(1);
    const translated = await TranslatedModel.find({text:"text", language:"fr"});
    expect(translated.translatedText).toBe("text_fr");
  })
})


``` 
*/}
