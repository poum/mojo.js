import type {MojoApp} from '../types.js';
import {Server} from '../server.js';
import nopt from 'nopt';

const EVENTS = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

export default async function serverCommand(app: MojoApp, args: string[]): Promise<void> {
  const parsed = nopt(
    {
      cluster: Boolean,
      level: String,
      listen: [String, Array],
      proxy: Boolean,
      workers: Number
    },
    {c: '--cluster', L: '--level', l: '--listen', p: '--proxy', w: '--workers'},
    args,
    1
  );

  if (parsed.level !== undefined) app.log.level = parsed.level;

  const server = new Server(app, {
    cluster: parsed.cluster,
    listen: parsed.listen,
    reverseProxy: parsed.proxy,
    workers: parsed.workers
  });

  const listener = (): void => {
    EVENTS.forEach(signal => process.removeListener(signal, listener));
    server.stop().catch(error => app.log.error(error));
  };
  EVENTS.forEach(signal => process.on(signal, listener));

  await server.start();
}

serverCommand.description = 'Start application with HTTP server';
serverCommand.usage = `Usage: APPLICATION server [OPTIONS]

  node index.js server
  node index.js server --level trace
  node index.js server --cluster
  node index.js server -l http://[::1]:3000
  node index.js server -l http://*:8080 -l http://*:8081
  node index.js server -l 'https://*:443?cert=./server.crt&key=./server.key'

  # Run server in production mode
  NODE_ENV=production node index.js server

Options:
  -c, --cluster             Run in cluster mode with multiple processes
  -h, --help                Show this summary of available options
  -L, --level <level>       Log level for application
  -l, --listen <location>   One or more locations you want to listen on,
                            defaults to "http://*:3000"
  -p, --proxy               Activate reverse proxy support
  -w, --workers <num>       Number of workers to spawn in cluster mode,
                            defaults to the number of available CPUs
`;
