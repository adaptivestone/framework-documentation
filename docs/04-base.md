# Base Class

Each class extends the Base class to have some basic functions, mostly related to logging and the inheritance process.

The Base class implements on-demand logging instance loading. That means the logger will be united only when you first request it. This is an important part of loading speed optimization.

## API

```js
class A extends Base {
  async someFunction() {
    // Access to the logger instance (please follow the logger documentation for more details).
    this.logger;

    // Get files with inheritance.
    const files = await this.getFilesPathWithInheritance(
      `${__dirname}/../../migrations`,
      this.app.foldersConfig.migrations
    );
  }

  /**
   * Returns the logger group. Just to have all logs grouped logically.
   */
  static get loggerGroup() {
    return "Base_please_overwrite_";
  }

  /**
   * In case of logging, sometimes we might need to replace the name.
   */
  getConstructorName() {
    return this.constructor.name;
  }
}
```

```js
getFilesPathWithInheritance(internalFolder, externalFolder);
```

Will scan two folders and provide a path with inheritance. If the same file is present in both paths, the priority will be given to the external file.
