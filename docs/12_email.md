# Sending emails

Email subsystem based on [email-templates](https://github.com/forwardemail/email-templates) for template generation and [nodemailer](https://github.com/nodemailer/nodemailer) to send emails

## Templates

Put files on src/services/messaging/email/templates/{templateName}

Each template have

```js
html.pug; // html markup of email
style.css; // email styles
subject.pug; // subject to generate
text.pug; // text version of email
```

You can use any template that supported by [email-templates](https://github.com/forwardemail/email-templates)

## API

```js
const Mailer = require("@adaptivestone/framework/services/messaging").email;

const mail = new Mailer(
  this.app,
  "recovery", // template name
  {
    // variables for template
    oneTempalteVariable: "1",
    anotherTemplateVariable: "2",
  },
  req.i18n
);
const result = await mail.send("some@email.com");
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
