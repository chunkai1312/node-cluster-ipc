import cluster, { Worker } from 'cluster';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

interface IpcMessage {
  channel: string;
  data: any;
  requestId?: string;
  isReply?: boolean;
}

interface ClusterIpcOptions {
  requestTimeout?: number;
}

export class ClusterIpc extends EventEmitter {
  private workerIndex = 0;
  private workerMap: Map<string, number> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(private options: ClusterIpcOptions = { requestTimeout: 5000 }) {
    super();
    this.isPrimary ? this.setupPrimary() : this.setupWorker();
  }

  get isPrimary() {
    return cluster.isPrimary || cluster.isMaster;
  }

  get isWorker() {
    return cluster.isWorker;
  }

  get worker() {
    return cluster.worker;
  }

  get workers() {
    return cluster.workers;
  }

  send(channel: string, data: any, workerId?: number | string): void {
    const message: IpcMessage = { channel, data };
    const worker = this.isPrimary ? this.getWorker(workerId) : this.worker;
    if (worker) worker.send(message);
  }

  publish(channel: string, data: any) {
    if (!this.isPrimary) {
      throw new Error('Method "publish" can only be called from the primary process');
    }

    const message: IpcMessage = { channel, data };
    const workers = Object.values(this.workers || {}) as Worker[];

    if (workers.length) {
      workers.forEach(worker => worker.send(message));
    } else {
      throw new Error('No workers available');
    }
  }

  async request(channel: string, data: any, workerId?: number | string): Promise<any> {
    const requestId = randomUUID();
    const message: IpcMessage = { channel, data, requestId };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const request = this.pendingRequests.get(requestId);
        if (request) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, this.options.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        const worker = this.isPrimary ? this.getWorker(workerId) : this.worker;
        if (worker) worker.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  private reply(channel: string, data: any, requestId: string, workerId?: number | string): void {
    const message: IpcMessage = { channel, data, requestId, isReply: true };
    const worker = this.isPrimary ? this.getWorker(workerId) : this.worker;
    if (worker) worker.send(message);
  }

  private setupPrimary(): void {
    cluster.on('online', (worker) => {
      worker.on('message', (msg: IpcMessage) => this.handleMessage(msg, worker));
    });
  }

  private setupWorker(): void {
    const worker = this.worker as Worker;
    worker.on('message', (msg: IpcMessage) => this.handleMessage(msg, worker));
  }

  private handleMessage(msg: IpcMessage, worker: Worker): void {
    if (msg.isReply && msg.requestId) {
      const request = this.pendingRequests.get(msg.requestId);
      if (request) {
        clearTimeout(request.timeout);
        this.pendingRequests.delete(msg.requestId);
        request.resolve(msg.data);
      }
    } else if (msg.requestId) {
      this.emit('request', msg.channel, msg.data, (response: any) => {
        this.reply(msg.channel, response, msg.requestId!, worker.id);
      });
    } else {
      this.emit('message', msg.channel, msg.data);
    }
  }

  private getWorker(id?: number | string): Worker | undefined {
    const workers = Object.values(this.workers || {}) as Worker[];

    if (workers.length === 0) {
      throw new Error('No workers available')
    }

    if (id !== undefined) {
      const worker = (this.workers as NodeJS.Dict<Worker>)[id];
      if (worker) return worker;

      const workerId = this.workerMap.get(String(id));
      if (workerId !== undefined) {
        const worker = (this.workers as NodeJS.Dict<Worker>)[workerId];
        if (worker) return worker;
      }
    }

    const worker = workers[this.workerIndex] as Worker;
    this.workerIndex = (this.workerIndex + 1) % workers.length;
    this.workerMap.set(String(id), worker.id);

    return worker;
  }
}
