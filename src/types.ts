import type {App} from './app.js';
import type {Context} from './context.js';
import type {ValidatorResult} from './validator/result.js';
import type {Agent} from 'http';
import type {CookieJar} from 'tough-cookie';
import type {URL} from 'url';

// Helper types for debugging
export type Expand<T> = T extends infer O ? {[K in keyof O]: O[K]} : never;
export type ExpandRecursive<T> = T extends infer O ? {[K in keyof O]: ExpandRecursive<O[K]>} : never;

// Plain JSON
export type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};
export type JSONObject = {[key: string]: JSONValue};

export type MojoApp = App;

export interface MojoContext extends Context {
  [key: string]: any;
}

export type MojoAction = (ctx: MojoContext, ...args: any[]) => any;

export type AnyArguments = Array<string | string[] | MojoAction | Record<string, string[] | RegExp>>;
export type RouteArguments = Array<string | MojoAction | Record<string, string[] | RegExp>>;
export type PlaceholderType = RegExp | string | string[];

export interface SessionData {
  expiration?: number;
  expires?: number;
  flash?: {[key: string]: any};
  nextFlash?: {[key: string]: any};
  [key: string]: any;
}

export interface AppOptions {
  config?: Record<string, any>;
  exceptionFormat?: string;
  detectImport?: boolean;
  mode?: string;
  secrets?: string[];
}

export interface ConfigOptions {
  ext?: string;
  file?: string;
}

export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
}

export interface MockRequestOptions {
  headers?: Record<string, string>;
  method?: string;
  url?: string;
}

export interface RenderOptions {
  engine?: string;
  format?: string;
  inline?: string;
  inlineLayout?: string;
  json?: JSONValue;
  layout?: string;
  maybe?: boolean;
  pretty?: boolean;
  status?: number;
  text?: string;
  view?: string;
  [key: string]: any;
}

export interface ServerRequestOptions {
  isWebSocket: boolean;
  reverseProxy: boolean;
}

export interface UserAgentOptions {
  baseUrl?: string | URL;
  cookieJar?: CookieJar;
  maxRedirects?: number;
  name?: string;
}
interface SharedUserAgentRequestOptions {
  auth?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  url?: string | URL;
}
export interface UserAgentRequestOptions extends SharedUserAgentRequestOptions {
  agent?: Agent;
  ca?: string | string[] | Buffer | Buffer[];
  body?: string | Buffer | NodeJS.ReadableStream;
  form?: Record<string, string>;
  formData?: Record<string, string> | FormData;
  insecure?: boolean;
  json?: JSONValue;
  method?: string;
  servername?: string;
}
export interface UserAgentWebSocketOptions extends SharedUserAgentRequestOptions {
  json?: boolean;
  protocols?: string[];
}

export type TestUserAgentOptions = UserAgentOptions & {tap?: Tap.Tap};

export interface ValidationError {
  instancePath: string;
  message?: string;
  schemaPath: string;
}

export type ValidatorFunction = (data: JSONObject) => ValidatorResult;
