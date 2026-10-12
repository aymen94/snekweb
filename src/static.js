import { createReadStream, statSync } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'

const MIME_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml']
])

export function serveStatic(root, { index = 'index.html' } = {}) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('Static root must be a non-empty path')
  if (typeof index !== 'string' || index.length === 0 || index.includes('/') || index.includes('\\') || index === '.' || index === '..') {
    throw new TypeError('Static index must be a file name')
  }

  const rootPath = resolve(root)
  if (!statSync(rootPath).isDirectory()) throw new TypeError('Static root must be a directory')
  const canonicalRoot = realpath(rootPath)

  return async (context, next) => {
    const method = context.req.raw.method.toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') return next()

    let pathname
    try {
      pathname = decodeURIComponent(context.req.url.pathname)
    } catch {
      return context.text('400 Bad Request', 400)
    }
    if (pathname.includes('\0')) return context.text('400 Bad Request', 400)

    let filePath = resolve(rootPath, `.${pathname}`)
    if (!isInside(rootPath, filePath)) return context.text('403 Forbidden', 403)

    let fileStat
    try {
      fileStat = await stat(filePath)
      if (fileStat.isDirectory()) {
        filePath = resolve(filePath, index)
        fileStat = await stat(filePath)
      }
      if (!fileStat.isFile()) return next()
      const canonicalPath = await realpath(filePath)
      if (!isInside(await canonicalRoot, canonicalPath)) return context.text('403 Forbidden', 403)
      filePath = canonicalPath
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return next()
      throw error
    }

    const lastModified = fileStat.mtime.toUTCString()
    const modifiedSince = context.req.header('if-modified-since')
    if (modifiedSince && fileStat.mtime.getTime() <= Date.parse(modifiedSince) + 999) {
      return context.body(null, 304, { 'last-modified': lastModified })
    }

    return context.body(Readable.toWeb(createReadStream(filePath)), 200, {
      'accept-ranges': 'none',
      'cache-control': 'public, max-age=0',
      'content-length': String(fileStat.size),
      'content-type': MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'last-modified': lastModified,
      'x-content-type-options': 'nosniff'
    })
  }
}

function isInside(rootPath, targetPath) {
  const path = relative(rootPath, targetPath)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}
