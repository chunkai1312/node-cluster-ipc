import cluster, { Worker } from 'cluster';
import { EventEmitter } from 'events';
import { ClusterIpc } from '../src';

jest.mock('cluster', () => ({
  isPrimary: true,
  isMaster: true,
  isWorker: false,
  workers: {} as Record<string, Worker>,
  on: jest.fn(),
}));

describe('ClusterIpc', () => {
  let clusterIpc: ClusterIpc = new ClusterIpc();
  let mockWorker: Worker & EventEmitter;

  beforeEach(() => {
    mockWorker = new EventEmitter() as Worker & EventEmitter;
    mockWorker.send = jest.fn();
    mockWorker.id = 1;
    (cluster.on as jest.Mock).mockImplementation((event: string, callback: Function) => {
      if (event === 'online') callback(mockWorker);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Primary Process', () => {
    beforeEach(() => {
      Object.assign(cluster, {
        isPrimary: true,
        isMaster: true,
        isWorker: false,
        workers: { '1': mockWorker },
      });
      clusterIpc = new ClusterIpc({ requestTimeout: 1000 });
    });

    it('should initialize as the primary process', () => {
      expect(clusterIpc.isPrimary).toBe(true);
      expect(clusterIpc.isWorker).toBe(false);
    });

    it('should handle incoming messages from worker', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      const messageHandler = jest.fn();
      clusterIpc.on('message', messageHandler);

      mockWorker.emit('message', { channel: testChannel, data: testData });

      expect(messageHandler).toHaveBeenCalledWith(testChannel, testData);
    });

    it('should handle requests from worker', async () => {
      const testChannel = 'test';
      const requestData = { foo: 'bar' };
      const responseData = { baz: 'qux' };
      const requestId = '123';

      const requestHandler = jest.fn((channel, data, reply) => {
        reply(responseData);
      });

      clusterIpc.on('request', requestHandler);

      mockWorker.emit('message', {
        channel: testChannel,
        data: requestData,
        requestId: requestId,
      });

      expect(requestHandler).toHaveBeenCalled();
      expect(mockWorker.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: responseData,
        requestId: requestId,
        isReply: true,
      });
    });

    describe('send()', () => {
      it('should send a message to a worker', () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        clusterIpc.send(testChannel, testData);

        expect(mockWorker.send).toHaveBeenCalledWith({
          channel: testChannel,
          data: testData,
        });
      });

      it('should send a message to a specific worker by id', () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        clusterIpc.send(testChannel, testData, 1);

        expect(mockWorker.send).toHaveBeenCalledWith({
          channel: testChannel,
          data: testData,
        });
      });

      it('should send a message to a specific worker using a custom key', () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        clusterIpc.send(testChannel, testData, 'foo');

        expect(mockWorker.send).toHaveBeenCalledWith({
          channel: testChannel,
          data: testData,
        });

        clusterIpc.send(testChannel, testData, 'foo');
        expect(mockWorker.send).toHaveBeenCalledTimes(2);
      });

      it('should throw an error when no workers are available', () => {
        (cluster as any).workers = undefined;
        const testChannel = 'test';
        const testData = { foo: 'bar' };

        expect(() => {
          clusterIpc.send(testChannel, testData);
        }).toThrow('No workers available');
      });
    });

    describe('publish()', () => {
      it('should publish a message to all workers', () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        clusterIpc.publish(testChannel, testData);

        expect(mockWorker.send).toHaveBeenCalledWith({
          channel: testChannel,
          data: testData,
        });
      });

      it('should throw an error when no workers are available', () => {
        (cluster as any).workers = undefined;
        const testChannel = 'test';
        const testData = { foo: 'bar' };

        expect(() => {
          clusterIpc.publish(testChannel, testData);
        }).toThrow('No workers available');
      });
    });

    describe('request()', () => {
      it('should send a request to a worker and handle the response', async () => {
        const testChannel = 'test';
        const requestData = { foo: 'bar' };
        const responseData = { baz: 'qux' };

        const requestPromise = clusterIpc.request(testChannel, requestData);

        const message = (mockWorker.send as jest.Mock).mock.calls[0][0];
        expect(message.channel).toBe(testChannel);
        expect(message.data).toEqual(requestData);
        expect(message.requestId).toBeDefined();

        mockWorker.emit('message', {
          channel: testChannel,
          data: responseData,
          requestId: message.requestId,
          isReply: true,
        });

        const response = await requestPromise;
        expect(response).toEqual(responseData);
      });

      it('should throw an error if request times out ', async () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        const requestPromise = clusterIpc.request(testChannel, testData);

        await expect(requestPromise).rejects.toThrow('Request timeout');
      });

      it('should throw an error when no workers are available', async () => {
        (cluster as any).workers = undefined;
        const testChannel = 'test';
        const testData = { foo: 'bar' };

        await expect(clusterIpc.request(testChannel, testData)).rejects.toThrow('No workers available');
      });
    });
  });

  describe('Worker Process', () => {
    beforeEach(() => {
      Object.assign(cluster, {
        isPrimary: false,
        isMaster: false,
        isWorker: true,
        worker: mockWorker,
      });
      clusterIpc = new ClusterIpc({ requestTimeout: 1000 });
    });

    it('should initialize as a worker', () => {
      expect(clusterIpc.isPrimary).toBe(false);
      expect(clusterIpc.isWorker).toBe(true);
    });

    it('should handle incoming messages from primary', () => {
      const testChannel = 'test';
      const testData = { foo: 'bar' };
      const messageHandler = jest.fn();
      clusterIpc.on('message', messageHandler);

      mockWorker.emit('message', { channel: testChannel, data: testData });

      expect(messageHandler).toHaveBeenCalledWith(testChannel, testData);
    });

    it('should handle requests from primary', async () => {
      const testChannel = 'test';
      const requestData = { foo: 'bar' };
      const responseData = { result: 'success' };
      const requestId = '123';
      const requestHandler = jest.fn((channel, data, reply) => {
        reply({ result: 'success' });
      });

      clusterIpc.on('request', requestHandler);

      mockWorker.emit('message', {
        channel: testChannel,
        data: requestData,
        requestId: requestId,
      });

      expect(requestHandler).toHaveBeenCalled();
      expect(mockWorker.send).toHaveBeenCalledWith({
        channel: testChannel,
        data: responseData,
        requestId: requestId,
        isReply: true,
      });
    });

    describe('send()', () => {
      it('should send a message to the primary process', () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        clusterIpc.send(testChannel, testData);

        expect(clusterIpc.worker?.send).toHaveBeenCalledWith({
          channel: testChannel,
          data: testData,
        });
      });
    });

    describe('publish()', () => {
      it('should throw an error when attempting to publish from worker', () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };

        expect(() => {
          clusterIpc.publish(testChannel, testData);
        }).toThrow('Method "publish" can only be called from the primary process');
      });
    });

    describe('request()', () => {
      it('should send a request to the primary and handle the response', async () => {
        const testChannel = 'test';
        const requestData = { foo: 'bar' };
        const responseData = { baz: 'qux' };

        const requestPromise = clusterIpc.request(testChannel, requestData);

        const message = (mockWorker.send as jest.Mock).mock.calls[0][0];
        expect(message.channel).toBe(testChannel);
        expect(message.data).toEqual(requestData);
        expect(message.requestId).toBeDefined();

        mockWorker.emit('message', {
          channel: testChannel,
          data: responseData,
          requestId: message.requestId,
          isReply: true,
        });

        const response = await requestPromise;
        expect(response).toEqual(responseData);
      });

      it('should throw an error if request times out', async () => {
        const testChannel = 'test';
        const testData = { foo: 'bar' };
        const requestPromise = clusterIpc.request(testChannel, testData);

        await expect(requestPromise).rejects.toThrow('Request timeout');
      });
    });
  });
});
