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

A template is a folder of files; each file's extension selects the engine that renders it. For each email you provide an HTML version, a subject, and (optionally) a text version, as separate files inside the template directory.

If the text version of the email is not provided, it will be generated from the HTML version by removing all HTML tags with the help of the [html-to-text](https://www.npmjs.com/package/html-to-text) package.

The template directory is located at `src/services/messaging/email/templates/{templateName}` in your project. You can change it in the config.

The module has no template-engine dependency of its own. Out of the box it renders two kinds of file:

| Extensions | Engine |
| --- | --- |
| `html`, `text`, `css` | plain files, read as-is |
| `js`, `ts`, `mjs`, `cjs` | [module templates](#module-templates) — the file is imported and its default export is called with the render data |

A plain template folder looks like this:

```js
html.html; // HTML markup of the email
subject.text; // Subject to generate
text.text; // Text version of the email (optional)
style.css; // Styles to inline inside the HTML
```

and the same template written as modules like this:

```js
html.ts; // export default (data) => "<h1>...</h1>"
subject.ts;
text.ts; // optional
style.css; // Styles to inline inside the HTML
```

Each file is resolved on its own, so mixing extensions inside one folder is fine.

To use a real template language such as Pug, register its engine first (see [Bring your own engine](#bring-your-own-engine)); then your files can be `html.pug`, `subject.pug`, and so on. The templates the framework itself ships (`recovery`, `verification`) are Pug, so an app that sends those emails still needs the Pug engine registered.

## Template engines

:::warning Breaking change in v2

Before v2, Pug was bundled and `.pug` templates worked out of the box. As of **v2 the module ships no template-engine dependency** — only the built-in engines listed above. To keep using `.pug` (or any other language) you must install that engine and register it yourself.

:::

### Module templates

:::info New in framework-module-email 2.1

`js`, `ts`, `mjs` and `cjs` templates are rendered by a built-in engine — nothing to install and nothing to register.

:::

A module template is an ordinary module whose default export turns the render data into the rendered string:

```ts
// src/services/messaging/email/templates/welcome/html.ts

type TWelcomeData = {
  t: (key: string, options?: { defaultValue?: string }) => string;
  locale: string;
  userName: string;
};

export default ({ t, userName }: TWelcomeData) => `
  <h1>${t("email.welcome.title", { defaultValue: "Welcome!" })}</h1>
  <p>${t("email.welcome.greeting", { defaultValue: "Hi" })} ${userName}!</p>
`;
```

- The default export may be sync or async: `(data) => string | Promise<string>`. A missing or non-function default export fails with an error naming that file.
- It receives the same data every engine gets — `locale`, `t`, `globalVariablesToTemplates` and your own template variables (see [Template Variables](#template-variables)).
- `html`, `subject` and `text` can each be a module. `style` is rendered without the template data, so keep it a plain `.css` file.
- `js`, `ts`, `mjs` and `cjs` share one engine — ship whichever extension your app runs (`.ts` when you run TypeScript natively, `.js` after a build step).
- Template modules are imported once per process and cached by `import()`, so a template edited on disk needs a restart to be picked up.
- The module exports a `TTemplateModule` type (`import type { TTemplateModule } from "@adaptivestone/framework-module-email/dist/types.d.ts"`) describing the contract if you prefer to annotate the export.

### Bring your own engine

For a real templating language, install it in your app and register an engine by mapping a file extension to a render function. The function receives the absolute path to the template file and the render data, and returns the rendered string (sync or async):

```js
import pug from "pug";
import ejs from "ejs";
import Mailer from "@adaptivestone/framework-module-email";

// Pug — was bundled by default before v2; now opt-in
Mailer.registerTemplateEngine("pug", (fullPath, data) =>
  pug.compileFile(fullPath)(data),
);

// any engine works the same way
Mailer.registerTemplateEngine("ejs", (fullPath, data) =>
  ejs.renderFile(fullPath, data),
);
```

### Where to register

Engines live in a **single process-wide registry** shared by every `Mailer` instance, so register them **once at process startup, before any email is sent** — not per request and not per `Mailer` instance.

The natural place is the worker bootstrap (`src/server.ts`), the file each worker process runs. Register before `startServer()`:

```js
// src/server.ts
import Server from "@adaptivestone/framework/server.js";
import Mailer from "@adaptivestone/framework-module-email";
import pug from "pug";
import folderConfig from "./folderConfig.ts";

Mailer.registerTemplateEngine("pug", (fullPath, data) =>
  pug.compileFile(fullPath)(data),
);

const server = new Server(folderConfig);
await server.startServer();
```

:::note

The registry is per **process**. If your app uses the cluster manager (`src/index.ts` forking workers), register in `src/server.ts` (which every worker runs), not in the master `src/index.ts` (which never sends mail).

:::

### Registering more than once

`registerTemplateEngine` can be called as many times as you like:

- **Different extensions accumulate** — call it once per engine you want (`pug`, `ejs`, `mjml`, …).
- **The same extension overrides** — the last registration for a given extension wins. The built-ins are ordinary entries with no special casing, so `Mailer.registerTemplateEngine("js", ...)` replaces the module engine with your own contract and `Mailer.unregisterTemplateEngine("js")` removes it, exactly as for a custom engine. There is no error on re-registration.
- Extensions are normalized, so `"pug"`, `".pug"` and `".PUG"` all target the same engine.

### Helpers

- `Mailer.registerTemplateEngine(extension, engine)` — register/override an engine for a file extension (leading dot optional, case-insensitive).
- `Mailer.unregisterTemplateEngine(extension)` — remove an engine; returns `true` if one was removed.
- `Mailer.hasTemplateEngine(extension)` — check whether an engine is registered.

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
- `t` - the translate function from i18n. Call it the i18next way, with an English default: `t("email.welcome.title", { defaultValue: "Welcome!" })`.
- `globalVariablesToTemplates` - from the config.
- User-provided variables (see the API section).

:::info Changed in framework-module-email 2.1

When no i18n object is passed to `new Mailer(...)`, `t` is a fallback translator. It now honours the i18next defaults instead of returning the raw key, so `t("email.welcome.title", { defaultValue: "Welcome!" })` renders `Welcome!` and a template reads correctly with no i18n setup at all. A key that **is** present in the request's i18n still wins. The positional form `t("email.welcome.title", "Welcome!")` is honoured at runtime too, though only the options object is declared in the types. A key with no default still renders as the key.

:::

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

or, in a module template:

```ts
// html.ts
export default (data) => `<p>${data.oneTemplateVariable} ${data.anotherTemplateVariable}</p>`;
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
```
