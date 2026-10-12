# snekweb

![Snekweb logo](docs/assets/images/logo.svg)

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-72e0ae?style=flat-square&labelColor=151c25&logo=node.js&logoColor=72e0ae)](https://nodejs.org/) [![No runtime dependencies](https://img.shields.io/badge/runtime_dependencies-none-72e0ae?style=flat-square&labelColor=151c25)](./package.json) [![MIT License](https://img.shields.io/badge/license-MIT-72e0ae?style=flat-square&labelColor=151c25)](./LICENSE)

Snekweb is a small, JavaScript-first HTTP framework for Node.js developers who want a familiar route and middleware API, standard Fetch `Request`/`Response` objects, and no runtime package dependencies. It wraps Node's built-in `node:http` server and keeps the application layer compact and inspectable.

[Documentation](https://aymen94.github.io/snekweb/) · [npm](https://www.npmjs.com/package/snekweb) · [Issues](https://github.com/aymen94/snekweb/issues)

Install with `npm install snekweb`. Requires Node.js 20 or newer.

```js
import { Snek } from 'snekweb'
const app = new Snek()
app.get('/', (c) => c.text('Hello, world!'))
app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
await app.listen(3000)
```

## API

`get`, `post`, `put`, `patch`, `delete`, `options`, `head`, `all`, and `on(method, path, ...handlers)` register routes. Paths support `:name` segments and `*` wildcards; `group(prefix, callback)` creates nested route groups. A known path with an unsupported method returns `405` and `Allow`; `OPTIONS` gets an automatic `204` response unless an explicit route handles it. `use(handler)` adds app-wide middleware; `use(path, handler)` scopes it to a path segment and its descendants. Middleware receives `(context, next)` and can await downstream handlers. Customize misses with `notFound(handler)` and exceptions with `onError(handler)`.

Request helpers include `param`, `query`, `queries`, `header`, `contentType`, `cookie`, `json`, `text`, `formData`, and `arrayBuffer`. Response helpers include `text`, `html`, `json`, `redirect`, and `body`; `header`, `cookie`, and `deleteCookie` add response headers and cookies. `serveStatic(root)` adds basic static-file serving with MIME types, index files, conditional `Last-Modified` requests, and symlink/traversal checks. `fetch(Request)` works without a server and uses standard Web `Request` and `Response` objects. `listen(port, { host })` adapts Node's `node:http` server to Fetch API requests and streams responses with backpressure.

## Project layout

- `src/` contains the framework entry point, app/router, request context, and static-file middleware.
- `types/index.d.ts` provides TypeScript declarations for the exported API.
- `native/` contains an optional N-API capability probe; it is not used to serve requests.
- `docs/` is the static documentation site, including the guide, benchmark notes, and a futuristic visual design.
- `docs/assets/images/` contains the documentation logo, favicon variants, and installable-site icons.
- `test/` contains the Node.js test suite; `examples/` has a runnable hello-world app.
- `benchmark/` contains the in-process router benchmark and optional HTTP comparison harness.

## Feature overview

- **HTTP routing:** method-specific helpers, generic methods, route groups, named path parameters, `*` wildcards, `HEAD` fallback, automatic `405` with `Allow`, and automatic `OPTIONS` responses.
- **Middleware:** ordered global and path-segment-scoped middleware with an async `next()` pipeline.
- **Request context:** Fetch-compatible request access plus parameter, query, header, cookie, JSON, text, form-data, and binary-body helpers.
- **Responses:** standard Web `Response` objects, text, HTML, JSON, redirects, custom bodies, response headers, and cookie creation/deletion.
- **Errors and misses:** configurable not-found and error handlers.
- **Static files:** MIME types, optional index files, conditional `Last-Modified`, and path/symlink containment checks; serves `GET` and `HEAD`.
- **Node.js serving:** built-in `node:http` adapter and streamed responses with backpressure; `fetch(Request)` also enables use without opening a port.
- **TypeScript support:** declarations for the exported JavaScript API.
- **Zero runtime dependencies:** the framework itself relies on Node.js built-ins; optional benchmark tools are installed separately.

Snekweb is intentionally not a batteries-included platform. Schema validation, request-body size limits, authentication, sessions, CORS, rate limiting, range requests, and a built-in plugin catalog are outside the current core; add application middleware or use a broader framework when those features are needed.

## Development

Requires Node.js 20 or newer. No install step is needed for development.

```sh
node --test
node benchmark/router.js
node examples/hello.js
```

Equivalent npm scripts are `npm test`, `npm run bench`, and `npm run bench:frameworks` (the last requires optional local benchmark packages). `npm run build:native` builds the optional N-API probe and requires a working node-gyp/C++ build toolchain; it is not needed for normal use.

The benchmark reports five in-process samples, median throughput, runtime, and memory. Compare workloads and hardware under the same conditions; these measurements are not framework-to-framework claims.

The benchmark includes a single parameterized route and a workload with 100 unrelated static routes ahead of it. To adjust the request count, set `ITERATIONS` (for example, `ITERATIONS=50000 npm run bench`).

For an optional HTTP-level comparison against Hono, Express, Fastify, H3, Koa, Restify, and Hapi, install the benchmark versions locally without saving them as project dependencies, then run:

```sh
npm install --no-save --package-lock=false hono@4.13.9 @hono/node-server@2.1.4 fastify@5.12.5 express@5.3.0 h3@2.0.1-rc.29 koa@3.2.1 restify@12.0.0 @hapi/hapi@21.4.10
npm run bench:frameworks
```

This sends the same `GET /users/42` request to each framework over its Node.js HTTP server, validates the `200 text/plain` response, and reports each median relative to Snekweb (Snekweb is always 100%; faster frameworks score above 100%). It warms each server and rotates the sample order to reduce JIT and order bias. It does not output raw throughput values. Tune `ITERATIONS`, `CONCURRENCY`, `SAMPLES`, and `WARMUP` to fit your machine. This small local benchmark is indicative rather than definitive: HTTP client/server overhead, framework adapters, dependency versions, Node.js, and hardware all affect results. Use a production-like workload and a dedicated benchmark tool for decisions. The optional packages are not declared or required by Snekweb.

## Why Snekweb?

Choose Snekweb when a compact Node.js app, zero runtime dependencies, and Fetch API compatibility are more important than a large plugin ecosystem or built-in production features. Its small surface is easy to inspect and extend with ordinary middleware. Snekweb currently targets Node.js 20+ and does not include schema validation, request-body size limits, or a built-in middleware catalog.

| Framework | A good fit when you want | Trade-off compared with Snekweb |
| --- | --- | --- |
| **Snekweb** | A tiny Node.js-only core, no runtime dependencies, route groups, static-file middleware, and Fetch `Request`/`Response` handling | Young project and smaller ecosystem; fewer batteries included |
| Hono | Web-standard APIs across Node.js, edge, and other JavaScript runtimes, plus a broad middleware collection | More features and runtime targets than Snekweb's deliberately narrow scope |
| Fastify | A mature plugin architecture and schema-based validation/serialization for Node.js services | More framework concepts and runtime packages in exchange for a fuller platform |
| Express | A widely adopted Node.js framework with a large middleware ecosystem and familiar `req`/`res` API | Uses Node-specific request/response objects; commonly extended with middleware packages |

These are different design choices, not a universal ranking. If you need a mature ecosystem, extensive plugins, or built-in schema workflows, another framework may be a better fit. The in-process router benchmark measures Snekweb only; the optional HTTP comparison is a small local snapshot, not a universal performance claim. See [the router benchmark](./benchmark/router.js) and [the HTTP benchmark](./benchmark/frameworks.js), and use the same machine, Node.js version, workload, and server adapter before drawing throughput conclusions.

## Documentation site

The static documentation site lives in `docs/` and is deployed by `.github/workflows/pages.yml` when changes are pushed to `main`. To enable it, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. After the first successful workflow run, the site is available at [aymen94.github.io/snekweb](https://aymen94.github.io/snekweb/).

## Native addon

`listen()` uses Node.js `node:http` for TCP and HTTP handling; Snekweb does not bind directly to OS sockets. `native/` provides a `node-gyp` N-API capability probe and an opt-in loader. Nothing in normal use loads or compiles native code, and C++ does not currently process requests. Build manually with `npm run build:native` when you have a working C++ toolchain. `node-gyp` may download Node.js headers; behind a TLS-inspecting proxy, configure Node.js to trust your organization's CA (for example, with `NODE_EXTRA_CA_CERTS`) instead of disabling certificate checks. The benchmark should justify any future native request-path implementation against the cost of crossing the JavaScript/C++ boundary.

## Feature coverage

The framework currently provides a compact set of common server essentials:

- **Routing:** method helpers, generic methods, route groups, named parameters, wildcards, `HEAD` fallback, and automatic `405`/`OPTIONS` responses.
- **Requests and responses:** JSON, text, form, and binary body readers; query, header, and cookie helpers; response utilities and cookie writing.
- **Middleware and errors:** ordered global or segment-scoped middleware, custom not-found handling, and configurable error handling.
- **Static assets and serving:** safe basic static-file middleware, `fetch(Request)` for Fetch-based integrations, and a Node.js HTTP adapter with streamed responses.

This remains a lightweight framework, not a complete batteries-included platform. It does not include schema validation, request-body size limits, built-in CORS/authentication/session middleware, static-file range requests, or a large plugin ecosystem. Static middleware handles `GET` and `HEAD`, serves an optional index file, and falls through on missing files; it does not provide directory listings. `listen()` uses Node's HTTP server and Fetch adapters; the optional N-API addon does not bind sockets or process requests directly.

The TypeScript declarations cover the exported framework API. Use application-level middleware for policies such as authentication, validation, rate limiting, and CORS.
