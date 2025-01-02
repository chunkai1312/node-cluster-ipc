import cluster, { Worker } from 'cluster';
import { EventEmitter } from 'events';
import { ClusterIPC } from '../src';

jest.mock('cluster', () => ({
  isPrimary: true,
  isMaster: true,
  isWorker: false,
  workers: {} as Record<string, Worker>,
  on: jest.fn(),
}));

describe('ClusterIPC', () => {
  let clusterIPC: ClusterIPC;
  let mockWorker: Worker & EventEmitter;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockWorker = new EventEmitter() as Worker & EventEmitter;
    mockWorker.send = jest.fn();
    // @ts-ignore
    mockWorker.id = 1;
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (cluster.on as jest.Mock).mockImplementation((event: string, callback: Function) => {
      if (event === 'fork') callback(mockWorker);
      if (event === 'online') callback(mockWorker);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Primary Process', () => {
    beforeEach(() => {
      (cluster as any).isPrimary = true;
      (cluster as any).isMaster = true;
      (cluster as any).isWorker = false;
      (cluster as any).workers = { '1': mockWorker };
      clusterIPC = new ClusterIPC();
    });

    it('should initialize as primary', () => {
      expect(clusterIPC.isPrimary).toBe(true);
      expect(clusterIPC.isWorker).toBe(false);
    });

    it('should handle message from worker', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      const messageHandler = jest.fn();
      clusterIPC.on('message', messageHandler);

      mockWorker.emit('message', { channel: testChannel, data: testData });

      expect(messageHandler).toHaveBeenCalledWith(testChannel, testData, mockWorker);
    });

    it('should send message to specific worker with id', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      clusterIPC.send(testChannel, testData, 1);

      expect(mockWorker.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: testData,
      });
    });

    it('should send message to specific worker with custom key', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      clusterIPC.send(testChannel, testData, 'foo');

      expect(mockWorker.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: testData,
      });

      clusterIPC.send(testChannel, testData, 'foo');
      expect(mockWorker.send).toHaveBeenCalledTimes(2);
    });

    it('should send message to a worker when no target specified', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      clusterIPC.send(testChannel, testData);

      expect(mockWorker.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: testData,
      });
    });

    it('should warn when no workers available to send message', () => {
      (cluster as any).workers = undefined;
      clusterIPC.send('test', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ClusterIPC] No workers available to send the message',
      );
    });

    it('should publish message to all workers', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      clusterIPC.publish(testChannel, testData);

      expect(mockWorker.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: testData,
      });
    });

    it('should warn when no workers available to publish message', () => {
      (cluster as any).workers = undefined;
      clusterIPC.publish('test', {});

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ClusterIPC] No workers available to publish the message',
      );
    });
  });

  describe('Worker Process', () => {
    beforeEach(() => {
      (cluster as any).isPrimary = false;
      (cluster as any).isMaster = false;
      (cluster as any).isWorker = true;
      (cluster as any).worker = mockWorker;
      clusterIPC = new ClusterIPC();
    });

    it('should initialize as worker', () => {
      expect(clusterIPC.isPrimary).toBe(false);
      expect(clusterIPC.isWorker).toBe(true);
    });

    it('should handle message from master', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      const messageHandler = jest.fn();
      clusterIPC.on('message', messageHandler);

      mockWorker.emit('message', { channel: testChannel, data: testData });

      expect(messageHandler).toHaveBeenCalledWith(testChannel, testData);
    });

    it('should send message to primary', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      clusterIPC.send(testChannel, testData);

      expect(clusterIPC.worker?.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: testData,
      });
    });

    it('should throw error when trying to publish from worker', () => {
      expect(() => {
        clusterIPC.publish('test', {});
      }).toThrow('Method "publish" can only be called from the primary process');
    });
  });
});
