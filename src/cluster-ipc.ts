import cluster, { Worker } from 'cluster';
import { EventEmitter } from 'events';

interface IPCMessage {
  channel: string;
  data: any;
}

export class ClusterIPC extends EventEmitter {
  private workerIndex = 0;

  constructor() {
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

  send(channel: string, data: any, targetWorker?: Worker): void {
    const message: IPCMessage = { channel, data };

    if (this.isPrimary) {
      const workers = Object.values(this.workers || {}) as Worker[];
      if (targetWorker) {
        targetWorker.send(message);
      } else if (workers.length) {
        const worker = workers[this.workerIndex] as Worker;
        this.workerIndex = (this.workerIndex + 1) % workers.length;
        worker.send(message);
      } else {
        console.warn('[ClusterIPC] No workers available to send the message');
      }
    } else {
      const worker = this.worker as Worker;
      worker.send(message);
    }
  }

  publish(channel: string, data: any): void {
    if (!this.isPrimary) {
      throw new Error('Method "publish" can only be called from the primary process');
    }

    const message: IPCMessage = { channel, data };
    const workers = Object.values(this.workers || {}) as Worker[];

    if (workers.length) {
      workers.forEach(worker => worker.send(message));
    } else {
      console.warn('[ClusterIPC] No workers available to publish the message');
    }
  }

  private setupPrimary(): void {
    cluster.on('online', (worker) => {
      worker.on('message', (msg: IPCMessage) => {
        this.emit('message', msg.channel, msg.data, worker);
      });
    });
  }

  private setupWorker(): void {
    const worker = this.worker as Worker;
    worker.on('message', (msg: IPCMessage) => {
      if (msg) this.emit('message', msg.channel, msg.data);
    });
  }
}
