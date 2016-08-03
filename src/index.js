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
      this._sendMessages(() => {});
    });
  }


  _write(data, encoding, cb) {

    this._buffer.push(Stringify(data));

    if (this._buffer.length >= this._settings.threshold) {
      this._sendMessages((err) => {

        this._buffer = [];
        return cb(err);
      });
    } else {
      setImmediate(cb);
    }
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
