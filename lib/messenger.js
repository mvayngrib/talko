
var util = require('util')
var Duplex = require('readable-stream').Duplex
var lps = require('length-prefixed-stream')
var reemit = require('re-emitter')
var Client = require('./client')
var combine = require('stream-combiner2')

module.exports = function messenger (socket, address, port) {
  var c = new Client(socket, address, port)
  var combined = combine(
    lps.encode(),
    c,
    lps.decode()
  )

  combined.close = c.close.bind(c)
  combined.send = combined.write
  return combined
}

// module.exports = Messenger
// util.inherits(Messenger, Duplex)

// function Messenger (socket, address, port) {
//   Duplex.call(this, {
//     allowHalfOpen: false
//   })

//   this._client = new Client(socket, address, port)
//   this._encoder = lps.encode()
//   this._decoder = lps.decode()
//   this._encoder.pipe(this._client).pipe(this._decoder).pipe(this)

//   reemit(this._client, this, ['close', 'error'])
//   reemit(this._decoder, this, ['close', 'error'])
// }

// Messenger.prototype.send = function () {
//   this.write.apply(this, arguments)
// }

// Messenger.prototype._read = function () {
//   // do nothing
// }

// Messenger.prototype._write = function (data) {
//   this._encoder.write(data, 'utf8')
// }

// Messenger.prototype.close = function (cb) {
//   this._client.close(cb)
// }
