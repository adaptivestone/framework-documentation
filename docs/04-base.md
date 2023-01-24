# Base class

Each class extend Base class to have some basic functions mostly related to logging and inheritance process 

Base class implements on demand logging instance loading. That means the logger will be united only when you first request it. This important part on loading speed optimization

## API


```js
class A extends Base{

  async someFunction(){
    // Access to loger instance (plese follow logger documentation for more details )
    this.logger 

    // get files with inheritance
    const files = await this.getFilesPathWithInheritance(
      `${__dirname}/../../migrations`,
      this.app.foldersConfig.migrations,
    );
  }

  /**
   * Return logger group. Just to have all logs groupped logically
   */
  static get loggerGroup() {
    return 'Base_please_overwrite_';
  }

  /**
   * In case of logging sometimes we might need to replace name
   */
  getConstructorName() {
    return this.constructor.name;
  }
}
```

