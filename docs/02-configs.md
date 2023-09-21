# Configs

Every modern application runs on multiple environments and should have the ability to configure itself without changing code. 


## Config files

Config files located on ‘src/config/{filename}.js’. Each config file mostly unique and you should refer to module documentation (or framework config section)

:::note

Config files part of  [framework inheritance process ](03-files-inheritance.md).

:::


## Environment variables 


The out of the box framework supports environment variables with the [dotenv](https://github.com/motdotla/dotenv) package.

Framework will grab and parse .env file on the root of the project directory to fill environment variables 

Sample project ships with basic .env.example file 


:::tip

Do not use environment variables in code. Use it only inside config files. That allow you to track variables and split configs and codebase 

:::

:::tip

Do not push the .env file to the version control system as it can contain passwords and keys. File should be queue per environment 
:::

:::tip

Try to not overload the .env file with configuration and keep only private data on it. To manage non private data check [NODE_ENV](#node_env) section
:::



## NODE_ENV

Depending on the NODE_ENV environment variable framework will load additional config files. Data from this files will be merged into main config with overwrite 

This useful when you want to have something that depends on environment but do not want to overload .env file 

Also it's a good practice to keep basic config on files rather then .env file.

**Example:**

```js title="/src/config/sample.js"
export default {
    variable1: 1,
    variable2: 2
}
```

```js title="/src/config/sample.production.js"
export default {
    variable2: 3,
    variable3: 4
}
```

On NON production environment 

```js 
    const sampleConfig = this.app.getConfig('sample');
    //     variable1: 1,
    //     variable2: 2
```

On PRODUCTION environment
```js 
    const sampleConfig = this.app.getConfig('sample');
    //     variable1: 1,
    //     variable2: 3, <-- DIFFERENT
    //     variable3: 4  <-- NEW
```

You can use same approach for different environments (dev,stage, testing, etc)

## API

```js
getConfig(configName: string): {};
updateConfig(configName: string, config: {}): {};
```

Return config based on the config name. Also cached it on memory
```js 
    const sampleConfig = this.app.getConfig('sample');
```

Update config based on config name. Return updated config

```js 
    const sampleConfig = this.app.updateConfig('sample',{variableToUpdate:3, anotherVariable:4});
```
