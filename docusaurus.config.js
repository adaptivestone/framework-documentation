// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Adaptivestone Framework",
  tagline: "Collection of usefull good stuff that works as a whole. MIT licensed",
  url: "https://framework.adaptivestone.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.png",
  organizationName: "adaptivestone", // Usually your GitHub org/user name.
  projectName: "framework", // Usually your repo name.

  presets: [
    [
      "@docusaurus/preset-classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://gitlab.com/adaptivestone/framework-documenation/",
        },

        theme: {
          customCss: require.resolve("./src/css/custom.css"),
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
            href: "https://gitlab.com/adaptivestone/framework-documenation",
            label: "GitLab (docs)",
            position: "right",
          },
          {
            href: "https://gitlab.com/adaptivestone/framework",
            label: "GitLab (framework)",
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
                href: "https://gitlab.com/adaptivestone/framework-documenation",
                label: "GitLab (docs)",
              },
              {
                href: "https://gitlab.com/adaptivestone/framework",
                label: "GitLab (framework)",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Adaptivestone. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
