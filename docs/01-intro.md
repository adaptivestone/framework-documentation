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
- Integrated ESLint and Prettier for code style
- Cache system
- Ability to overwrite any controller, model, and config that came with the framework
- Multi-language support out of the box
- ESM and CommonJS compatibility
- TypeScript support (you are able to write everything in JavaScript, but in JS you will have types as a bonus)

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
├─ views/ // The framework is able to respond with a view (not only API). View files are stored here.
├─ Cli.ts // Main CLI class
├─ cliCommands.ts // CLI implementation
├─ cluster.ts  // Entry point for production for the cluster module
├─ folderConfig.ts // Folder configuration
├─ server.ts // Main entry point to the framework
```

## Framework Structure

![Framework](/img/AdaptiveStroneFramework.jpg)

## Getting Started

Get started by **creating a new project**.

The simplest way to create a new project is to clone the **template** and customize it:

```shell
git clone git@gitlab.com:adaptivestone/example-project.git adaptivestone-example-rename-me
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
