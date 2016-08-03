# good-tcp

TCP broadcasting for the Good process monitor with optional TLS support.

[![Build Status](https://travis-ci.org/zefferus/good-tcp.svg?branch=master)](https://travis-ci.org/zefferus/good-tcp)
[![Current Version](https://img.shields.io/npm/v/good-tcp.svg)](https://npmjs.com/package/good-tcp)

Development on **good-tcp** is sponsored by [Sparo Labs](http://www.sparolabs.com/).

## Install

```bash
$ npm install --save good-tcp
```

## Usage

### `new GoodTcp(endpoint, [config])`

Creates a new `GoodTcp` object where:

- `endpoint` - A full path to a remote server to transmit logs.
- `config` - Configuration object:
  - `threshold` - The number of events to hold before transmission. Defaults to `20`. Set to `0` to have every event start transmission immediately. It is recommended to set `threshold` as high as possible to make data transmission more efficient and reduce the number of TCP connections that must be initiated.
  - `tls` - Whether to transmit via TLS. Defaults to `false`.
  - `tlsOptions` - Options to configure the TLS connection. Please see the [Node.js documentation for TLS](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback) for the available options and their defaults.

When `stream` emits an "end" event, `GoodTcp` will transmit any events remaining in it's internal buffer to attempt to prevent data loss.

## Version Compatibility

This plugin extends `Stream.Writable` and is compatible with [Good](https://github.com/hapijs/good) version 7.0 and higher.

***Note:*** This plugin does *not* implement the interface expected by earlier versions of `Good`.

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
