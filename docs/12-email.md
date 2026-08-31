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

:::info Required version since 5.4

Framework 5.4 declares `@adaptivestone/framework-module-email` `^2.1.0` as an **optional** peer dependency. Optional because an app that never sends the built-in account mails needs no mailer at all; `^2.1.0` because the templates the framework ships are now [template modules](#templates-the-framework-ships), which only the module's 2.1 engines can render.

On an older module those two mails fail with `Template type js is not supported` instead of being sent — the same failure the previous `.pug` defaults already produced on module v2, which dropped the bundled Pug. So nothing that works today regresses; but if you send password recovery or email verification, install 2.1 or newer.

:::

## Templates

A template is a folder of files; each file's extension selects the engine that renders it. For each email you provide an HTML version, a subject, and (optionally) a text version, as separate files inside the template directory.

If the text version of the email is not provided, it will be generated from the HTML version by removing all HTML tags with the help of the [html-to-text](https://www.npmjs.com/package/html-to-text) package.

Your templates live in the folder `folders.emails` points at in `src/folderConfig.ts` — `src/services/messaging/email/templates/{templateName}` in the project template. That folder is searched first, so a folder named after a template the framework ships replaces it (see [Overriding a shipped template](#overriding-a-shipped-template)).

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

To use a real template language such as Pug, register its engine first (see [Bring your own engine](#bring-your-own-engine)); then your files can be `html.pug`, `subject.pug`, and so on.

## Templates the framework ships

The framework ships two templates and sends them itself — `recovery` (from `user.sendPasswordRecoveryEmail()`) and `verification` (from `user.sendVerificationEmail()`).

:::info Changed in 5.4

Both used to be `.pug` files, so an app that sent them had to install Pug and register its engine. They are now [module templates](#module-templates) — TypeScript in the framework source, published to `dist` as compiled `.js` — rendered by the module's built-in module engine. **Nothing to install and nothing to register**, as long as the mailer module is [2.1 or newer](#installation).

:::

They are English out of the box and translatable key by key: every string is emitted as `t(key, { defaultValue })`, so a key defined in your locale files wins and a missing one reads as English rather than as a bare key. Overriding the text is a locale-file edit, not a template rewrite:

| Template | Key | Default (English) |
| --- | --- | --- |
| `recovery` | `email.passwordRecovery` | `Recovery password` |
| `recovery` | `email.passwordChanged` | `Password changed` |
| `recovery` | `email.greeting` | `Dear user` |
| `verification` | `email.emailConfirm` | `Email confirmation` |
| `verification` | `email.verify` | `Verify email` |
| `verification` | `email.verifyInstructions` | `To verify your email address, follow the link:` |
| `verification` | `email.greeting` | `Dear user` |

The same keys are listed with the rest of the framework's messages in [i18n › Auth controller, validation and email keys](./08-i18n.md#auth-controller-validation-and-email-keys).

:::info Fixed in 5.4

The verification mail used to be hardcoded Russian with no `t()` call in it at all — every user received Russian whatever their locale — and its greeting interpolated a variable the auth flow never passes, so it rendered empty for everyone. It now mirrors `recovery`: English defaults, every string translatable.

:::

Two more details of the shipped HTML, worth copying if you write your own:

- The `<html lang="…">` attribute is rendered from the request locale (`en` when none was detected), so a Russian mail no longer announces itself as English to screen readers and mail clients.
- Every interpolated value is HTML-escaped. A module template builds markup as a plain string, so the escaping a template language did implicitly has to be explicit.

## Overriding a shipped template

Put a folder with the same name (`recovery`, `verification`) in your own emails folder — it is found first and used instead of the framework's. The framework never merges the two: your folder must contain the whole template (`html` and `subject` at minimum; `text` and `style.css` are optional).

A module template is the natural format — `.ts` if you run TypeScript natively, `.js` after your build step, both rendered by the built-in engine with nothing to register. Pug, EJS or anything else still works here; [register the engine](#bring-your-own-engine) first.

```ts title="src/services/messaging/email/templates/verification/html.ts"
// The data the framework's auth flow passes to these two templates.
type TVerificationTemplateData = {
  /** Language the mail is rendered for — the request locale, `en` by default. */
  locale: string;
  /** Translator from the request i18n. Always pass the English text as `defaultValue`. */
  t: (key: string, options?: { defaultValue?: string }) => string;
  /** Link the auth flow asks the user to follow. */
  link: string;
  /** Nickname of the user the mail is about, when they set one. */
  editor?: string | null;
};

const escape = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export default ({ t, link, locale }: TVerificationTemplateData) => `<!DOCTYPE html>
<html lang="${escape(locale || "en")}">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body>
    <h1>${escape(t("email.verify", { defaultValue: "Verify email" }))}</h1>
    <p>
      ${escape(
        t("email.verifyInstructions", {
          defaultValue: "To verify your email address, follow the link:",
        }),
      )}
      <a href="${escape(link)}">${escape(link)}</a>
    </p>
  </body>
</html>
`;
```

`subject` and `text` are the same contract, returning plain strings.

:::note

The framework types this data internally as `TEmailTemplateData`, but the type is not on the package's `exports` map yet — declare the shape inline as above rather than importing it out of `dist`. Anything your app adds through `globalVariablesToTemplates` or the `Mailer` constructor arrives on the same object, so widen the type with your own fields when you use them.

:::

## Template engines

:::warning Breaking change in v2

Before v2, Pug was bundled and `.pug` templates worked out of the box. As of **v2 the module ships no template-engine dependency** — only the built-in engines listed above. To keep using `.pug` (or any other language) you must install that engine and register it yourself.

This is about **your** templates only: since framework 5.4 the [templates the framework ships](#templates-the-framework-ships) are module templates, so they need no engine registration.

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
- The framework's own `recovery` and `verification` templates are written this way — a working reference if you need one.
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

```ts
// html.ts
export default (data) => `<p>${data.oneTemplateVariable} ${data.anotherTemplateVariable}</p>`;
```

or, if you registered a Pug engine:

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
```
