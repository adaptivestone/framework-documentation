# CLI

CLI (command line interface) part of framework system that allow you to use all power of framework on command line - manipulate with data, import, export, etc

Framework scans directory for list of common ds and provide you ability to see what's command available to run

:::note

CLI commands part of [framework inheritance process ](03-files-inheritance.md).

:::

## Run command

You are able to create a group of commands by putting files in the directory. You can see ‘migration’ as an example of grouping commands

```bash
# on project level
node src/cli {command}
```

Commands path work the same way as on controllers. Any file will be parsed as commands, folders will group commands together.
But unlike of controllers level you not able to change that behaviour

You are able to create a group of commands by putting files in the directory. You can see ‘migration’ as an example of grouping commands

```js
commands / migration / create.js; // migration/create command ,
commands / migration / migrate.js; //migration/migrate command
```

## API

You able to run command from any place of framework

```js
this.app.runCliCommand(commandName: string, args: {}): Promise;
```

Where
commandName - name of command that you want to start
args - athyments that you want to pass to command

## Creating own command

All passed arguments on command line parsed with help with [minimist](https://github.com/substack/minimist) library

```js
import AbstractCommand from "../modules/AbstractCommand.js";

class CommandName extends AbstractCommand {
  async run() {
    this.args; // passed arguments
  }
  static get description() {
    // text decrtiption of what command do
    return "Command description";
  }
}

export default CommandName;
```

## Framework commands

Framework came with few build in commands

### Migration

Migration commands allow you to create migration of some data to another, or fill database with some data

Key point here - migration executed only one per file

:::tip

You can use migration with different cases, not only to modify data on database

:::

#### Creating migration

Migration command came with a template to generate migration.

```js
node src/cli migration/create  --name={someName}
```

After creating migration please edit it and implement any logic that you want here

#### Apply migration

```js
node src/cli migration/migrate
```

Migration executed on created order. It executed only once per life

### DropIndex

Sometimes very useful to drop indexes on already created models. For example you create a unique index for non required fields and miss that no value also should be unique per collection.

Framework will take care of creating indexes based on your model on next start, so you can drop index and can make sure that it will be recreated after

#### Run dropindex

```js
node src/cli dropindex --model={modelName}
```

### SyncIndexes

Synchronize indexes defined in models with a real one indexed on the database. Command will remove all indexes from the database that do not exist on model OR have different parameters. Then it will create a new indexes

:::warning

This can be a dangerous command in case you have some unique indexes feature

:::

#### Run SyncIndexes

```js
node src/cli SyncIndexes
```

### OpenApi documentation

Framework can generate documentation in OpenApi (swagger) format. That pretty standard format to exchange documentation. Framework only generates JSON file and not provide any viewer like online version [https://petstore.swagger.io/](https://petstore.swagger.io/) or provide self hosted version

:::tip

Thats a good idea to set up documentation on CI level for stage env and put the json file to the public directory. Then you can use online viewers to check documentation
:::

#### Run OpenApi

```js
node src/cli getopenapijson --output={PATH}
```

Output is an optional.

Usage example:

```js
node src/cli getopenapijson --output='src/public/openApi.json'
```

### CreateUser

Create user command creates a new user

#### Run CreateUser

```js
node src/cli createuser --email=somemail@gmail.com  --password=somePassword --roles=user,admin,someOtherRoles
```

Only email and password are required

You able to update user as well. You need to specify email or user id to find the user and '--update' flag to allow user updates.
