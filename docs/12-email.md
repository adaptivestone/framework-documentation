# Sending Emails

:::warning

As of framework version 5.0, we have moved the email module to a separate package: [@adaptivestone/framework-module-email](https://www.npmjs.com/package/@adaptivestone/framework-module-email).

:::

The email subsystem is based on [Nodemailer](https://github.com/nodemailer/nodemailer). In addition, we are using [Juice](https://www.npmjs.com/package/juice) to inline CSS and [html-to-text](https://www.npmjs.com/package/html-to-text) to generate text from the HTML of files.

:::note

Sadly, email clients are outdated and do not support a lot of web features. Some clients do not even support “style” tags. That is why all styles should be inlined.

:::

## Installation

```bash
npm i @adaptivestone/framework-module-email
```

## Templates

We support two types of templates: HTML files (not templates) or Pug templates. It’s easy to add your own template language too.

For each email, you should provide an HTML version, a text version (optional), and a subject. These should be provided as separate files inside the template directory.

If the text version of the email is not provided, it will be generated from the HTML version by removing all HTML tags with the help of the [html-to-text](https://www.npmjs.com/package/html-to-text) package.

The template directory is located at `src/services/messaging/email/templates/{templateName}` in your project. You can change it in the config.

Example of a folder:

```js
html.pug; // HTML markup of the email
subject.pug; // Subject to generate
text.pug; // Text version of the email
style.css; // Styles to inline inside the HTML
```

### Inline Images

By default, the framework email module does not inline images and keeps the links as they are.
But if you want to inline some images, you can use the "data-inline" attribute in the "img" tag.

```html
<img src="/cats.jpg" data-inline />
```

The image path is relative to your project's "src/services/messaging/email/resources" folder.

:::note
The best practice is to put your images on a CDN.
:::

### Template Variables

Each template has these variables:

- `locale` - the current locale of the request.
- `t` - the translate function from i18n. Can be a dummy function if i18n is not provided.
- `globalVariablesToTemplates` - from the config.
- User-provided variables (see the API section).

## API

### Init Mailer

```js
import Mailer from "@adaptivestone/framework-module-email";

const mail = new Mailer(
  this.app,
  "recovery", // template name
  {
    // variables for the template. These are user-provided variables. They will be merged with the default variables.
    oneTemplateVariable: "1",
    anotherTemplateVariable: "2",
  },
  req.appInfo.i18n
);
```

Inside the template, `oneTemplateVariable` and `anotherTemplateVariable` will be available as top-level variables.

```pug
p #{oneTemplateVariable} #{anotherTemplateVariable}
```

### Send Email

```js
const result = await mail.send(
  "some@email.com", // To
  "optional@from.com", // OPTIONAL. From email. If not provided, it will be grabbed from the config.
  {} // OPTIONAL. Any additional options for Nodemailer: https://nodemailer.com/message/
);
```

### Send Raw

For advanced usage (your own templates, mail headers, attachments), another low-level method exists.

```js
import Mailer from "@adaptivestone/framework-module-email";

const result = await Mailer.sendRaw(
  this.app, // framework app
  "to@email.com", // To
  "email subject", // topic
  "<html><body><h1>Email html body</h1></body></html>", // HTML body of the email
  "Email text body", // OPTIONAL. If not provided, it will be generated from the HTML string.
  "from@email.com", // OPTIONAL. From email. If not provided, it will be grabbed from the config.
  {} // OPTIONAL. Any additional options for Nodemailer: https://nodemailer.com/message/
);
```

### Render Template

In some cases, you may want to render templates to a string for future usage. For example, to send an email via Gmail OAuth2 authorization on behalf of a user.

```js
const { subject, text, inlinedHTML, htmlRaw } = await mail.renderTemplate();
```

## Configuration

Please look at the ‘config/mail.ts’ file for all configuration options.

### Environment Variables

Here are the most important environment variables:

```js
EMAIL_HOST; // smtp.mailtrap.io by default
EMAIL_PORT; // 2525 by default
EMAIL_USER;
EMAIL_PASSWORD;
EMAIL_TRANSPORT; // smtp by default
