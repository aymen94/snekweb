export class SnekRequest {
  #url

  constructor(request, params = {}, url = new URL(request.url)) {
    this.raw = request
    this.params = params
    this.#url = url
  }
  get url() { return this.#url }
  param(name) { return this.params[name] }
  query(name) { return this.#url.searchParams.get(name) ?? undefined }
  queries(name) { return this.#url.searchParams.getAll(name) }
  header(name) { return this.raw.headers.get(name) ?? undefined }
  contentType() { return this.header('content-type') }
  cookie(name) {
    const cookie = this.header('cookie')
    if (!cookie) return undefined
    for (const item of cookie.split(';')) {
      const index = item.indexOf('=')
      if (index >= 0 && item.slice(0, index).trim() === name) {
        try { return decodeURIComponent(item.slice(index + 1).trim()) } catch { return item.slice(index + 1).trim() }
      }
    }
  }
  json() { return this.raw.json() }
  text() { return this.raw.text() }
  formData() { return this.raw.formData() }
  arrayBuffer() { return this.raw.arrayBuffer() }
}

export class Context {
  #headers = new Headers()
  #cookies = []
  #hasHeaders = false

  constructor(request, params = {}, url) {
    this.req = new SnekRequest(request, params, url)
    this.res = undefined
  }
  text(body, status = 200, headers) {
    return new Response(body, { status, headers: withDefaultHeader(headers, 'content-type', 'text/plain; charset=utf-8') })
  }
  html(body, status = 200, headers) {
    return new Response(body, { status, headers: withDefaultHeader(headers, 'content-type', 'text/html; charset=utf-8') })
  }
  json(value, status = 200, headers) {
    return new Response(JSON.stringify(value), { status, headers: withDefaultHeader(headers, 'content-type', 'application/json; charset=utf-8') })
  }
  redirect(url, status = 302) { return new Response(null, { status, headers: { location: url } }) }
  body(body, status = 200, headers) { return new Response(body, { status, headers }) }
  header(name, value, options = {}) {
    if (value === undefined) return this.#headers.get(name) ?? this.req.header(name)
    this.#hasHeaders = true
    if (options.append) this.#headers.append(name, value)
    else this.#headers.set(name, value)
  }
  cookie(name, value, options = {}) {
    this.#cookies.push(serializeCookie(name, value, options))
    this.#hasHeaders = true
  }
  deleteCookie(name, options = {}) {
    this.cookie(name, '', { ...options, expires: new Date(0), maxAge: 0 })
  }
  applyHeaders(response) {
    if (!this.#hasHeaders) return response
    const headers = new Headers(response.headers)
    for (const [name, value] of this.#headers) headers.set(name, value)
    for (const cookie of this.#cookies) headers.append('set-cookie', cookie)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}

function withDefaultHeader(headers, name, value) {
  const result = new Headers(headers)
  if (!result.has(name)) result.set(name, value)
  return result
}

function serializeCookie(name, value, options) {
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) throw new TypeError('Invalid cookie name')
  if (/[;\r\n]/.test(String(value))) throw new TypeError('Invalid cookie value')
  let cookie = `${name}=${encodeURIComponent(String(value))}`
  if (options.maxAge !== undefined) {
    if (!Number.isInteger(options.maxAge)) throw new TypeError('Cookie maxAge must be an integer')
    cookie += `; Max-Age=${options.maxAge}`
  }
  if (options.domain) {
    if (/[;\r\n]/.test(options.domain)) throw new TypeError('Invalid cookie domain')
    cookie += `; Domain=${options.domain}`
  }
  if (options.path) {
    if (/[;\r\n]/.test(options.path)) throw new TypeError('Invalid cookie path')
    cookie += `; Path=${options.path}`
  }
  if (options.expires) {
    const expires = options.expires instanceof Date ? options.expires : new Date(options.expires)
    if (Number.isNaN(expires.getTime())) throw new TypeError('Invalid cookie expiration date')
    cookie += `; Expires=${expires.toUTCString()}`
  }
  if (options.httpOnly) cookie += '; HttpOnly'
  if (options.secure) cookie += '; Secure'
  if (options.sameSite) {
    const sameSite = String(options.sameSite).toLowerCase()
    if (!['strict', 'lax', 'none'].includes(sameSite)) throw new TypeError('Cookie sameSite must be Strict, Lax, or None')
    cookie += `; SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`
  }
  return cookie
}
