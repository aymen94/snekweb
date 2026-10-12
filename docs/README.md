# Documentation instructions

![Snekweb logo](./assets/images/logo.svg)

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-72e0ae?style=flat-square&labelColor=151c25&logo=node.js&logoColor=72e0ae)](https://nodejs.org/) [![GitHub Pages](https://img.shields.io/badge/docs-GitHub_Pages-72e0ae?style=flat-square&labelColor=151c25)](https://aymen94.github.io/snekweb/)

This folder contains the static GitHub Pages site for Snekweb. It has no build step or front-end dependencies; GitHub
Pages publishes these files directly.

## Site structure

- [`index.html`](./index.html) is the landing page and installation entry point.
- The home page's [`#performance`](./index.html#performance) section contains framework trade-offs, local HTTP benchmark results, and reproduction instructions.
- [`guide.html`](./guide.html) contains the setup guide, API overview, and Node.js integration notes.
- [`styles.css`](./styles.css) holds the shared futuristic visual system, layout, typography, and responsive styles.
- [`assets/images/`](./assets/images/) contains the site logo, favicon files, and installable-site icons.
- [`site.webmanifest`](./site.webmanifest) references the installable-site icons using paths relative to this documentation folder.

Keep the home page focused on the project overview and comparison, with API details in the separate guide.
Navigation and footer markup are intentionally repeated across the pages so each is independently usable without a
client-side framework or template/build system. When adding or renaming a page, update the navigation and footer links
on every page.

## Updating the site

- Keep public API names, examples, Node.js requirements, and addon status consistent with the source code and package metadata.
- Prefer short, runnable examples using the current `snekweb` npm package.
- Avoid claims that the C++ addon accelerates requests; it is currently an optional capability probe, not part of request handling.
- Keep the documented API aligned with route groups, automatic 405/OPTIONS handling, request form readers, response cookies, and `serveStatic`.
- State clearly that the Node server uses `node:http`; the project does not currently bind directly to OS sockets.
- Keep framework comparisons focused on verifiable features and trade-offs. Do not claim Snekweb is faster than Hono, Fastify, or Express without a reproducible, like-for-like benchmark.
- Describe `benchmark/router.js` as an in-process Snekweb router benchmark. `benchmark/frameworks.js` compares the same HTTP route across Snekweb, Hono, Express, Fastify, H3, Koa, Restify, and Hapi. It outputs local median percentages relative to that run's fastest candidate; describe the workload, versions, hardware caveat, and optional package install instructions, not universal rankings.
- When updating competitor descriptions, verify them against their official documentation for Hono, Fastify, and Express.
- Keep links relative for files in this folder. Link to the repository or npm package for external project details.
- Put visual styles in `styles.css`, not page-specific inline style blocks. Keep inline styles only for small,
data-driven visuals such as the benchmark bars.
- Keep the futuristic palette consistent across all pages. Preserve the skip link, descriptive page titles, and keyboard-visible
focus styles.
- Check every page at desktop and mobile widths, and ensure links and navigation remain keyboard accessible.

## Preview locally

From the repository root, serve the static files with Python:

```sh
python -m http.server 8000 --directory docs
```

Open <http://localhost:8000/> in a browser. Preview the home page (including its comparison section) and `guide.html`.
Stop the server with `Ctrl+C`.

## Deploy to GitHub Pages

The repository workflow at [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) builds and deploys the contents of this folder. In the repository's **Settings → Pages**, select **GitHub Actions** as the deployment source. Once enabled, a push to `main` that changes `docs/` starts a deployment; the workflow can also be started manually from the **Actions** tab.

The published site URL is <https://aymen94.github.io/snekweb/>.
