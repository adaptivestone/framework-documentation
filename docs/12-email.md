# Sending emails

:::warning

As from framework version 5.0 we moved email module to separated package [@adaptivestone/framework-module-email](https://www.npmjs.com/package/@adaptivestone/framework-module-email)

:::

Email subsystem based on [nodemailer](https://github.com/nodemailer/nodemailer). In additional we are using [juice](https://www.npmjs.com/package/juice) to inline css and [html-to-text](https://www.npmjs.com/package/html-to-text) to generate text from html of files

:::note

Sadly email clients are outdated and do not support a lot of web features. Some clients even do not support “style” tags. That why all styles should be inlined

:::

## Instalation

```bash
npm i @adaptivestone/framework-module-email
```

## Templates

We support two types of templates - html files (not templates) or pug templates. It’s easy to add your own template language too.

For each email you should provide: html version of email, text version (optional) and subject. This should be provided as separate files inside the template directory.

If text version of email not provided that it be generated from html version be removing all html tags with help with [html-to-text](https://www.npmjs.com/package/html-to-text) package

Template directory located on on src/services/messaging/email/templates/\{templateName\} on you project. You can change it in config.

Example of folder

```js
html.pug; // html markup of email
subject.pug; // subject to generate
text.pug; // text version of email
style.css; // styles to inlide inside html
```

### Inline images

By default framework email module not inline images and keep link as it.
But if you want to inline some images you can use "data-inline" attribute in "img" tag

```html
<img src="/cats.jpg" data-inline />
```

Image path relative to your project "src/services/messaging/email/resources" folder

:::note
Best practice - put you images in CDN
:::

### Template variables

Each template have that variables:

- locale - current locale of request
- t - translate function from i18n. Can by dummy function in i18n not provided
- globalVariablesToTemplates - from config.
- User provided variables (see API section)

## API

### Init mailer

```js
import Mailer from "@adaptivestone/framework-module-email";

const mail = new Mailer(
  this.app,
  "recovery", // template name
  {
    // variables for template. This is a user provided variables. IT will be merged to default variables
    oneTempalteVariable: "1",
    anotherTemplateVariable: "2",
  },
  req.appInfo.i18n
);
```

Inside template oneTempalteVariable and anotherTemplateVariable will be availalble as a top level variable

```pug
p #{oneTempalteVariable} #{anotherTemplateVariable}
```

### Send email

```js
const result = await mail.send(
  "some@email.com", //To
  "optional@from.com", //OPTIONAL. From email If not provided will be grabbed from config
  {} //OPTIONAL. Any additioanl options to nodemailer  https://nodemailer.com/message/
);
```

### Send raw

For advance usage (own templates,mail headers, attachments) another low level method exists

```js
import Mailer from "@adaptivestone/framework-module-email";

const result = await Mailer.sendRaw(
  this.app, //framework app
  "to@email.com", //To
  "email subject", //topic
  "<html><body><h1>Email html body</h1></body></html>", //HTML body of email
  "Email text body", //OPTIONAL. If not provided will be generated from html string
  "from@email.com", //OPTIONAL. From email If not provided will be grabbed from config
  {} //OPTIONAL. Any additioanl options to nodemailer  https://nodemailer.com/message/
);
```

### Render template

In some cases you may want to rendern templates to string for future usage. For example send email via gmail Oauth2 authorisation on user behalf

```js
const { subject, text, inlinedHTML, htmlRaw } = await mail.renderTemplate();
```

## Configuration

Please look at the ‘config/mail.ts’ file for all configuration options.

### Environment variables

Here most the impornat environment variables

```js
EMAIL_HOST; // smtp.mailtrap.io by default
EMAIL_PORT; // 2525 by default
EMAIL_USER;
EMAIL_PASSWORD;
EMAIL_TRANSPORT; // smtp by default
```
