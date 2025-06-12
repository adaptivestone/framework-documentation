# CLI

The CLI (Command Line Interface) is a part of the framework system that allows you to use the full power of the framework on the command line - manipulate data, import, export, etc.

The framework scans the directory for a list of commands and provides you with the ability to see what commands are available to run.

:::note

CLI commands are part of the [framework inheritance process](03-files-inheritance.md).

:::

## Run Command

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

```js
import AbstractCommand from '../modules/AbstractCommand.ts';

class CommandName extends AbstractCommand {
  static get description() {
    return 'Some nice description of the command';
  }

  /**
   * You are able to add command arguments for parsing here.
   * https://nodejs.org/api/util.html#utilparseargsconfig
   */
  static get commandArguments() {
    return {
      id: {
        type: 'string' as const,
        description: 'User ID to find the user',
      },
      email: {
        type: 'string' as const,
        description: 'User email to find/create the user',
      },
      password: {
        type: 'string' as const,
        description: 'New password for the user',
      },
      roles: {
        type: 'string' as const,
        description:
          'User roles as a comma-separated string (--roles=user,admin,someOtherRoles)',
      },
      update: {
        type: 'boolean' as const,
        default: false,
        description: 'Update the user if they exist',
      },
    };
  }

  static isShouldInitModels = true; // Default value. Can be omitted.

  /**
   * If true, then this command will get model paths with inheritance.
   */
  static isShouldGetModelPaths = true;

  /**
   * Return the name of the connection that you want to use.
   */
  static getMongoConnectionName(commandName, commandArguments) {
    return `CLI: ${commandName} ${JSON.stringify(args)}`;
  }

  async run() {
    const { id, email, password, roles, update } = this.args;

    return new Promise((resolve, reject) => {})
  }
}

export default CommandName;

```

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

### OpenAPI Documentation

The framework can generate documentation in the OpenAPI (Swagger) format. That is a pretty standard format for exchanging documentation. The framework only generates a JSON file and does not provide any viewer like the online version at [https://petstore.swagger.io/](https://petstore.swagger.io/) or a self-hosted version.

:::tip

It is a good idea to set up documentation on the CI level for the stage environment and put the JSON file in the public directory. Then you can use online viewers to check the documentation.
:::

#### Run OpenAPI

```js
node src/cli.ts getopenapijson --output={PATH}
```

The output is optional.

Usage example:

```js
node src/cli.ts getopenapijson --output='src/public/openApi.json'
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

A special command to generate types for TypeScript.

#### Run Generate TypeScript Types

```js
node src/cli.ts generateTypes
```

or

```js
npm run cli generateTypes
```
