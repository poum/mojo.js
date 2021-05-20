import Route from './route.js';

export default class Plan {
  endpoint: Route = undefined;
  steps: {}[] = [];
  stops: boolean[] = [];

  render (values: {} = {}) : {path: string, websocket: boolean} {
    const merged = [...this.steps, values].reduce((result, current) => Object.assign(result, current), {});
    return {path: this.endpoint.render(merged), websocket: this.endpoint.hasWebSocket()};
  }
}
