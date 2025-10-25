// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

import { themes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
	title: "Adaptivestone Framework",
	tagline:
		"Collection of usefull good stuff that works as a whole. MIT licensed",
	url: "https://framework.adaptivestone.com",
	baseUrl: "/",
	onBrokenLinks: "throw",
	markdown: {
		hooks: {
			onBrokenMarkdownLinks: "warn",
		},
	},
	favicon: "img/favicon.png",
	organizationName: "adaptivestone", // Usually your GitHub org/user name.
	projectName: "framework", // Usually your repo name.

	presets: [
		[
			"@docusaurus/preset-classic",
			/** @type {import('@docusaurus/preset-classic').Options} */
			({
				docs: {
					sidebarPath: "./sidebars.js",
					editUrl: "https://github.com/adaptivestone/framework-documenation",
				},

				theme: {
					customCss: "./src/css/custom.css",
				},
			}),
		],
	],

	themeConfig:
		/** @type {import('@docusaurus/preset-classic').ThemeConfig} */
		({
			navbar: {
				title: "Adaptivestone framework",
				logo: {
					alt: "Adaptivestone Logo",
					src: "img/logo.svg",
				},
				items: [
					{
						type: "doc",
						docId: "intro",
						position: "left",
						label: "Docs",
					},
					{
						href: "https://github.com/adaptivestone/framework-documenation",
						label: "GitHub (docs)",
						position: "right",
					},
					{
						href: "https://github.com/adaptivestone/framework",
						label: "GitHub (framework)",
						position: "right",
					},
				],
			},
			footer: {
				style: "dark",
				links: [
					{
						title: "Docs",
						items: [
							{
								label: "Docs",
								to: "/docs/intro",
							},
						],
					},
					{
						title: "Contact us",
						items: [
							{
								label: "Email",
								href: "mailto:info@adaptivestone.com?subject=Framework site question",
							},
						],
					},
					{
						title: "More",
						items: [
							{
								href: "https://github.com/adaptivestone/framework-documenation",
								label: "GitHub (docs)",
							},
							{
								href: "https://github.com/adaptivestone/framework",
								label: "GitHub (framework)",
							},
						],
					},
				],
				copyright: `Copyright © ${new Date().getFullYear()} Adaptivestone. Built with Docusaurus.`,
			},
			prism: {
				theme: themes.github,
				darkTheme: themes.dracula,
			},
			algolia: {
				// The application ID provided by Algolia
				appId: "02GVEKZGO7",

				// Public API key: it is safe to commit it
				apiKey: "a8b923f9e517d9aa9642cb925e7d8178",

				indexName: "framework-adaptivestone",

				// Optional: see doc section below
				contextualSearch: true,

				// Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
				// externalUrlRegex: "external\\.com|domain\\.com",

				// Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
				// replaceSearchResultPathname: {
				//   from: "/docs/", // or as RegExp: /\/docs\//
				//   to: "/",
				// },

				// Optional: Algolia search parameters
				// searchParameters: {},

				// Optional: path for search page that enabled by default (`false` to disable it)
				searchPagePath: "search",

				//... other Algolia params
			},
		}),
};

export default config;
