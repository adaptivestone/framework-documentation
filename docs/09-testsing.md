# Testing

The framework supports Node.js's built-in test runner and Vitest. New Node.js
24 projects should use the built-in runner: it executes TypeScript test files
natively, has no additional test-runner dependency, and integrates with the
framework's shared MongoDB and per-test isolation helpers.

Name tests `*.test.ts` or `*.test.js` and keep them next to the file they cover.
For example, test `src/controllers/Auth.ts` in
`src/controllers/Auth.test.ts`.

## Install the test database

The framework loads `mongodb-memory-server` lazily, so applications that use
the supplied in-memory MongoDB global setup must install it directly:

```bash
npm install --save-dev mongodb-memory-server
```

Redis is optional during tests. When `REDIS_URI` is configured, the framework
uses a fresh namespace for each test and clears it afterward.

## Node.js test-runner setup

Node.js runs every test file in a separate process. The framework therefore
splits its lifecycle into:

- a global setup that starts one MongoDB replica set for the complete run;
- per-file hooks that start and stop a framework server with a fresh database;
- per-test hooks that isolate the Redis namespace.

### Project test configuration

Keep project-specific test configuration in `src/tests/setup.ts`. This file can
set test folder locations or other environment required before the framework
server starts.

Create one preload file at `src/tests/setupNodeTest.ts`:

```ts
import './setup.ts';
import '@adaptivestone/framework/tests/setupNodeTest.js';
import './setupHooks.ts';
```

The runner preloads this file for every test file. Do not import it from each
individual test.

### Global MongoDB setup

Create `src/tests/globalSetupNodeTest.ts`:

```ts
export {
  globalSetup,
  globalTeardown,
} from '@adaptivestone/framework/tests/globalSetupNodeTest.js';
```

`globalSetup` starts MongoDB once and passes `TEST_MONGO_URI` to the child test
processes. `globalTeardown` stops it after every test file has finished.

### Custom hooks

Project hooks can live in `src/tests/setupHooks.ts`:

```ts
import { after, afterEach, before, beforeEach } from 'node:test';
import { createDefaultTestUser } from './testHelpers.ts';

before(async () => {
  await createDefaultTestUser();
});

after(async () => {
  // Clean up project-level test state.
});

beforeEach(async () => {
  // Prepare each test.
});

afterEach(async () => {
  // Clean up each test.
});
```

The framework hooks are already registered by `setupNodeTest.js`. Project hooks
should contain only application-specific preparation and cleanup.

### Validation messages and application locales

The framework test helper loads its built-in locale folder by default. It does
not automatically load the application's locale folder: set
`TEST_FOLDER_LOCALES` in `src/tests/setup.ts` when a suite specifically needs
rendered application copy.

Without that opt-in, application-specific validation message keys remain raw
in HTTP 400 responses. This is intentional for ordinary API tests—assert the
stable key and status code rather than translated prose that can change between
locales. A copy-specific test may point `TEST_FOLDER_LOCALES` at
`src/locales`, but should do so before `setupNodeTest.js` loads.

### Package scripts

Use a small command for local tests and watch mode. Keep coverage and reporters
in the CI command so ordinary development runs stay fast:

```json
{
  "scripts": {
    "test": "node --import=./src/tests/setupNodeTest.ts --test --test-global-setup=./src/tests/globalSetupNodeTest.ts \"src/**/*.test.ts\"",
    "t": "node --import=./src/tests/setupNodeTest.ts --test --watch --test-global-setup=./src/tests/globalSetupNodeTest.ts \"src/**/*.test.ts\"",
    "test:ci": "node --import=./src/tests/setupNodeTest.ts --test --experimental-test-coverage --test-coverage-exclude=\"src/**/*.test.ts\" --test-coverage-exclude=\"src/tests/**\" --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=75 --test-global-setup=./src/tests/globalSetupNodeTest.ts --test-reporter=spec --test-reporter-destination=stdout --test-reporter=lcov --test-reporter-destination=coverage/lcov.info \"src/**/*.test.ts\""
  }
}
```

Run the suite once:

```bash
npm test
```

Run it in watch mode:

```bash
npm run t
```

Run the CI configuration with coverage thresholds and LCOV output:

```bash
npm run test:ci
```

The example thresholds are 80% for lines, 80% for branches, and 75% for
functions. Adjust them deliberately as the project grows. The LCOV report is
written to `coverage/lcov.info`.

## Writing a Node.js test

Use `node:test` with the standard strict assertion module:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTestServerURL } from '@adaptivestone/framework/tests/testHelpers.js';

describe('person', () => {
  it('creates a person', async () => {
    const response = await fetch(getTestServerURL('/person'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Example Person',
        age: 30,
      }),
    });

    assert.equal(response.status, 200);
  });
});
```

The preload and global setup belong in the runner command, not in this file.

## Framework and server access

Use `appInstance` for the initialized framework application:

```ts
import { appInstance } from '@adaptivestone/framework/helpers/appInstance.js';
```

Use `serverInstance` when a test needs lower-level access to the server:

```ts
import { serverInstance } from '@adaptivestone/framework/tests/testHelpers.js';
```

## HTTP endpoint testing

The framework starts each test server on a random available port.
`getTestServerURL()` returns the correct URL:

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  defaultAuthToken,
  getTestServerURL,
} from '@adaptivestone/framework/tests/testHelpers.js';

it('rejects an invalid request', async () => {
  const response = await fetch(getTestServerURL('/some/endpoint'), {
    method: 'POST',
    headers: {
      authorization: defaultAuthToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ invalid: true }),
  });

  assert.equal(response.status, 400);
});
```

