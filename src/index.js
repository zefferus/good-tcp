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
    maxRetries: 3,
    retryInterval: 10000,
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
    this._remainingAttempts = this._settings.maxRetries;
    this._connecting = false;

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

    if (this._bufferReady && !this._connecting) {

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

    if (this._remainingAttempts <= 0) {
      return cb();
    }

    this._openClient((client) => {

      if (!client) {
        cb();
      } else {
        const message = this._buffer.join('\r\n');

        client.write(message, 'utf8', () => {
          client.end();
          cb();
        });
      }
    });
  }


  _openClient(cb) {

    const that = this;
    that._connecting = true;

    let client;

    const connectListener = () => {
      that._connecting = false;
      cb(client);
    };

    if (that._remainingAttempts <= 0) {
      that._connecting = false;
      return cb();
    }

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

    client.on('error', (err) => {
      that._remainingAttempts--;
      console.warn(`Received error whilst connecting to TCP logger: ${err.message}. ${this._remainingAttempts} attempts remaining.`);
      if (that._remainingAttempts > 0) {
        setTimeout(() => {
          that._openClient(cb);
        }, that._settings.retryInterval);
      } else {
        that._connecting = false;
        cb();
      }
    });
  }
}

module.exports = GoodTcp;
