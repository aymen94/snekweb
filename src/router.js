export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT', 'TRACE', 'QUERY']

function compile(path) {
  if (typeof path !== 'string') throw new TypeError('Route paths must be strings')
  const names = []
  const escaped = path.split('/').map((part) => {
    if (part.startsWith(':')) {
      if (part.length === 1) throw new TypeError('Route parameter names cannot be empty')
      names.push(part.slice(1))
      return '([^/]+)'
    }
    if (part === '*') {
      names.push('wildcard')
      return '(.*)'
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('/')
  return { names, regex: new RegExp(`^${escaped}/?$`) }
}

export class Router {
  routes = []
  #routesByMethod = new Map()
  #wildcardRoutes = []
  #wildcardIndex = createIndex()

  add(method, path, handler) {
    if (typeof method !== 'string' || !method) throw new TypeError('Route method must be a non-empty string')
    const { names, regex } = compile(path)
    method = method.toUpperCase()
    const route = {
      method,
      path,
      names,
      regex,
      handler,
      order: this.routes.length,
      isStatic: names.length === 0 && !path.split('/').some((part) => part === '*')
    }
    this.routes.push(route)

    if (method === '*') {
      this.#wildcardRoutes.push(route)
      addToIndex(this.#wildcardIndex, route)
      for (const index of this.#routesByMethod.values()) addToIndex(index, route)
      return
    }

    addToIndex(this.#getIndex(method), route)
  }

  match(method, pathname) {
    if (method === 'HEAD') {
      const headMatch = matchIndex(this.#routesByMethod.get('HEAD') ?? this.#wildcardIndex, pathname)
      const getMatch = matchIndex(this.#routesByMethod.get('GET') ?? this.#wildcardIndex, pathname)
      if (!headMatch) return getMatch
      if (!getMatch) return headMatch
      return (headMatch.route?.order ?? -1) <= (getMatch.route?.order ?? -1) ? headMatch : getMatch
    }
    return matchIndex(this.#routesByMethod.get(method) ?? this.#wildcardIndex, pathname)
  }

  allowedMethods(pathname) {
    const methods = new Set()
    for (const route of this.routes) {
      if (!route.regex.test(pathname)) continue
      if (route.method === '*') return [...new Set([...METHODS, ...methods])]
      methods.add(route.method)
      if (route.method === 'GET') methods.add('HEAD')
    }
    if (methods.size) methods.add('OPTIONS')
    return [...methods]
  }

  #getIndex(method) {
    let index = this.#routesByMethod.get(method)
    if (!index) {
      index = createIndex(this.#wildcardRoutes)
      this.#routesByMethod.set(method, index)
    }
    return index
  }
}

function createIndex(routes = []) {
  const index = { dynamicRoutes: [], staticPaths: new Map() }
  for (const route of routes) addToIndex(index, route)
  return index
}

function addToIndex(index, route) {
  if (route.isStatic) {
    const basePath = route.path.length > 1 ? route.path.replace(/\/+$/, '') : '/'
    const withSlash = basePath === '/' ? '/' : `${basePath}/`
    if (!index.staticPaths.has(basePath)) index.staticPaths.set(basePath, route)
    if (!index.staticPaths.has(withSlash)) index.staticPaths.set(withSlash, route)
  } else {
    index.dynamicRoutes.push(route)
  }
}

function matchIndex(candidates, pathname) {
  const staticRoute = candidates.staticPaths.get(pathname)

  for (const route of candidates.dynamicRoutes) {
    if (staticRoute && route.order >= staticRoute.order) break
    const match = route.regex.exec(pathname)
    if (match) return makeMatch(route, match)
  }
  if (staticRoute) return { route: staticRoute, params: Object.create(null) }
}

function makeMatch(route, match) {
  const params = Object.create(null)
  try {
    for (let i = 0; i < route.names.length; i++) {
      const value = match[i + 1]
      params[route.names[i]] = value.includes('%') ? decodeURIComponent(value) : value
    }
  } catch {
    return { badPath: true, route }
  }
  return { route, params }
}
