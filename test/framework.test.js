import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { METHODS, serveStatic, Snek } from '../src/index.js'

test('static and parameter routes with query and cookie helpers', async () => {
  const app = new Snek()
  app.get('/', (c) => c.text('hello'))
  app.get('/users/:id', (c) => c.json({ id: c.req.param('id'), q: c.req.query('q'), cookie: c.req.cookie('session') }))
  assert.equal(await (await app.fetch(new Request('http://x/'))).text(), 'hello')
  const res = await app.fetch(new Request('http://x/users/a%20b?q=ok', { headers: { cookie: 'session=abc' } }))
  assert.deepEqual(await res.json(), { id: 'a b', q: 'ok', cookie: 'abc' })
  assert.equal((await app.fetch(new Request('http://x/users/%E0%A4%A'))).status, 400)
})

test('methods, middleware ordering, async handlers, not found, and errors', async () => {
  const app = new Snek(); const order = []
  app.use(async (c, next) => { order.push('before'); const res = await next(); order.push('after'); return res })
  app.post('/x', async (c) => { await Promise.resolve(); order.push('handler'); return c.json({ ok: true }) })
  assert.equal((await app.fetch(new Request('http://x/x', { method: 'POST' }))).status, 200)
  assert.deepEqual(order, ['before', 'handler', 'after'])
  assert.equal((await app.fetch(new Request('http://x/missing'))).status, 404)
  app.get('/err', () => { throw Error('bad') }).onError((e, c) => c.text(e.message, 500))
  assert.equal(await (await app.fetch(new Request('http://x/err'))).text(), 'bad')
})

test('all standard method helpers and HEAD response semantics', async () => {
  const app = new Snek()
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options']) app[method](`/${method}`, (c) => c.text(method))
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await app.fetch(new Request(`http://x/${method.toLowerCase()}`, { method }))
    assert.equal(response.status, 200)
    assert.equal(await response.text(), method.toLowerCase())
  }
  const headApp = new Snek().get('/head', (c) => c.text('hidden'))
  const head = await headApp.fetch(new Request('http://x/head', { method: 'HEAD' }))
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})

test('METHODS includes CONNECT, TRACE, and QUERY and QUERY routes can be registered', async () => {
  assert.ok(METHODS.includes('CONNECT'))
  assert.ok(METHODS.includes('TRACE'))
  assert.ok(METHODS.includes('QUERY'))

  const app = new Snek().on('QUERY', '/search', (c) => c.text('query'))
  const response = await app.fetch(new Request('http://x/search', { method: 'QUERY' }))
  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'query')
})

test('static route index preserves registration order, wildcard methods, and slash matching', async () => {
  const first = new Snek()
    .get('/:id', (c) => c.text('parameter'))
    .get('/fixed', (c) => c.text('static'))
  assert.equal(await (await first.fetch(new Request('http://x/fixed'))).text(), 'parameter')

  const second = new Snek()
    .get('/fixed', (c) => c.text('static'))
    .get('/:id', (c) => c.text('parameter'))
  assert.equal(await (await second.fetch(new Request('http://x/fixed/'))).text(), 'static')

  const all = new Snek().all('/wild', (c) => c.text(c.req.raw.method))
  assert.equal(await (await all.fetch(new Request('http://x/wild', { method: 'POST' }))).text(), 'POST')
  const head = new Snek()
    .get('/head', (c) => c.text('get'))
    .head('/head', (c) => c.text('head'))
  assert.equal((await head.fetch(new Request('http://x/head', { method: 'HEAD' }))).status, 200)
})

test('method mismatch returns 405 and unmatched OPTIONS returns allowed methods', async () => {
  const app = new Snek().get('/resource', (c) => c.text('read'))
  const wrongMethod = await app.fetch(new Request('http://x/resource', { method: 'POST' }))
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.headers.get('allow'), 'GET, HEAD, OPTIONS')

  const options = await app.fetch(new Request('http://x/resource', { method: 'OPTIONS' }))
  assert.equal(options.status, 204)
  assert.equal(options.headers.get('allow'), 'GET, HEAD, OPTIONS')
})

