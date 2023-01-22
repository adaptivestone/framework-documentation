# Sending emails

Email subsystem based on  [nodemailer](https://github.com/nodemailer/nodemailer). In additional we are using [juice](https://www.npmjs.com/package/juice) to inline css and [html-to-text](https://www.npmjs.com/package/html-to-text) to generate text from html of files

:::note

Sadly email clients are outdated and do not support a lot of web features. Some clients even do not support “style” tags. That why all styles should be  inlined

:::

## Templates

We support two types of templates - html files (not templates) or pug templates. It’s easy to add your own template language too.

For each email you should provide: html version of email, text version (optional) and subject. This should be provided as separate files inside the template directory. 

If text version of email not provided that it be generated from html version be removing all html tags with help with [html-to-text](https://www.npmjs.com/package/html-to-text) package 

Template directory located on on src/services/messaging/email/templates/{templateName}

Example of folder

```js
html.pug; // html markup of email
subject.pug; // subject to generate
text.pug; // text version of email
```

### Template variables

Each template have that variables:
- locale - current locale of request 
- t - translate function from i18n. Can by dummy function in i18n not provided
- globalVariablesToTemplates - from config. 
- User provided variables (see API section)


## API

```js
const Mailer = require("@adaptivestone/framework/services/messaging").email;

const mail = new Mailer(
  this.app,
  "recovery", // template name
  {
    // variables for template. This is a user provided variables. IT will be merged to default variables 
    oneTempalteVariable: "1",
    anotherTemplateVariable: "2",
  },
  req.i18n
);
const result = await mail.send("some@email.com");
```

For advance usage (own templates,mail headers, attachments) another low level method exists 
```js
const Mailer = require("@adaptivestone/framework/services/messaging").email;

const result = await Mailer.sendRaw(
     this.app, //framework app
    'to@email.com', //To
    'email subject', //topic
    '<html><body><h1>Email html body</h1></body></html>', //HTML body of email
    'Email text body', //OPTIONAL. If not provided will be generated from html string
    'from@email.com', //OPTIONAL. From email If not provided will be grabbed from config
     {}, //OPTIONAL. Any additioanl options to nodemailer  https://nodemailer.com/message/

```


## Configuration

Please look at the ‘config/mail.js’ file for all configuration options.

### Environment variables

Here most the impornat environment variables

```js
EMAIL_HOST; // smtp.mailtrap.io by default
EMAIL_PORT; // 2525 by default
EMAIL_USER;
EMAIL_PASSWORD;
EMAIL_TRANSPORT; // smtp by default
```
