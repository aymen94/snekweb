/// <reference types="node" />
export type Next = () => Promise<Response | undefined>
export type Handler = (context: Context, next: Next) => Response | Promise<Response>
export interface CookieOptions {
  maxAge?: number
  domain?: string
  path?: string
  expires?: Date | string | number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none' | 'Strict' | 'Lax' | 'None'
}
export interface RouteGroup {
  on(method: string, path: string, ...handlers: Handler[]): this
  get(path: string, ...handlers: Handler[]): this
  post(path: string, ...handlers: Handler[]): this
  put(path: string, ...handlers: Handler[]): this
  patch(path: string, ...handlers: Handler[]): this
  delete(path: string, ...handlers: Handler[]): this
  options(path: string, ...handlers: Handler[]): this
  head(path: string, ...handlers: Handler[]): this
  all(path: string, ...handlers: Handler[]): this
  use(handler: Handler): this
  use(path: string, handler: Handler): this
  group(prefix: string, callback: (group: RouteGroup) => void): this
}
export interface RouteEntry {
  method: string
  path: string
  names: string[]
  regex: RegExp
  handler: Handler
  order: number
  isStatic: boolean
}
export type RouteMatch =
  | { route: RouteEntry; params: Record<string, string> }
  | { badPath: true; route: RouteEntry }
export declare const METHODS: string[]
export declare class Router {
  routes: RouteEntry[]
  add(method: string, path: string, handler: Handler): void
  match(method: string, pathname: string): RouteMatch | undefined
  allowedMethods(pathname: string): string[]
}
export declare class SnekRequest {
  constructor(request: Request, params?: Record<string, string>, url?: URL)
  readonly raw: Request
  readonly params: Record<string, string>
  readonly url: URL
  param(name: string): string | undefined
  query(name: string): string | undefined
  queries(name: string): string[]
  header(name: string): string | undefined
  contentType(): string | undefined
  cookie(name: string): string | undefined
  json<T = unknown>(): Promise<T>
  text(): Promise<string>
  formData(): Promise<FormData>
  arrayBuffer(): Promise<ArrayBuffer>
}
export declare class Context {
  constructor(request: Request, params?: Record<string, string>, url?: URL)
  req: SnekRequest
  res: Response | undefined
  text(body: string, status?: number, headers?: HeadersInit): Response
  html(body: string, status?: number, headers?: HeadersInit): Response
  json(value: unknown, status?: number, headers?: HeadersInit): Response
  redirect(url: string, status?: number): Response
  body(body: BodyInit | null, status?: number, headers?: HeadersInit): Response
  header(name: string): string | undefined
  header(name: string, value: string, options?: { append?: boolean }): void
  cookie(name: string, value: string, options?: CookieOptions): void
  deleteCookie(name: string, options?: Omit<CookieOptions, 'maxAge' | 'expires'>): void
  applyHeaders(response: Response): Response
}
export declare class Snek {
  on(method: string, path: string, ...handlers: Handler[]): this
  get(path: string, ...handlers: Handler[]): this
  post(path: string, ...handlers: Handler[]): this
  put(path: string, ...handlers: Handler[]): this
  patch(path: string, ...handlers: Handler[]): this
  delete(path: string, ...handlers: Handler[]): this
  options(path: string, ...handlers: Handler[]): this
  head(path: string, ...handlers: Handler[]): this
  all(path: string, ...handlers: Handler[]): this
  group(prefix: string, callback: (group: RouteGroup) => void): this
  use(handler: Handler): this
  use(path: string, handler: Handler): this
  notFound(handler: Handler): this
  onError(handler: (error: unknown, context: Context) => Response | Promise<Response>): this
  fetch(request: Request): Promise<Response>
  listen(port: number, options?: { host?: string }): Promise<import('node:http').Server>
}
export declare function serveStatic(root: string, options?: { index?: string }): Handler
