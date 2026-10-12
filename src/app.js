import { Router, METHODS } from './router.js'
import { Context } from './context.js'

export class Snek {
  #router = new Router()
  #middleware = []
  #notFound = (c) => c.text('404 Not Found', 404)
  #onError = (error, c) => { console.error(error); return c.text('Internal Server Error', 500) }

  on(method, path, ...handlers) {
    if (!handlers.length || handlers.some((fn) => typeof fn !== 'function')) throw new TypeError('Route handlers must be functions')
    this.#router.add(method, path, handlers.length === 1 ? handlers[0] : compose(handlers))
    return this
  }
  get(path, ...handlers) { return this.on('GET', path, ...handlers) }
  post(path, ...handlers) { return this.on('POST', path, ...handlers) }
  put(path, ...handlers) { return this.on('PUT', path, ...handlers) }
  patch(path, ...handlers) { return this.on('PATCH', path, ...handlers) }
  delete(path, ...handlers) { return this.on('DELETE', path, ...handlers) }
  options(path, ...handlers) { return this.on('OPTIONS', path, ...handlers) }
  head(path, ...handlers) { return this.on('HEAD', path, ...handlers) }
  all(path, ...handlers) { return this.on('*', path, ...handlers) }
  group(prefix, callback) {
    if (typeof callback !== 'function') throw new TypeError('Route group callback must be a function')
    callback(new RouteGroup(this, normalizePath(prefix)))
    return this
  }
  use(pathOrHandler, handler) {
    if (typeof pathOrHandler === 'function') this.#middleware.push({ path: '', handler: pathOrHandler })
    else if (typeof pathOrHandler === 'string' && typeof handler === 'function') {
      this.#middleware.push({ path: normalizePath(pathOrHandler), handler })
    }
    else throw new TypeError('Middleware must be a function')
    return this
  }
  notFound(handler) { this.#notFound = handler; return this }
  onError(handler) { this.#onError = handler; return this }

  async fetch(request) {
    return this.#fetch(request, new URL(request.url))
  }

  async #fetch(request, url) {
    const found = this.#router.match(request.method.toUpperCase(), url.pathname)
    const context = new Context(request, found?.params, url)
    try {
      if (found?.badPath) return context.text('400 Bad Request', 400)
      const allowed = !found && this.#router.allowedMethods(url.pathname)
      const endpoint = found?.route.handler ?? (
        allowed?.length
          ? request.method.toUpperCase() === 'OPTIONS'
            ? (c) => c.body(null, 204, { allow: allowed.join(', ') })
            : (c) => c.text('405 Method Not Allowed', 405, { allow: allowed.join(', ') })
          : this.#notFound
      )
      let response
      if (this.#middleware.length) {
        const stack = []
        for (const item of this.#middleware) {
          if (matchesPrefix(url.pathname, item.path)) stack.push(item.handler)
        }
        if (stack.length) {
          stack.push(endpoint)
          response = await compose(stack)(context)
        } else {
          response = await endpoint(context)
        }
      } else {
        response = await endpoint(context)
      }
      if (!(response instanceof Response)) throw new TypeError('A handler must return a Response')
      response = context.applyHeaders(response)
      return await suppressHeadBody(request, response)
    } catch (error) {
      const response = await this.#onError(error, context)
      if (!(response instanceof Response)) throw new TypeError('The error handler must return a Response')
      return await suppressHeadBody(request, context.applyHeaders(response))
    }
  }
  listen(port, options = {}) {
    return Promise.all([import('node:http'), import('node:stream'), import('node:stream/promises')]).then(([{ createServer }, { Readable }, { pipeline }]) => {
      return new Promise((resolve, reject) => {
        const server = createServer(async (req, res) => {
          try {
            const host = req.headers.host || 'localhost'
            const url = new URL(req.url, `http://${host}`)
            const request = new Request(url, {
              method: req.method,
              headers: req.headers,
              body: ['GET', 'HEAD'].includes(req.method) ? undefined : req,
              duplex: 'half'
            })
            const response = await this.#fetch(request, url)
            const headers = Object.fromEntries(response.headers)
            const cookies = response.headers.getSetCookie?.()
            if (cookies?.length) headers['set-cookie'] = cookies
            res.writeHead(response.status, headers)
            if (response.body) await pipeline(Readable.fromWeb(response.body), res)
            else res.end()
          } catch (error) {
            if (res.headersSent) res.destroy()
            else {
              console.error(error)
              res.statusCode = 500
              res.end('Internal Server Error')
            }
          }
        })
        server.once('error', reject)
        server.listen(port, options.host, () => resolve(server))
      })
    })
  }
}

function compose(handlers) {
  return (context, downstream) => {
    let last = -1
    const dispatch = async (index) => {
      if (index <= last) throw new Error('next() called more than once')
      last = index
      const handler = handlers[index]
      if (!handler) return downstream?.()
      return handler(context, () => dispatch(index + 1))
    }
    return dispatch(0)
  }
}

function normalizePath(path) {
  if (typeof path !== 'string') throw new TypeError('Route paths must be strings')
  const normalized = `/${path.split('/').filter(Boolean).join('/')}`
  return normalized === '/' ? '' : normalized
}

function joinPath(prefix, path) {
  const child = normalizePath(path)
  return `${prefix}${child}` || '/'
}

function matchesPrefix(pathname, prefix) {
  return prefix === '' || pathname === prefix || pathname.startsWith(`${prefix}/`)
}

class RouteGroup {
  #app
  #prefix

  constructor(app, prefix) {
    this.#app = app
    this.#prefix = prefix
  }
  on(method, path, ...handlers) { this.#app.on(method, joinPath(this.#prefix, path), ...handlers); return this }
  get(path, ...handlers) { return this.on('GET', path, ...handlers) }
  post(path, ...handlers) { return this.on('POST', path, ...handlers) }
  put(path, ...handlers) { return this.on('PUT', path, ...handlers) }
  patch(path, ...handlers) { return this.on('PATCH', path, ...handlers) }
  delete(path, ...handlers) { return this.on('DELETE', path, ...handlers) }
  options(path, ...handlers) { return this.on('OPTIONS', path, ...handlers) }
  head(path, ...handlers) { return this.on('HEAD', path, ...handlers) }
  all(path, ...handlers) { return this.on('*', path, ...handlers) }
  use(pathOrHandler, handler) {
    if (typeof pathOrHandler === 'function') this.#app.use(this.#prefix || '/', pathOrHandler)
    else this.#app.use(joinPath(this.#prefix, pathOrHandler), handler)
    return this
  }
  group(prefix, callback) {
    if (typeof callback !== 'function') throw new TypeError('Route group callback must be a function')
    callback(new RouteGroup(this.#app, joinPath(this.#prefix, prefix)))
    return this
  }
}

async function suppressHeadBody(request, response) {
  if (request.method !== 'HEAD') return response
  await response.body?.cancel()
  return new Response(null, response)
}

export { METHODS }
