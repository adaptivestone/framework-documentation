# CLI

The CLI (Command Line Interface) is a part of the framework system that allows you to use the full power of the framework on the command line - manipulate data, import, export, etc.

The framework scans the directory for a list of commands and provides you with the ability to see what commands are available to run.

:::note

CLI commands are part of the [framework inheritance process](03-files-inheritance.md).

:::

## Run Command

Your project's CLI entry must forward the command result to the process exit
code. This makes failed migrations, code generation, and other commands fail CI
and deployment steps instead of appearing successful:

```ts
import Cli from "@adaptivestone/framework/Cli.js";
import folderConfig from "./folderConfig.ts";

const cli = new Cli(folderConfig);
const result = await cli.run();

process.exit(result ? 0 : 1);
```

You are able to create a group of commands by putting files in a directory. You can see ‘migration’ as an example of grouping commands.

```bash
# On the project level
node src/cli.ts {command}

# OR
npm run cli
```

The command path works the same way as in controllers. Any file will be parsed as a command, and folders will group commands together.
But unlike at the controller level, you are not able to change that behavior.

You are able to create a group of commands by putting files in a directory. You can see ‘migration’ as an example of grouping commands.

```js
commands / migration / create.ts; // migration/create command
commands / migration / migrate.ts; // migration/migrate command
```

## API

You are able to run a command from any place in the framework.

```js
this.app.runCliCommand(commandName: string, args: {}): Promise;
```

Where:
`commandName` - the name of the command that you want to start.
`args` - the arguments that you want to pass to the command.

## Creating Your Own Command

All passed arguments on the command line are parsed with the help of the `parseArgs` module.

```ts
import AbstractCommand from "@adaptivestone/framework/modules/AbstractCommand.js";
import type { CommandArgumentToTypes } from "@adaptivestone/framework/modules/AbstractCommand.js";

class CommandName extends AbstractCommand {
  static get description() {
    return "Some nice description of the command";
  }

  /**
   * You are able to add command arguments for parsing here.
   * https://nodejs.org/api/util.html#utilparseargsconfig
   */
  static get commandArguments() {
    return {
      id: {
        type: "string",
        description: "User ID to find the user",
      },
      email: {
        type: "string",
        description: "User email to find/create the user",
      },
      password: {
        type: "string",
        description: "New password for the user",
      },
      roles: {
        type: "string",
        required: true, // make sure that command will ask this from user
        description:
          "User roles as a comma-separated string (--roles=user,admin,someOtherRoles)",
      },
      update: {
        type: "boolean",
        default: false,
        description: "Update the user if they exist",
      },
    } as const; // <- this is important for type generation
  }

  static isShouldInitModels = true; // Default value. Can be omitted.

  /**
   * If true, then this command will get model paths with inheritance.
   */
  static isShouldGetModelPaths = true;

  /**
   * Return the name of the connection that you want to use.
   */
  static getMongoConnectionName(commandName, args) {
    return `CLI: ${commandName} ${JSON.stringify(args)}`;
  }

  async run() {
    // CommandArgumentToTypes will generate types from  commandArguments description
    const { id, email, password, roles, update } = this
      .args as CommandArgumentToTypes<typeof CommandName.commandArguments>;

    return new Promise((resolve, reject) => {});
  }
}

export default CommandName;
```

:::note Model commands wait for the database connection

`static isShouldInitModels = true` (the default) makes the framework load and initialize your models before the command runs **and wait for the MongoDB connection to be ready** — so your command's first query never races a not-yet-established connection (the cause of intermittent "buffering timed out" errors). You don't need to add your own connection-readiness check.

Set it to `false` for commands that don't touch the database (e.g. code generation, crypto helpers) so they start instantly without connecting. `static isShouldGetModelPaths` loads model _paths_ only (for type/path resolution) — it does not initialize models or open a connection.

:::

:::tip

For boolean types, we also support negative values (without a prefix).

```js
      update: {
        type: "boolean",
      },
```
```bash
node src/cli.ts ourCommand --update
```
Update Argument will by true

```bash
node src/cli.ts ourCommand --no-update
```
update argumant will be false 

:::

## Framework Commands

The framework comes with a few built-in commands.

### Migration

Migration commands allow you to migrate some data to another, or fill the database with some data.

The key point here is that a migration is executed only once per file.

:::tip

You can use migrations for different cases, not only to modify data in the database.

:::

#### Creating a Migration

The migration command comes with a template to generate a migration.

```js
node src/cli.ts migration/create --name={someName}
```

After creating the migration, please edit it and implement any logic that you want here.

#### Applying a Migration

```js
node src/cli.ts migration/migrate
```

A migration is executed in the order it was created. It is executed only once per life.

### DropIndex

Sometimes it is very useful to drop indexes on already created models. For example, you created a unique index for non-required fields and missed that `null` values also should be unique per collection.

The framework will take care of creating indexes based on your model on the next start, so you can drop an index and be sure that it will be recreated after.

#### Run dropindex

```js
node src/cli.ts dropindex --model={modelName}
```

