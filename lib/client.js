
var util = require('util')
var Duplex = require('readable-stream').Duplex
var debug = require('debug')('SymmetricClient')
var safe = require('safecb')
var net = require('utp')

module.exports = Client

function Client (options) {
  var self = this

  Duplex.call(this, {
    allowHalfOpen: false
  })

  this._address = options.address || '127.0.0.1'
  this._port = options.port
  this._localPort = options.localPort
  this._cxn = null
  this._queue = []
  this._server = net.createServer(function (c) {
    var addr = c.address()
    if (addr.port !== self._port || addr.address !== self._address) {
      return c.destroy()
    }

    self._debug('inbound connection')
    c.once('close', function () {
      self.close()
      self._debug('closed inbound connection')
    })

    c.on('data', self._ondata.bind(self))
  })

  // this._getAddress(this._connect.bind(this))
  this._connect()
}

util.inherits(Client, Duplex)

Client.prototype._debug = function () {
  var args = [].slice.call(arguments)
  args.unshift(this._port)
  return debug.apply(null, args)
}

// Client.prototype._getAddress = function (cb) {
//   try {
//     var addr = this._socket.address()
//     this._localPort = addr.port
//     this._localAddress = addr.address
//     cb()
//   } catch (err) {
//     this._socket.once('listening', this._getAddress.bind(this, cb))
//   }
// }

Client.prototype._connect = function () {
  var self = this
  this._server.listen(this._localPort)
  this._cxn = net.connect({
    localPort: this._localPort,
    port: this._port,
    host: this._address
  })

  this._cxn.once('close', function () {
    self.close()
    self._cxn = null
    self._debug('closed outbound connection')
  })

  this._queue.forEach(this.send, this)
}

Client.prototype._ondata = function (data, rinfo) {
  this.push(data)
}

Client.prototype.send =
Client.prototype.write = function (data) {
  if (this._closing) throw new Error('closing')
  if (!this._cxn) return this._queue.push(data)

  Duplex.prototype.write.apply(this, arguments)
}

Client.prototype._read = function () {
  // do nothing
}

Client.prototype._write = function (data, enc, cb) {
  this._cxn.write.apply(this._cxn, arguments)
}

Client.prototype.close = function (cb) {
  var self = this
  cb = safe(cb)
  if (this._closed) return cb()

  this.once('close', cb)
  if (this._closing) return

  this._closing = true
  if (this._cxn) this._cxn.destroy()
  if (this._server) this._server.close(emitClose)
  else emitClose()

  function emitClose () {
    self._closed = true
    self._debug('closed')
    self.emit('close')
  }
}
