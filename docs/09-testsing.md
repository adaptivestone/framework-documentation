# Testing

Framework came out with [jest](https://jestjs.io/) support. When you named files {Something}.test.js then it will be added to tests

:::tip
Please put test files near main files that you are testing and put the same name to that file.
If you want to test “Auth.js” please create a file “Auth.test.js” and put it on the same folder

:::

## Frawemork (app) instance

Of course inside a test you need to have access to framework instance. In will available via global variable ‘global.server.app’

## Run tests

```bash
npm test
```

## Before scripts

Test entry points happen on project level ‘src/test/stetup.js’. This file prepares all folder configs, require framework setup and prepare global setup for tests

### global.testSetup

This is a special variable that configures the global behaviour of tests.

You have two hooks that will happen globally before the test run and after the test run.

```
global.testSetup.beforeAll
global.testSetup.afterAll
```

In additional you have ability to disable default user creating by adjusting variable

```
global.testSetup.disableUserCreate
```

Example:

```js src/tests/setup.js on project level
global.testSetup = {
  disableUserCreate: true, // we diabled user creating default one
  beforeAll: async () => {
    const User = global.server.app.getModel("User");
    global.user = await User.create({
      email: "test@test.com",
      password: "testPassword",
      role: ["admin"], // That new behaviour
    }).catch((e) => {
      console.error(e);
      console.info(
        "That error can happens in case you have custom user model. Please use global.testSetup.disableUserCreate flag to skip user creating"
      );
    });
    global.authToken = await global.user.generateToken();
    // here can be init for some connection, like for test instance of elastic search or redis
  },
  afterAll: async () => {
    // If you made connection do not miss to close it after test
  },
};
```

### Default user for testing

By default, create a default user with email 'test@test.com' and password 'testPassword'. User instance as ‘global.user’ and ‘global.authToken’ for auth token

You can change that behaviour by global variable ‘global.testSetup.disableUserCreate’

## Mongo instance

As a framework designed to work with mongo db and provide easy integration to it - then it comes with mongo db integration on tests too.

Integration came with help with [MongoDbMemoryServer](https://github.com/nodkz/mongodb-memory-server) package

By default, the framework starts the mongo memory server and afterwards stops it. So you can use mongo during your test

### Selecting own version

// TODO

### Mongo tests on ARM64 machines (docker)

For ARM64 we have an interesting situation. Mongo Inc provides binaries for Ubuntu and not for Debian, but node official images exist for Debian but not for Ubuntu.

To solve that situation we provide our own node docker image based on ubuntu. You can find it here [ubuntu-node-docker](https://gitlab.com/adaptivestone/ubuntu-node)

## Running tests in CI (gitlab)

Important stuff about testing - tests should be executed in an auto way on every git commit. That where CI (continue integration) go to light

.gitlab-ci.yml sample bellow

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

## Http endpoint testing

Good way to tests http it not use [supertest package](https://github.com/visionmedia/supertest)

That library have an easy way to integrate with express server

```js
const request = require("supertest");

describe("module", () => {
  describe("functon", () => {
    it("test", async () => {
      expect.assertions(1);
      const { status } = await request(global.server.app.httpServer.express) // integration with express
        .post("/some/endpoint")
        .set({ Authorization: global.User.token.token }) // our token for auth
        .send({
          // request object
          oneData: 1,
          secondDate: 2,
        });
      expect(status).toBe(400);
    });
  });
});
```

## Mock

In most cases your code depends on external services, but you still need to perform testing. Calling external service for each test can be expensive and that is not necessary. For this problem jset provides moch options. That when you instead of calling real sdk of service will call a fake function that provide result without api calls

[https://jestjs.io/docs/mock-functions](https://jestjs.io/docs/mock-functions)

### Manual mock

[https://jestjs.io/docs/manual-mocks](https://jestjs.io/docs/manual-mocks)

Manual mocks are defined by writing a module in a **mocks**/ subdirectory immediately adjacent to the module. For example, to mock a module called user in the models directory, create a file called user.js and put it in the models/**mocks** directory. Note that the **mocks** folder is case-sensitive, so naming the directory **MOCKS** will break on some systems.

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
const { Translate } = require("@google-cloud/translate").v2;
const translate = new Translate();

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

module.exports = translateHelper;
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
module.exports = googleTranslate;
```

Now insside you helper test file

```js
jest.mock('@google-cloud/translate');

const translateHelper = require('/src/helpers/translateHelper.js');


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


```