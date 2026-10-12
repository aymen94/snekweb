// Optional like-for-like HTTP benchmark. Install comparison frameworks separately;
// keeping them out of package.json preserves Snekweb's zero-runtime-dependency core.
import { Snek } from '../src/index.js'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'

const iterations = Number(process.env.ITERATIONS || 5_000)
const concurrency = Number(process.env.CONCURRENCY || 25)
const samplesCount = Number(process.env.SAMPLES || 8)
const warmupIterations = Number(process.env.WARMUP || 500)
const route = '/users/:id'
const path = '/users/42'
const body = '42'

function assertBenchmarkSettings() {
  for (const [name, value] of Object.entries({ iterations, concurrency, samplesCount })) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
  }
}

function listen(listener) {
  return new Promise((resolve, reject) => {
    const server = createServer(listener)
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function close(server) {
  if (server.close.length === 0) return server.close()
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

async function createApps() {
  const apps = []

  const snek = new Snek().get(route, (c) => c.text(c.req.param('id')))
  apps.push({ name: 'Snekweb', package: 'snekweb', dependencies: [], start: () => snek.listen(0, { host: '127.0.0.1' }) })

  const [{ Hono }, { serve }, expressModule, fastifyModule, h3, koaModule, restify, hapi] = await Promise.all([
    import('hono'),
    import('@hono/node-server'),
    import('express'),
    import('fastify'),
    import('h3/node'),
    import('koa'),
    import('restify'),
    import('@hapi/hapi')
  ])

  const hono = new Hono()
  hono.get(route, (c) => c.text(c.req.param('id')))
  apps.push({
    name: 'Hono',
    package: 'hono',
    dependencies: ['@hono/node-server'],
    start: async () => {
      const server = serve({ fetch: hono.fetch, hostname: '127.0.0.1', port: 0 })
      if (!server.listening) await once(server, 'listening')
      return server
    }
  })

  const express = expressModule.default()
  express.get(route, (req, res) => res.type('text/plain').send(req.params.id))
  apps.push({
    name: 'Express',
    package: 'express',
    dependencies: [],
    start: () => new Promise((resolve, reject) => {
      const server = express.listen(0, '127.0.0.1', () => resolve(server))
      server.once('error', reject)
    })
  })

  const fastify = fastifyModule.default()
  fastify.get(route, async (request, reply) => reply.type('text/plain').send(request.params.id))
  apps.push({
    name: 'Fastify',
    package: 'fastify',
    dependencies: [],
    start: async () => {
      await fastify.listen({ port: 0, host: '127.0.0.1' })
      return { address: () => fastify.server.address(), close: () => fastify.close() }
    }
  })

  const h3App = h3.createApp()
  h3App.get(route, (event) => new Response(h3.getRouterParam(event, 'id'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  }))
  apps.push({
    name: 'H3',
    package: 'h3',
    dependencies: [],
    start: () => listen(h3.toNodeHandler(h3App))
  })

  const koa = new koaModule.default()
  koa.use((ctx) => {
    const match = /^\/users\/([^/]+)\/?$/.exec(ctx.path)
    ctx.status = match ? 200 : 404
    if (match) {
      ctx.type = 'text/plain'
      ctx.body = match[1]
    }
  })
  apps.push({
    name: 'Koa',
    package: 'koa',
    dependencies: [],
    start: async () => {
      const server = koa.listen(0, '127.0.0.1')
      if (!server.listening) await once(server, 'listening')
      return server
    }
  })

  const restifyServer = restify.createServer({ name: 'snekweb-benchmark' })
  restifyServer.get(route, (req, res, next) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(req.params.id)
    return next()
  })
  apps.push({
    name: 'Restify',
    package: 'restify',
    dependencies: [],
    start: () => new Promise((resolve, reject) => {
      restifyServer.once('error', reject)
      restifyServer.listen(0, '127.0.0.1', () => resolve(restifyServer))
    })
  })

  const hapiServer = new hapi.Server({ port: 0, host: '127.0.0.1' })
  hapiServer.route({
    method: 'GET',
    path: '/users/{id}',
    handler: (request, h) => h.response(request.params.id).type('text/plain')
  })
  apps.push({
    name: 'Hapi',
    package: '@hapi/hapi',
    dependencies: [],
    start: async () => {
      await hapiServer.start()
      return hapiServer.listener
    }
  })

  return apps
}

function originOf(server, name) {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error(`${name} server did not expose a TCP address`)
  return `http://127.0.0.1:${address.port}`
}

async function benchmark(name, start) {
  const server = await start()
  return {
    name,
    server,
    url: `${originOf(server, name)}${path}`,
    samples: []
  }
}

async function runRequests(app, count, checkResponse = false) {
  let completed = 0
  const started = performance.now()
  while (completed < count) {
    const batch = Math.min(concurrency, count - completed)
    await Promise.all(Array.from({ length: batch }, async () => {
      const response = await fetch(app.url)
      const text = await response.text()
      if (checkResponse && (response.status !== 200 || text !== body)) {
        throw new Error(`${app.name} returned an unexpected response`)
      }
    }))
    completed += batch
  }
  return performance.now() - started
}

async function packageVersion(name) {
  const packagePath = name === 'snekweb'
    ? new URL('../package.json', import.meta.url)
    : new URL(`../node_modules/${name}/package.json`, import.meta.url)
  return JSON.parse(await readFile(packagePath, 'utf8')).version
}

assertBenchmarkSettings()
if (!Number.isInteger(warmupIterations) || warmupIterations < 1) {
  throw new Error('WARMUP must be a positive integer')
}

const definitions = await createApps()
const running = []
try {
  for (const definition of definitions) {
    const app = await benchmark(definition.name, definition.start)
    app.package = definition.package
    running.push(app)
    const check = await fetch(app.url)
    if (check.status !== 200 || await check.text() !== body) {
      throw new Error(`${app.name} returned an unexpected response`)
    }
  }

  for (const app of running) await runRequests(app, warmupIterations, true)

  for (let sample = 0; sample < samplesCount; sample++) {
    const offset = sample % running.length
    const order = [...running.slice(offset), ...running.slice(0, offset)]
    for (const app of order) {
      app.samples.push(await runRequests(app, iterations, true))
    }
  }

  const rates = new Map(running.map((app) => {
    const sorted = app.samples.map((duration) => iterations / duration * 1000).sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    return [app.name, median]
  }))
  const baseline = rates.get('Snekweb')
  const results = {}
  for (const app of running.sort((left, right) => rates.get(right.name) - rates.get(left.name))) {
    results[app.name] = {
      version: await packageVersion(app.package),
      dependencies: await Promise.all(app.dependencies.map(async (name) => `${name}@${await packageVersion(name)}`)),
      relativePerformancePercent: +(rates.get(app.name) / baseline * 100).toFixed(1)
    }
  }

  console.log(JSON.stringify({
    runtime: process.version,
    platform: `${process.platform} ${process.arch}`,
    workload: { method: 'GET', path, response: 'text/plain: 42' },
    iterationsPerSample: iterations,
    concurrency,
    samples: samplesCount,
    warmupRequestsPerFramework: warmupIterations,
    baseline: 'Snekweb',
    results,
    note: 'Snekweb is normalized to 100%; results above 100% were faster in this local run. Values are not hardware-independent rankings.'
  }, null, 2))
} finally {
  await Promise.all(running.map((app) => close(app.server)))
}
