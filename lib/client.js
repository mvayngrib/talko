
var util = require('util')
var Duplex = require('readable-stream').Duplex
var debug = require('debug')('talko')
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
      self._server.close()
      self.end()
      self._debug('closed inbound connection')
    })

    c.on('data', self._ondata.bind(self))
  })

  this._server.once('close', function () {
    self.emit('end')
  })

  // this._getAddress(this._connect.bind(this))
  this._connect()

  var togo = 2
  this.once('end', close)
  this.once('finish', close)

  function close () {
    if (--togo === 0) {
      process.nextTick(function () {
        self.emit('close')
      })
    }
  }
}

util.inherits(Client, Duplex)

Client.prototype._debug = function () {
  var args = [].slice.call(arguments)
  args.unshift(this._localPort + ' -> ' + this._port)
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
    self.emit('finish')
  })

  this._cxn.once('close', function () {
    self.end()
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

Client.prototype.destroy =
Client.prototype.end = function (data, enc, cb) {
  if (this._closing || !this._cxn) return

  debugger
  this._closing = true
  this._cxn.end.apply(this._cxn, arguments)
}

// Client.prototype.close = function (cb) {
//   var self = this
//   cb = safe(cb)
//   if (this._closed) return cb()

//   this.once('close', cb)
//   if (this._closing) return

//   this._closing = true
//   var togo = 0
//   if (this._cxn) {
//     togo++
//     this._cxn.once('close', finish)
//     this._cxn.destroy()
//   }

//   if (this._server) {
//     togo++
//     this._server.close(finish)
//   }

//   togo++
//   finish()

//   function finish () {
//     if (--togo) return

//     self._closed = true
//     self._debug('closed')
//     self.emit('close')
//   }
// }
