'use strict';

const Net = require('net');
const Tls = require('tls');
const Fs = require('fs');
const Stream = require('stream');

const Tap = require('tap');
const describe = Tap.test;

const Sinon = require('sinon');

const GoodTcp = require('..');

let sandbox;
const noop = () => {};

Tap.beforeEach(() => {
  sandbox = Sinon.sandbox.create();

  return Promise.resolve();
});


Tap.afterEach(() => {
  sandbox && sandbox.restore();

  return Promise.resolve();
});


function startTcpServer(port, listener, cb) {
  const server = Net.createServer(listener);

  server.listen(port, () => {
    cb();
  });

  return server;
}


function startTlsServer(port, listener, cb) {
  const server = Tls.createServer({
    key: Fs.readFileSync('./test/server.key'),
    cert: Fs.readFileSync('./test/server.crt'),
    rejectUnauthorized: false
  }, listener);

  server.listen(port, () => {
    cb();
  });

  return server;
}


function createReadStream() {
  const stream = new Stream.Readable({ objectMode: true });
  stream._read = noop;
  return stream;
}


describe('GoodTcp.', (tap) => {

  tap.test('Creates the stream without options.', (t) => {
    t.plan(1);

    const stream = new GoodTcp('tcp://localhost:54545');
    t.ok(stream);

    t.end();
  });


  tap.test('Errors on invalid endpoint', (t) => {
    t.plan(1);

    t.throws(() => { new GoodTcp('this.will.never.succeed'); });

    t.end();
  });


  tap.test('Honors threshold.', (t) => {
    t.plan(4);

    const stream = createReadStream();

    let hitCount = 0;

    const listener = (socket) => {

      socket.on('data', (message) => {
        hitCount++;

        const events = message.toString('utf8').split('\r\n');
        t.equals(events.length, 3);

        const initialEvent = JSON.parse(events[0]);

        switch (hitCount) {
          case 1:
            t.equals(initialEvent.id, 0);
            break;

          case 2:
            t.equals(initialEvent.id, 3);
            server.close();

            t.end();
        }
      });
    };

    const server = startTcpServer(54545, listener, () => {
      const reporter = new GoodTcp('tcp://localhost:54545', {
        threshold: 3
      });

      stream.pipe(reporter);

      for (let i = 0; i < 6; ++i) {

        stream.push({ id: i });
      }

      stream.push(null);
    });
  });


  tap.test('Sends individually if threshold 0.', (t) => {
    t.plan(4);

    const stream = createReadStream();

    let hitCount = 0;

    const listener = (socket) => {

      socket.on('data', (message) => {
        hitCount++;

        const events = message.toString('utf8').split('\r\n');
        t.equals(events.length, 1);

        const initialEvent = JSON.parse(events[0]);

        switch (hitCount) {
          case 1:
            t.equals(initialEvent.id, 0);
            break;

          case 2:
            t.equals(initialEvent.id, 1);
            server.close();

            t.end();
        }
      });
    };

    const server = startTcpServer(54545, listener, () => {
      const reporter = new GoodTcp('tcp://localhost:54545', {
        threshold: 0
      });

      stream.pipe(reporter);

      for (let i = 0; i < 2; ++i) {

        stream.push({ id: i });
      }

      stream.push(null);
    });
  });


  tap.test('Handles circular object references safely.', (t) => {
    t.plan(3);

    const stream = createReadStream();

    let hitCount = 0;

    const listener = (socket) => {

      socket.on('data', (message) => {
        hitCount++;

        const events = message.toString('utf8').split('\r\n');
        t.equals(events.length, 1);

        const initialEvent = JSON.parse(events[0]);

        t.equals(initialEvent.id, 0);
        t.equals(initialEvent._circle, '[Circular]');

        server.close();
        t.end();
      });
    };

    const server = startTcpServer(54545, listener, () => {
      const reporter = new GoodTcp('tcp://localhost:54545', {
        threshold: 0
      });

      stream.pipe(reporter);

      const data = {
        event: 'log',
        timestamp: Date.now(),
        id: 0
      };

      data._circle = data;

      stream.push(data);

      stream.push(null);
    });
  });


  tap.test('Dumps any unsent entries on "finish".', (t) => {
    t.plan(2);

    const stream = createReadStream();

    let hitCount = 0;

    const listener = (socket) => {

      socket.on('data', (message) => {
        hitCount++;

        const events = message.toString('utf8').split('\r\n');
        t.equals(events.length, 2);

        const initialEvent = JSON.parse(events[0]);

        t.equals(initialEvent.id, 0);

        server.close();
        t.end();
      });
    };

    const server = startTcpServer(54545, listener, () => {
      const reporter = new GoodTcp('tcp://localhost:54545', {
        threshold: 5
      });

      stream.pipe(reporter);

      stream.push({
        event: 'log',
        timestamp: Date.now(),
        id: 0
      });

      stream.push({
        event: 'log',
        timestamp: Date.now(),
        id: 1
      });

      stream.push(null);
    });
  });


  tap.test('Opens TLS connection with option.', (t) => {
    t.plan(4);

    const stream = createReadStream();

    let hitCount = 0;

    const listener = (socket) => {

      socket.on('data', (message) => {
        hitCount++;

        const events = message.toString('utf8').split('\r\n');
        t.equals(events.length, 1);

        const initialEvent = JSON.parse(events[0]);

        switch (hitCount) {
          case 1:
            t.equals(initialEvent.id, 0);
            break;

          case 2:
            t.equals(initialEvent.id, 1);
            server.close();

            t.end();
        }
      });
    };

    const server = startTlsServer(54545, listener, () => {
      const reporter = new GoodTcp('tcp://localhost:54545', {
        threshold: 0,
        tls: true,
        tlsOptions: {
          rejectUnauthorized: false
        }
      });

      stream.pipe(reporter);

      for (let i = 0; i < 2; ++i) {

        stream.push({ id: i });
      }

      stream.push(null);
    });
  });


  tap.test('Sends before buffer full if max wait time exceeded.', (t) => {

    t.plan(2);

    const stream = createReadStream();

    let hitCount = 0;

    const listener = (socket) => {

      socket.on('data', (message) => {
        hitCount++;

        const events = message.toString('utf8').split('\r\n');
        t.equals(events.length, 3);

        const initialEvent = JSON.parse(events[0]);

        switch (hitCount) {
          case 1:
            t.equals(initialEvent.id, 0);

            server.close();

            t.end();
        }
      });
    };

    const server = startTcpServer(54545, listener, () => {
      const reporter = new GoodTcp('tcp://localhost:54545', {
        threshold: 100,
        maxDelay: 200
      });

      stream.pipe(reporter);

      stream.push({ id: 0 });
      stream.push({ id: 1 });

      setTimeout(() => {
        stream.push({ id: 2 });
        stream.push(null);
      }, 500);
    });
  });

  tap.end();
});