Do not catch and discard `fetch()` errors in tests. A rejected request should
fail the test and preserve the original error.

## Default test user

The framework does not create a user automatically. Call
`createDefaultTestUser()` from project setup when a suite needs one:

```ts
import {
  createDefaultTestUser,
  defaultAuthToken,
  defaultUser,
} from '@adaptivestone/framework/tests/testHelpers.js';

const { user, token } = await createDefaultTestUser();
```

`defaultUser` and `defaultAuthToken` reference the values created by the helper.
Projects with a custom User model should implement their own creation helper and
use `setDefaultUser()` and `setDefaultAuthToken()`.

## Test helpers

The public helpers are exported from
`@adaptivestone/framework/tests/testHelpers.js`:

```ts
import {
  createDefaultTestUser,
  defaultAuthToken,
  defaultUser,
  getTestServerURL,
  serverInstance,
  setDefaultAuthToken,
  setDefaultUser,
} from '@adaptivestone/framework/tests/testHelpers.js';
```

- `getTestServerURL(path)` returns the active test server URL.
- `serverInstance` exposes the current test server.
- `createDefaultTestUser()` creates the framework's default User and token.
- `setDefaultUser()` and `setDefaultAuthToken()` support custom User models.

## MongoDB and Docker

The global setup uses `MongoMemoryReplSet` with one `wiredTiger` member. Each
test file receives a unique database, and the framework drops it during
teardown.

MongoDB publishes ARM64 binaries for Ubuntu, but not for every Debian release
used by official Node.js Docker images. Use the project's Ubuntu-based Node
image for GitLab and ARM64 Docker testing:

```text
registry.gitlab.com/adaptivestone/ubuntu-node:latest
```

When installation and tests run in separate CI jobs, use the same image for
both. This prevents Linux, libc, Node.js, and native dependency mismatches. The
current Ubuntu image supports MongoMemoryServer's automatic distro and MongoDB
version selection; application setup should not normally set
`MONGOMS_DISTRO` or `MONGOMS_VERSION`.

This template uses `npm install` in CI and production image builds. npm can
remove optional dependency records for other CPU architectures when it rewrites
`package-lock.json`; a later `npm ci` on another architecture may then reject
the otherwise valid lockfile. `npm install` repairs those optional records in
the CI workspace and avoids making an ARM-generated lockfile block an x64 job.

## GitLab CI

The following pipeline installs dependencies once and runs quality checks and
tests with the exact same Ubuntu/Node artifact:

```yaml
stages:
  - install
  - checks

default:
  # Keep dependency installation and execution on the same Ubuntu/Node image.
  # Ubuntu is also required for mongodb-memory-server binary availability.
  image: registry.gitlab.com/adaptivestone/ubuntu-node:latest

install:
  stage: install
  script:
    # Keep cross-platform optional dependencies resolvable after an ARM install.
    - npm install
  artifacts:
    paths:
      - node_modules/
    expire_in: 2 hours

quality:
  stage: checks
  needs:
    - install
  script:
    - npm run check

tests:
  stage: checks
  needs:
    - install
  services:
    - redis:latest
  variables:
    EMAIL_TRANSPORT: stub
    REDIS_URI: redis://redis
  script:
    - npm run test:ci
  coverage: '/[Aa]ll files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    when: always
    paths:
      - coverage/lcov.info
```

## GitHub Actions

GitHub-hosted Ubuntu runners can use Node.js 24 directly:

```yaml
name: Test

on:
  push:
    branches: ['*']

jobs:
  test:
    name: Node 24
    runs-on: ubuntu-latest
    permissions:
      contents: read

    services:
      redis:
        image: redis:latest
        ports:
          - 6379:6379

    env:
      LOGGER_CONSOLE_LEVEL: error
      REDIS_URI: redis://localhost

    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: npm

      - name: Install dependencies
        # ARM npm can omit optional x64 peers when it rewrites package-lock.json.
        run: npm install

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v6
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
```

## Mocking

Node.js provides function and method mocks through each test's `MockTracker`:

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import S3 from '../S3.ts';

it('validates credentials', (t) => {
  const validateCreds = t.mock.method(S3, 'validateCreds', () => true);

  assert.equal(S3.validateCreds(), true);
  assert.equal(validateCreds.mock.callCount(), 1);
});
```

Mocks created through `t.mock` are restored automatically after the test.
Whole-module ESM mocking is experimental in Node.js 24 and requires
`--experimental-test-module-mocks`; prefer method mocks or dependency injection
unless module replacement is necessary.

## Optional Vitest setup

The framework continues to support Vitest for existing projects. Configure its
public adapters instead of importing framework lifecycle internals:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: [
      '@adaptivestone/framework/tests/globalSetupVitest.js',
    ],
    setupFiles: [
      './src/tests/setup.ts',
      '@adaptivestone/framework/tests/setupVitest.js',
      './src/tests/setupHooks.ts',
    ],
  },
});
```

Vitest hooks and mocks should use Vitest's APIs. Do not load the Node.js and
Vitest adapters in the same test run.