test('middleware prefixes respect path segment boundaries and route groups compose', async () => {
  const seen = []
  const app = new Snek()
    .use('/admin', async (c, next) => { seen.push('admin'); return next() })
    .group('/api', (api) => {
      api.use(async (c, next) => { seen.push('api'); return next() })
      api.group('/v1', (v1) => {
        v1.get('/users/:id', (c) => c.text(c.req.param('id')))
          .get('/health', (c) => c.text('healthy'))
      })
    })
    .get('/admin-tools', (c) => c.text('tools'))

  assert.equal(await (await app.fetch(new Request('http://x/api/v1/users/17'))).text(), '17')
  assert.deepEqual(seen, ['api'])
  assert.equal(await (await app.fetch(new Request('http://x/api/v1/health'))).text(), 'healthy')
  assert.deepEqual(seen, ['api', 'api'])
  assert.equal(await (await app.fetch(new Request('http://x/admin-tools'))).text(), 'tools')
  assert.deepEqual(seen, ['api', 'api'])
})

test('form request helpers, response headers, and cookie writing', async () => {
  const app = new Snek().post('/form', async (c) => {
    const data = await c.req.formData()
    c.header('x-framework', 'snekweb')
    c.cookie('session', String(data.get('name')), { httpOnly: true, path: '/', sameSite: 'lax' })
    c.cookie('theme', 'dark')
    return c.json({ name: data.get('name') }, 201)
  })
  const response = await app.fetch(new Request('http://x/form', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'name=Ada+Lovelace'
  }))
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('x-framework'), 'snekweb')
  assert.deepEqual(await response.json(), { name: 'Ada Lovelace' })
  assert.deepEqual(response.headers.getSetCookie(), [
    'session=Ada%20Lovelace; Path=/; HttpOnly; SameSite=Lax',
    'theme=dark'
  ])

  const deleted = await new Snek().get('/delete', (c) => {
    c.deleteCookie('session', { path: '/' })
    return c.text('deleted')
  }).fetch(new Request('http://x/delete'))
  assert.match(deleted.headers.get('set-cookie'), /session=; Max-Age=0; Path=\/; Expires=/)
})

test('static middleware serves safe files, blocks traversal, falls through, and handles cache validators', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'snekweb-static-'))
  const root = join(parent, 'public')
  try {
    await mkdir(root)
    await mkdir(join(root, 'assets'))
    await writeFile(join(root, 'assets', 'index.html'), '<h1>Assets</h1>')
    await writeFile(join(root, 'assets', 'hello.txt'), 'hello static')
    await writeFile(join(parent, 'secret.txt'), 'secret')

    const app = new Snek()
      .use(serveStatic(root))
      .get('/assets/missing.txt', (c) => c.text('fallback', 200))
    const file = await app.fetch(new Request('http://x/assets/hello.txt'))
    assert.equal(await file.text(), 'hello static')
    assert.equal(file.headers.get('content-type'), 'text/plain; charset=utf-8')
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff')

    const notModified = await app.fetch(new Request('http://x/assets/hello.txt', {
      headers: { 'if-modified-since': file.headers.get('last-modified') }
    }))
    assert.equal(notModified.status, 304)

    const head = await app.fetch(new Request('http://x/assets/hello.txt', { method: 'HEAD' }))
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')

    assert.equal(await (await app.fetch(new Request('http://x/assets/'))).text(), '<h1>Assets</h1>')
    assert.equal(await (await app.fetch(new Request('http://x/assets/missing.txt'))).text(), 'fallback')
    const traversal = await app.fetch(new Request('http://x/assets%5c..%5c..%5csecret.txt'))
    assert.equal(traversal.status, 403)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test('Node HTTP adapter streams responses and closes cleanly', async () => {
  const app = new Snek().get('/stream', (c) => c.body(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('native-'))
      controller.enqueue(new TextEncoder().encode('http'))
      controller.close()
    }
  })))
  const server = await app.listen(0, { host: '127.0.0.1' })
  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/stream`)
    assert.equal(await response.text(), 'native-http')
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('streams and concurrent fetch calls', async () => {
  const app = new Snek().get('/stream', (c) => c.body(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('a')); controller.enqueue(new TextEncoder().encode('b')); controller.close() } })))
  const responses = await Promise.all(Array.from({ length: 20 }, () => app.fetch(new Request('http://x/stream'))))
  assert.ok(responses.every((response) => response.status === 200))
  assert.equal(await responses[0].text(), 'ab')
})
