
var util = require('util')
var Duplex = require('readable-stream').Duplex
var debug = require('debug')('talko')
var safe = require('safecb')
var net = require('utp')
var reemit = require('re-emitter')
var noop = function () {}
var CLOSE_GRACE = 10000

module.exports = Client

function Client (options) {
  var self = this

  Duplex.call(this, {
    allowHalfOpen: false
  })

  this._serverSocket = options.serverSocket
  this._clientSocket = options.clientSocket
  this._streamState = {}
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
      if (!self._server) return

      self._server.close()
      self._server = null
      self._debug('closed inbound connection')
      self.end()
    })

    c.on('data', function (data) {
      self.push(data)
    })

    self._readingFrom = c
    if (self._timeoutMillis) {
      self.setTimeout(self._timeoutMillis)
    }
  })

  this._server.once('close', function () {
    self._debug('server closed')
    // self._debug('pushing null')
    // if (self.name === 'a') debugger
    self.push(null)
  })

  // this._getAddress(this._connect.bind(this))
  this._connect()

  var togo = 2
  this.once('end', function () {
    self._debug('end')
    self._streamState.ended = true
    close()
  })

  this.once('finish', function () {
    self._debug('finish')
    self._streamState.finished = true
    close()
  })

  function close () {
    if (--togo === 0) {
      process.nextTick(function () {
        self._debug('closed')
        self._streamState.closed = true
        self.emit('close')
      })
    }
  }
}

util.inherits(Client, Duplex)

Client.prototype._debug = function () {
  var args = [].slice.call(arguments)
  if (this.name) args.unshift(this.name)
  else args.unshift(this._localPort + ' -> ' + this._port)
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
  if (this._serverSocket) {
    this._server.listenSocket(this._serverSocket)
  } else {
    this._server.listen(this._localPort)
  }

  var cxnOpts = {
    port: this._port,
    host: this._address
  }

  if (this._clientSocket) {
    cxnOpts.socket = this._clientSocket
  } else {
    cxnOpts.localPort = this._localPort
  }

  this._cxn = net.connect(cxnOpts)

  reemit(this._cxn, this, ['delivered'])
  this._cxn.once('close', function () {
    // self.emit('finish')
    // self._cxn = null
    // if (self._server) self._server.close()
    self._debug('closed outbound connection')
    self._cxn = null
    Duplex.prototype.end.apply(self, arguments)
  })

  this._queue.forEach(this.send, this)
}

Client.prototype.send =
Client.prototype.write = function (data) {
  if (this._closing) throw new Error('can\'t write, already closing')
  if (!this._cxn) return this._queue.push(data)

  Duplex.prototype.write.apply(this, arguments)
}

Client.prototype._read = function () {
  // do nothing
}

Client.prototype._write = function (data, enc, cb) {
  this._cxn.write.apply(this._cxn, arguments)
}

Client.prototype.setTimeout = function (millis) {
  this._timeoutMillis = millis
  if (this._readingFrom) {
    this._readingFrom.setTimeout(millis)
    reemit(this._readingFrom, this, ['timeout'])
  }
}

Client.prototype.destroy =
Client.prototype.end = function (data, enc, cb) {
  var self = this
  cb = cb || noop
  if (this._closing || !this._cxn) return

  this._closing = true
  this._cxn.end.apply(this._cxn, arguments)
  if (!this._server) return cb()

  var sTimeout = setTimeout(function () {
    self._server.close()
  }, CLOSE_GRACE)

  sTimeout.unref && sTimeout.unref()
  this._server.once('close', function () {
    clearTimeout(sTimeout)
    cb()
  })
}
