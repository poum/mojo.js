import {ClientRequest, ServerResponse} from 'http';
import ejsEnginePlugin from './plugins/ejs-engine.js';
import exceptionHelpersPlugin from './plugins/exception-helpers.js';
import headerConditionsPlugin from './plugins/header-conditions.js';
import MockClient from './client/mock.js';
import TestClient from './client/test.js';
import File from './file.js';
import CLI from './cli.js';
import Client from './client.js';
import Hooks from './hooks.js';
import HTTPContext from './context/http.js';
import Logger from './logger.js';
import Mime from './mime.js';
import Renderer from './renderer.js';
import {AnyArguments, RouteArguments} from './router/route.js';
import Router from './router.js';
import Session from './session.js';
import Static from './static.js';
import viewHelpersPlugin from './plugins/view-helpers.js';
import WebSocketContext from './context/websocket.js';

export interface AppOptions {
  config?: {},
  exceptionFormat?: string,
  mode?: string,
  secrets?: string[]
}

export interface HTTPContextWithHelpers extends HTTPContext {
  [key: string]: any
}

export interface WebSocketContextWithHelpers extends WebSocketContext {
  [key: string]: any
}

export type MojoContext = HTTPContextWithHelpers | WebSocketContextWithHelpers;

export default class App {
  cli: CLI = new CLI(this);
  client: Client = new Client();
  config: {};
  exceptionFormat: string;
  hooks: Hooks = new Hooks();
  home: File = undefined;
  log: Logger;
  mime: Mime = new Mime();
  models: {} = {};
  mojo: Function = undefined;
  renderer: Renderer = new Renderer();
  router: Router = new Router();
  secrets: string[];
  session: Session = new Session(this);
  static: Static = new Static();
  _httpContextClass: any = class extends HTTPContext {};
  _mode: string;
  _websocketContextClass: any = class extends WebSocketContext {};

  constructor (options: AppOptions = {}) {
    this.config = options.config ?? {};
    this.exceptionFormat = options.exceptionFormat ?? 'html';
    this.secrets = options.secrets ?? ['Insecure'];
    this._mode = options.mode ?? process.env.NODE_ENV ?? 'development';

    const isDev = this._mode === 'development';
    this.log = new Logger({historySize: isDev ? 10 : 0, level: isDev ? 'debug' : 'info'});

    this.plugin(ejsEnginePlugin);
    this.plugin(exceptionHelpersPlugin);
    this.plugin(headerConditionsPlugin);
    this.plugin(viewHelpersPlugin);
  }

  addHelper (name: string, fn: Function) {
    return this.decorateContext(name, function (...args) {
      return fn(this, ...args);
    });
  }

  addHook (name: string, fn: Function) {
    this.hooks.addHook(name, fn);
    return this;
  }

  any (...args: AnyArguments) {
    return this.router.any(...args);
  }

  decorateContext (name: string, fn: PropertyDescriptor & ThisType<any>) {
    if (HTTPContext.prototype[name] !== undefined || WebSocketContext[name] !== undefined) {
      throw new Error(`The name "${name}" is already used in the prototype chain`);
    }

    if (typeof fn.get === 'function' || typeof fn.set === 'function') {
      Object.defineProperty(this._httpContextClass.prototype, name, fn);
      Object.defineProperty(this._websocketContextClass.prototype, name, fn);
    } else {
      this._httpContextClass.prototype[name] = fn;
      this._websocketContextClass.prototype[name] = fn;
    }

    return this;
  }

  delete (...args: RouteArguments) {
    return this.router.delete(...args);
  }

  get (...args: RouteArguments) {
    return this.router.get(...args);
  }

  async handleRequest (ctx: MojoContext) {
    if (ctx.isWebSocket === true) {
      if (await this.hooks.runHook('websocket', ctx) === true) return;
      await this.router.dispatch(ctx);
      return;
    }

    try {
      if (await this.hooks.runHook('request', ctx) === true) return;
      if (await this.static.dispatch(ctx) === true) return;
      if (await this.router.dispatch(ctx) === true) return;
      await ctx.notFound();
    } catch (error) {
      await ctx.exception(error);
    }
  }

  get mode () {
    return this._mode;
  }

  newHTTPContext (req: ClientRequest, res: ServerResponse, options: any) {
    return new this._httpContextClass(this, req, res, options);
  }

  newMockClient (options) {
    return MockClient.newMockClient(this, options);
  }

  newTestClient (options) {
    return TestClient.newTestClient(this, options);
  }

  newWebSocketContext (req: ClientRequest, options) {
    return new this._websocketContextClass(this, req, options);
  }

  options (...args: RouteArguments) {
    return this.router.options(...args);
  }

  patch (...args: RouteArguments) {
    return this.router.patch(...args);
  }

  plugin (plugin: Function, options: {} = {}) {
    return plugin(this, options);
  }

  post (...args: RouteArguments) {
    return this.router.post(...args);
  }

  put (...args: RouteArguments) {
    return this.router.put(...args);
  }

  start (command: string, ...options) {
    if (process.argv[1] !== File.callerFile().toString()) return;
    return this.cli.start(command, ...options);
  }

  under (...args: AnyArguments) {
    return this.router.under(...args);
  }

  async warmup () {
    await this.renderer.warmup();
    await this.router.warmup();
  }

  websocket (...args: AnyArguments) {
    return this.router.websocket(...args);
  }
}