### SyncIndexes

Synchronizes the indexes defined in the models with the real ones indexed in the database. The command will remove all indexes from the database that do not exist in the model OR have different parameters. Then it will create new indexes.

:::warning

This can be a dangerous command in case you have some unique index features.

:::

#### Run SyncIndexes

```js
node src/cli.ts SyncIndexes
```

### CreateUser

The `createuser` command creates a new user.

#### Run CreateUser

```js
node src/cli.ts createuser --email=somemail@gmail.com --password=somePassword --roles=user,admin,someOtherRoles
```

Only email and password are required.

You are able to update a user as well. You need to specify the email or user ID to find the user and the '--update' flag to allow user updates.

### Generate Random Bytes

In some cases, you need a random byte string. This command helps you to generate a random byte string.

#### Run Generate Random Bytes

```js
node src/cli.ts generateRandomBytes
```

or

```js
npm run cli generateRandomBytes
```

### Generate TypeScript Types

Generates two kinds of TS source from the framework's introspection:

1. **`genTypes.d.ts`** at the project root — augments `IApp` so `getConfig('foo')` and `getModel('Bar')` are typed.
2. **`<File>.routes.gen.ts`** next to every controller — typed `<MethodName>Request` aliases for handler signatures (per-route schema output, middleware-provided `appInfo` fields, etc.). The middleware chain comes from `RouteRegistry.flatten()` — same matcher the runtime uses, so types match runtime behavior. See [Routes → Typed handler signatures (codegen)](06-Controllers/02-routes.md#typed-handler-signatures-codegen) for usage.

#### Run Generate TypeScript Types

```bash
node src/cli.ts generatetypes
# or
npm run cli generatetypes
```

#### Recommended setup

Add to `package.json`:

```json
"gen": "node src/cli.ts generatetypes",
"check:types": "npm run gen && tsc --noEmit"
```

Add to `.gitignore`:

```
genTypes.d.ts
**/*.routes.gen.ts
```

Gen files regenerate on every type-check — no postinstall hook needed.

#### When to run codegen

Codegen only affects **types**, never runtime — so you run it whenever something that changes a handler's or `IApp`'s type shape changes, then type-check. In practice you wire it into `check:types` and forget it's there. The decision matrix:

| You changed… | Run `gen`? | Why |
|---|---|---|
| A route's `request:` / `query:` schema | **Yes** | `req.appInfo.request` / `.query` types change |
| A route path (added `:param` / `{*splat}`, renamed) | **Yes** | `req.params` and the `<Method>Request` alias change |
| A controller's `static get middleware()` chain | **Yes** | which `provides` fields land on `req.appInfo` changes |
| A middleware's `static get provides()` | **Yes** | downstream `req.appInfo` types change |
| Added / renamed a model or config | **Yes** | `getModel('X')` / `getConfig('Y')` typings change |
| Only handler body logic (no signature/schema change) | No | the generated types are unchanged |
| Prose, comments, formatting | No | nothing type-bearing changed |

When in doubt, just run it — it's idempotent and cheap. The standard wiring (`"check:types": "npm run gen && tsc --noEmit"`) regenerates before every type-check, so you never run it by hand in CI. See [Routes → Typed handler signatures](06-Controllers/02-routes.md#typed-handler-signatures-codegen).

### Generate OpenAPI

Generates an OpenAPI 3.1 document from your controllers (paths, parameters, request bodies, security, tags) — derived from the route definitions you already write. Opens no database/network connection and binds no port, so it's safe in CI.

```bash
node src/cli.ts openapi                       # print to stdout
node src/cli.ts openapi --output openapi.json # write to a file
```

See the [OpenAPI chapter](17-openapi.md) for what's documented, how schemas are introspected, and how middlewares contribute security schemes.

### List Routes

Prints your project's route tree — every mounted method, full path, path/splat parameters, and the middleware chain that runs for each route — by walking the same route registry the server logs at boot. Like `openapi`, it opens no database/network connection and binds no port.

```bash
node src/cli.ts routes
```

Example output:

```text
Registered routes:
/
├── GET     /
└── auth  (mw: GetUserByToken, RateLimiter)
    ├── login
    │   └── POST    /auth/login  [request]
    └── verify
        └── POST    /auth/verify  [request]

3 route(s) across 5 node(s) in the tree.
```

Reading the annotations:

- **`(mw: A, B)`** — middleware newly attached at this node. Inherited middleware from parent nodes is shown as `pmw:` so each route line is self-contained about what runs before it.
- **`[request]` / `[query]`** — this route **validates** a request body / query string. They are presence flags, not the schema itself: a route either declares a validator or it doesn't. To see the actual field shapes, run `openapi` — it resolves each schema to JSON Schema (where the validator supports introspection). Imperative validators such as `defineSchema` have no introspectable shape, so they appear here as `[request]` and degrade to a placeholder in the OpenAPI document.

Useful for answering "what's actually mounted in my app?" without starting the server. For the full request/response contract, use [`openapi`](#generate-openapi).
