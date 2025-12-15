# Adaptivestone

This is the main documentation of Adaptivestone framework. 
Hosted on [https://framework.adaptivestone.com/](https://framework.adaptivestone.com/)

# Website

This website is built using [Docusaurus 3](https://docusaurus.io/), a modern static website generator.

### Installation

```
$ npm i 
```

### Local Development

```
$ nmp run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Generate LLM Context

```
$ npm run generate-llm-context
```

This command generates a single `llm-context.md` file in the `static/` folder containing all documentation merged together, optimized for use with AI assistants (ChatGPT, Claude, etc.).

**Features:**
- Concatenates all markdown files from the `docs/` directory
- Maintains proper document order (sorted by filename)
- Includes table of contents
- Adds metadata (generation time, file count, statistics)
- ~16,000 tokens - fits comfortably in most LLM context windows
- **Accessible from website navbar** (after build/deploy)

**Use cases:**
- Provide complete documentation context to AI assistants
- Training or fine-tuning language models
- Quick reference for AI-powered development tools
- Documentation analysis and processing

The generated file is automatically excluded from git (added to `.gitignore`). It's also automatically generated before each build and deployment, and is accessible from the website's navigation menu.
