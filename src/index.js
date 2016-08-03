'use strict';

const Stream = require('stream');
const Url = require('url');
const Tls = require('tls');
const Net = require('net');

const Hoek = require('hoek');
const Stringify = require('fast-safe-stringify');

const internals = {
  defaults: {
    threshold: 20,
    maxDelay: 0,
    tls: false,
    tlsOptions: {}
  }
};


class GoodTcp extends Stream.Writable {
  constructor(endpoint, config) {

    super({ objectMode: true, decodeStrings: false });

    config = config || {};
    this._settings = Hoek.applyToDefaults(internals.defaults, config);
    this._endpoint = Url.parse(endpoint);

    if (!this._endpoint.hostname || !this._endpoint.port) {
      throw new Error('`endpoint` must be a valid URL string with hostname and port');
    }

    this._buffer = [];

    // Send last messages on your way out
    this.once('finish', () => {
      if (this._buffer.length) {
        this._sendMessages(() => {});
      }
    });
  }


  _write(data, encoding, cb) {

    this._buffer.push(Stringify(data));

    if (this._bufferReady) {

      this._sendMessages((err) => {

        this._bufferStart = null;
        this._buffer = [];
        return cb(err);
      });
    } else {

      if (!this._bufferStart) {
        this._bufferStart = Date.now();
      }

      setImmediate(cb);
    }
  }


  get _bufferReady() {

    if (this._buffer.length >= this._settings.threshold) {
      // Buffer is full
      return true;
    }

    if (this._settings.maxDelay > 0 && this._bufferStart &&
      Date.now() - this._bufferStart > this._settings.maxDelay) {

      // Max wait time exceeded
      return true;
    }

    return false;
  }


  _sendMessages(cb) {

    this._openClient((client) => {

      const message = this._buffer.join('\r\n');

      client.write(message, 'utf8', () => {
        client.end();
        cb();
      });
    });
  }


  _openClient(cb) {

    let client;

    const connectListener = () => {
      cb(client);
    };

    if (this._settings.tls) {
      client = Tls.connect(this._endpoint.port,
        this._endpoint.hostname,
        this._settings.tlsOptions,
        connectListener);
    } else {
      client = Net.connect(this._endpoint.port,
        this._endpoint.hostname,
        connectListener);
    }
  }
}

module.exports = GoodTcp;
