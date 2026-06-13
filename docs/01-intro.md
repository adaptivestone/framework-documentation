# Intro

Welcome to the AdaptiveStone framework documentation. We hope that the documentation is clean and short. Please feel free to edit it via a Git merge request and contact us.

## History

You must be wondering - why another framework, as we currently have a lot of them? But each of them is different.

The Adaptive Stone framework was born around 2016 and has been growing since.

There were a few requirements that no one existing framework could provide us for SAAS at that time - working with multiple databases, scaling out of the box, and a modern approach.

That is why the Adaptive Stone framework was born.

## Features

- Automatically initialized controllers (no config needed)
- Mongoose models
- Winston logger (Sentry logger as a part of Winston logger)
- Node cluster enabled by default (possibility to use with no cluster (dev mode))
- Docker development environment (and production too)
- Integrated Biome (moder alternative to ESLint and Prettier) for code style
- Cache system
- Ability to overwrite any controller, model, and config that came with the framework
- Multi-language support out of the box
- ESM only (no CommonJS)
- TypeScript support (you are able to write everything in JavaScript, but in JS you will have types as a bonus)

:::info Requirements
The framework requires **MongoDB** and an **`AUTH_SALT`** secret — it fails fast at boot if either is missing (set the `MONGO_DSN` env var; generate a salt with `npm run cli generateRandomBytes`). The runtime requires **Node ≥ 24**.
:::

## Folder Structure

```js
framework/
├─ commands/  // Contains the command folder (CLI)
├─ config/ // Contains config files
├─ controllers/ // Contains controller files
│  ├─ {controller_group_folder}/ // Can contain a folder (will be added to the route)
├─ locales/ // i18n folder with translations
│  ├─ {locale_1}/ // Locale name (en, fr, etc.)
│  │  ├─ translation.json // Translation JSON file
│  ├─ {locale_2}/
│  │  ├─ translation.json
├─ migrations/ // Folder where migration files are stored
├─ models/ // Contains model files
├─ modules/ // Main folder with abstract stuff
├─ public/ // Public stuff (served statically)
├─ services/ // Some services (email, http, etc.)
├─ tests/ // Folder contains basic tests
├─ Cli.ts // Main CLI class
├─ index.ts // Main entry point (creates and starts the Server)
├─ cluster.ts  // Entry point for production (cluster module)
├─ folderConfig.ts // Folder configuration
├─ server.ts // Server class
```

## Framework Structure

![Framework](/img/AdaptiveStroneFramework.jpg)

## Getting Started

Get started by **creating a new project**.

The simplest way to create a new project is to clone the **template** and customize it:

```shell
git clone git@github.com:adaptivestone/framework-example-project.git adaptivestone-example-rename-me
```

## Start Your Project

You should have **[Docker](https://www.docker.com/products/docker-desktop)** and **[Docker Compose](https://docs.docker.com/compose/install/)** installed.

Run the development server:

```shell
cd adaptivestone-example-rename-me
docker compose up
```

Your site starts at `http://localhost:3300`.

Open `src/controllers/Person.ts` and edit some lines: the site **reloads automatically** and applies your changes.

## TypeScript Support

The framework itself is written in TypeScript (erasable syntax), but the project is flexible to use either TypeScript or JavaScript.

You are able to use the modern Node.js runtime to run TypeScript files without any compilation.

You are also able to mix TypeScript and JavaScript files in one project. Just remember that types will only work if the imported file is a TypeScript file and it is imported into a TypeScript file.

## Guides

- [Recipes](15-recipes.md) — a task-oriented cookbook: add a controller, validate a body, paginate, write middleware, override a built-in, test a controller.
- [Anti-patterns](16-anti-patterns.md) — common mistakes and what to do instead.
