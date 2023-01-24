# Intro

Welcome to AdaptiveStone framework documentation. We hope that documentation is clean and short. Please feel free to edit it via git merge request and contact us  

## History 

You must be wondering - why another framework as currently we have a lot of them. But each of them is different. 

Adaptive stone framework born near 2016 and growing since. 

There are few requirements that no one exiting framework cannot provide us for SAAS at that time - working with multiple databases, scale from out of the box, modern approach. 

That why Adaptive Stone framework was born


## Features 

* Automatic united controllers (no config needed)
* Mongoose ES6 models
* Winston logger (sentry logger as a part of winston logger)
* Node cluster enabled by default (possibility to use with no cluster (dev mode))
* Docker development environment (and production too)
* Integrated eslint and prettier for code style
* Cache system 
* Ability to overwrite any controller, model and config that came with framework 
* Multi Language support out of the box


## Folder structure

```js
frawework/ 
├─ commands/  //contains command folder (CLI)
├─ config/ //constains config files
├─ controllers/ //contains controller files
│  ├─ {controller_group_folder}/ //can contain folder (will be added to route)
├─ locales/ // i18n folder with translations
│  ├─ {locale_1}/ // locale name (en,fr, etc)
│  │  ├─ translation.json // translation json file 
│  ├─ {locale_2}/
│  │  ├─ translation.json
├─ migrations/ // folder where migration files stored
├─ models/ // contains model files 
├─ modules/ // main folder with abstract stuff
├─ public/ // public stuff (server statically)
├─ services/ // some services (email, http, etc)
├─ tests/ // folder contains basic tests integration with jest
├─ views/ // frawemork able to respond with view (not only API). Here view files stored
├─ Cli.js // main CLI class
├─ cliCommands.js // CLI implementation 
├─ cluster.js  // entry point for production for the cluster module  
├─ folderConfig.js // folder configuration
├─ server.js // main entry point to framework
```
## Framework strusture 

![Framework](/img/AdaptiveStroneFramework.jpg)

## Getting Started

Get started by **creating a new project**.

Sempliest way to create a new project - clone **template** and customize it :

```shell
git clone git@gitlab.com:adaptivestone/example-project.git adaptivestone-example-rename-me
```

## Start your project

You should have **[docker](https://www.docker.com/products/docker-desktop)** and **[docker-compose](https://docs.docker.com/compose/install/)** installed 

Run the development server:

```shell
cd adaptivestone-example-rename-me
docker-compose up
```

Your site starts at `http://localhost:3300`.

Open `src/controllers/Person.js` and edit some lines: the site **reloads automatically** and apply your changes.


## API 

TODO 
getFilesPathWithInheritance
Ability to pass additional parameter to server that will be executed before adding page 404

