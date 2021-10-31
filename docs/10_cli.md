# CLI

CLI (command line interface) part of framework system that allow you to use all power of framework on command line - manipulate with data, import, export, etc

Framework scans directory for list of common ds and provide you ability to see what's command available to run

:::note

CLI commands part of [framework inheritance process ](03_files-inheritance.md).

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
const AbstractCommand = require("../modules/AbstractCommand");

class CommandName extends AbstractCommand {
  async run() {
    this.args; // passed arguments
  }
  static get description() {
    // text decrtiption of what command do
    return "Command description";
  }
}

module.exports = CommandName;
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
node scr/cli migration/create  --name={someName}
```

After creating migration please edit it and implement any logic that you want here

#### Apply migration

```js
node scr/cli migration/migrate
```

Migration executed on created order. It executed only once per life

### DropIndex

Sometimes very useful to drop indexes on already created models. For example you create a unique index for non required fields and miss that no value also should be unique per collection.

Framework will take care of creating indexes based on your model on next start, so you can drop index and can make sure that it will be recreated after

#### Run dropindex

```js
node scr/cli dropindex --model={modelName}
```