# Configs

Every modern application runs on multiple environments and should have the ability to configure itself without changing the code.

## Config Files

Config files are located in ‘src/config/\{filename\}.(js|ts)’. Each config file is mostly unique, and you should refer to the module documentation (or the framework config section).

:::note

Config files are part of the [framework inheritance process](03-files-inheritance.md).

:::

## Environment Variables

Out of the box, the framework supports environment variables with [process.loadEnvFile](https://nodejs.org/api/process.html#processloadenvfilepath). This is part of Node.js since v20.12.0.

The framework will grab and parse the .env file in the root of the project directory to fill environment variables.

The sample project ships with a basic .env.example file.

:::tip

Do not use environment variables in the code. Use them only inside config files. This will allow you to track variables and split configs and the codebase.

:::

:::tip

Do not push the .env file to the version control system, as it can contain passwords and keys. The file should be unique per environment.
:::

:::tip

Try not to overload the .env file with configuration and keep only private data in it. To manage non-private data, check the [NODE_ENV](#node_env) section.
:::

## NODE_ENV

Depending on the NODE_ENV environment variable, the framework will load additional config files. Data from these files will be merged into the main config with an overwrite.

This is useful when you want to have something that depends on the environment but do not want to overload the .env file.

Also, it's a good practice to keep the basic config in files rather than in the .env file.

**Example:**

```js title="/src/config/sample.ts"
export default {
  variable1: 1,
  variable2: 2,
};
```

```js title="/src/config/sample.production.ts"
export default {
  variable2: 3,
  variable3: 4,
};
```

On a NON-production environment:

```js
const sampleConfig = this.app.getConfig("sample");
//     variable1: 1,
//     variable2: 2
```

On a PRODUCTION environment:

```js
const sampleConfig = this.app.getConfig("sample");
//     variable1: 1,
//     variable2: 3, <-- DIFFERENT
//     variable3: 4  <-- NEW
```

You can use the same approach for different environments (dev, stage, testing, etc.).

## API

```ts
getConfig(configName: string): {};
updateConfig(configName: string, config: {}): {};
```

Returns the config based on the config name. It also caches it in memory.

```js
const sampleConfig = this.app.getConfig("sample");
```

Updates the config based on the config name. Returns the updated config.

```js
const sampleConfig = this.app.updateConfig("sample", {
  variableToUpdate: 3,
  anotherVariable: 4,
});
```
