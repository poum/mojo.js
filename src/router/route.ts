import assert from 'assert';
import Pattern from './pattern.js';
import Router from '../router.js';

export type AnyArguments = (string | string[] | Function | {})[];

export type RouteArguments = (string | Function | {})[];

export default class Route {
  children: Route[] = [];
  customName: string = undefined;
  defaultName: string = undefined;
  underRoute: boolean = false;
  methods: string[] = [];
  parent: WeakRef<Route> = undefined;
  pattern: Pattern = new Pattern();
  root: WeakRef<Router> = undefined;
  requirements: object[] = undefined;
  websocketRoute: boolean = false;

  addChild (child: Route) {
    this.children.push(child);
    child.parent = new WeakRef(this);
    child.root = this.root;
    return child;
  }

  any (...args: AnyArguments) {
    const child = new Route();

    for (const arg of args) {
      if (typeof arg === 'string') {
        child.defaultName = arg.replace(/[^0-9a-z]+/gi, '_').replace(/^_|_$/g, '');
        child.pattern.parse(arg);
      } else if (arg instanceof Array) {
        child.methods = arg;
      } else if (typeof arg === 'function') {
        child.pattern.defaults.fn = arg;
      } else if (typeof arg === 'object') {
        Object.assign(child.pattern.constraints, arg);
      }
    }
    child.pattern.types = this.root.deref().types;

    return this.addChild(child);
  }

  delete (...args: RouteArguments) {
    return this.any(['DELETE'], ...args);
  }

  get (...args: RouteArguments) {
    return this.any(['GET'], ...args);
  }

  hasWebSocket () {
    return this._branch().map(route => route.websocketRoute).includes(true);
  }

  isEndpoint () {
    return this.children.length === 0;
  }

  name (name: string) {
    this.customName = name;
    return this;
  }

  options (...args: RouteArguments) {
    return this.any(['OPTIONS'], ...args);
  }

  patch (...args: RouteArguments) {
    return this.any(['PATCH'], ...args);
  }

  post (...args: RouteArguments) {
    return this.any(['POST'], ...args);
  }

  put (...args: RouteArguments) {
    return this.any(['PUT'], ...args);
  }

  render (values: {[key: string]: string} = {}) {
    const parts = [];
    const branch = this._branch();
    for (let i = 0; i < branch.length - 1; i++) {
      parts.push(branch[i].pattern.render(values, {isEndpoint: branch[i].isEndpoint()}));
    }
    return parts.reverse().join('');
  }

  requires (condition: string, requirement: any) {
    assert(this.root.deref().conditions[condition], 'Invalid condition');

    if (this.requirements === undefined) this.requirements = [];
    this.requirements.push({condition, requirement});
    this.root.deref().cache = null;

    return this;
  }

  to (target: string | Function | {}) {
    if (typeof target === 'string') {
      const parts = target.split('#');
      if (parts[0] !== '') this.pattern.defaults.controller = parts[0];
      if (parts.length > 1 && parts[1] !== '') this.pattern.defaults.action = parts[1];
    } else if (typeof target === 'function') {
      this.pattern.defaults.fn = target;
    } else {
      Object.assign(this.pattern.defaults, target);
    }

    return this;
  }

  under (...args: AnyArguments) {
    const child = this.any(...args);
    child.underRoute = true;
    return child;
  }

  websocket (...args: AnyArguments) {
    const child = this.any(...args);
    child.websocketRoute = true;
    return child;
  }

  _branch () {
    let current: Route = this;
    const branch = [current];
    while (current.parent !== undefined) {
      branch.push(current = current.parent.deref());
    }
    return branch;
  }
}
