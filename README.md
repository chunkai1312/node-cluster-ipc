# Node Cluster IPC

[![NPM version][npm-image]][npm-url]
[![Build Status][action-image]][action-url]
[![Coverage Status][codecov-image]][codecov-url]

`node-cluster-ipc` is a lightweight Node.js package that simplifies Inter-Process Communication (IPC) for applications using the cluster module. It facilitates message sending, publishing, and requesting between the primary process and worker processes. It also supports request timeout handling and automatic worker selection.

## Features

- Send messages between the primary process and worker processes.
- Publish messages to all available workers from the primary process.
- Support for the Request-Reply pattern with timeout handling.
- Event-driven with support for `message` and `request` events.

## Installation

To install `node-cluster-ipc`, run the following command:

```bash
$ npm install --save node-cluster-ipc
```

## Quick Start

Here’s a quick example demonstrating how to use `node-cluster-ipc`:

```js
const cluster = require('cluster');
const { ClusterIpc } = require('node-cluster-ipc');

const ipc = new ClusterIpc();

if (cluster.isPrimary) {
  cluster.fork();
  cluster.fork();

  ipc.publish('hello-channel', 'Hello, worker!');

  ipc.request('compute-channel', 42)
    .then(response => {
      console.log('[Primary] Worker response:', response);
    })
    .catch(err => {
      console.error('[Primary] Error:', err);
    });

  ipc.on('message', (channel, data) => {
    console.log(`[Primary] Received message on ${channel}:`, data);
  });

  ipc.on('request', (channel, data, reply) => {
    console.log(`[Primary] Received request on ${channel}:`, data);
    reply(data * 2);
  });
} else {
  ipc.on('message', (channel, data) => {
    console.log(`[Worker] Received message on ${channel}:`, data);
  });

  ipc.on('request', (channel, data, reply) => {
    console.log(`[Worker] Received request on ${channel}:`, data);
    reply(data * 2);
  });
}
```

## Usage

### Setup `ClusterIpc`

First, instantiate the `ClusterIpc` class in your primary and worker processes. The constructor accepts an optional `ClusterIpcOptions` parameter for customizing the request timeout.

```javascript
import { ClusterIpc } from 'cluster-ipc';

const ipc = new ClusterIpc({
  requestTimeout: 5000 // Optional, in milliseconds
});
```

### Send Message to Worker

You can send a message to a specific worker by providing the `channel` and `data`. Optionally, specify the `workerId` to target a specific worker.

```javascript
ipc.send('channel-name', { key: 'value' }, workerId);
```

### Publish Message to All Workers

Only the primary process can call `publish`. This will send a message to all available workers.

```javascript
ipc.publish('channel-name', { key: 'value' });
```

### Request/Reply between Processes

You can make requests to workers with `request()`. It returns a `Promise` and handles the timeout automatically.

```javascript
ipc.request('channel-name', { key: 'value' }).then(response => {
  console.log('Response:', response);
}).catch(error => {
  console.error('Error:', error);
});
```

### Handling Messages and Requests

You can listen for messages and requests from workers using the `message` and `request` events. In case of a request, you can provide a response using the callback function.

```javascript
ipc.on('message', (channel, data) => {
  console.log(`Received message on ${channel}:`, data);
});

ipc.on('request', (channel, data, reply) => {
  console.log(`Received request on ${channel}:`, data);
  reply({ responseKey: 'responseValue' });
});
```

## API

### `new ClusterIPC([options])`

Initializes a new `ClusterIPC` instance and sets up either the primary process or the worker process based on the current process type.

- `options`: Configuration options (optional).
  - `requestTimeout`: Timeout for requests in milliseconds (default: `5000`).

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

### `.request(channel, data, [workerId])`

Sends a request to a worker process.

- `channel`: The channel name for the request.
- `data`: The data to send.
- `workerId` *(optional)*: If provided, the request will be sent to the specific worker. Otherwise, it will be sent to a worker in round-robin order.

Returns `Promise` for the response.

### `.isPrimary`

Returns `true` if the process is the primary, otherwise `false`.

### `.isWorker`

Returns `true` if the process is a worker, otherwise `false`.

### `.worker`

Returns a reference to the current worker process (only available in a worker process).

### `.workers`

Returns an object containing all active worker processes (only available in the primary process).

### Event: `'message'`

Listen for messages received by the current process.

- `channel`: The channel of the received message.
- `data`: The data sent by the worker (primary).

### Event: `'request'`

Listen for requests received by the current process and send a response using `reply()`.

- `channel`: The channel of the received message.
- `data`: The data sent by the worker (primary).
- `reply`: Callback to send a response.

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
