# Node Cluster IPC

[![NPM version][npm-image]][npm-url]
[![Build Status][action-image]][action-url]
[![Coverage Status][codecov-image]][codecov-url]

`node-cluster-ipc` is a lightweight Node.js package that simplifies Inter-Process Communication (IPC) for applications using the cluster module. It enables the master process to communicate with worker processes, supporting both targeted messages and broadcasting to all workers.

## Features

- **Primary Process Messaging**: Enables the primary process to send messages to specific worker processes or broadcast messages to all workers.
- **Worker Process Interaction**: Allows worker processes to send messages back to the primary process, enabling two-way communication.
- **Round-robin Message Distribution**: When no specific worker is targeted, the primary process distributes messages to workers in a round-robin manner.
- **Event-driven Messaging**: Utilizes the `EventEmitter` API to handle messages, making it easier to listen for and respond to IPC events.

## Installation

To install `node-cluster-ipc`, run the following command:

```bash
$ npm install --save node-cluster-ipc
```

## Usage

Here’s a quick example demonstrating how to use `node-cluster-ipc`:

```js
const { ClusterIPC } = require('node-cluster-ipc');
const cluster = require('cluster');

const ipc = new ClusterIPC();

if (cluster.isPrimary) {
  cluster.fork();
  cluster.fork();

  ipc.on('message', (channel, data, worker) => {
    console.log(`[Primary] Received message on channel: ${channel}`, data);
    ipc.send('response', { ack: true }, worker.id);
  });

  setTimeout(() => ipc.publish('greeting', { text: 'Hello, Workers!' }), 1000);
} else {
  ipc.on('message', (channel, data) => {
    console.log(`[Worker] Received message on channel: ${channel}`, data);
  });

  ipc.send('status', { workerId: process.pid, status: 'Ready' });
}
```

## API

### `new ClusterIPC()`

Initializes a new `ClusterIPC` instance and sets up either the primary process or the worker process based on the current process type.

```js
const ipc = new ClusterIPC();
```

### `.send(channel, data, [workerId])`

Sends a message to a worker process.

- `channel`: The channel name for the message.
- `data`: The data to send.
- `workerId` *(optional)*: If provided, the message will be sent to the specific worker. Otherwise, it will be sent to a worker in round-robin order.

### `.publish(channel, data)`

Publishes a message to all active workers (only available in the primary process).

- `channel`: The channel name for the message.
- `data`: The data to publish.

### `.isPrimary`

Returns `true` if the process is the primary, otherwise `false`.

### `.isWorker`

Returns `true` if the process is a worker, otherwise `false`.

### `.worker`

Returns a reference to the current worker process (only available in a worker process).

### `.workers`

Returns an object containing all active worker processes (only available in the primary process).

### Event: `'message'`

Emitted when a message is received from a worker process or the primary process. Listeners can handle messages by channel.

- `channel`: The channel of the received message.
- `data`: The data sent by the worker (primary).
- `worker` *(optional)*: The worker that sent the message (available when receiving from primary).

## Changelog

[Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-cluster-ipc.svg
[npm-url]: https://npmjs.com/package/node-cluster-ipc
[action-image]: https://img.shields.io/github/actions/workflow/status/chunkai1312/node-cluster-ipc/node.js.yml?branch=main
[action-url]: https://github.com/chunkai1312/node-cluster-ipc/actions/workflows/node.js.yml
[codecov-image]: https://img.shields.io/codecov/c/github/chunkai1312/node-cluster-ipc.svg
[codecov-url]: https://codecov.io/gh/chunkai1312/node-cluster-ipc
