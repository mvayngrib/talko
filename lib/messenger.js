
var util = require('util')
var Duplex = require('readable-stream').Duplex
var lps = require('length-prefixed-stream')
var reemit = require('re-emitter')
var Client = require('./client')
var combine = require('stream-combiner2')

module.exports = function messenger (options) {
  var c = new Client(options)
  var encoder = lps.encode()
  var decoder = lps.decode()
  // encoder.pipe(c).pipe(decoder)
  // var combined = duplexify(encoder, decoder)
  var combined = combine(
    encoder,
    c,
    decoder
  )

  combined.send = combined.write

  // ;['end', 'finish', 'close'].forEach(function (event) {
  //   c.once(event, function () {
  //     console.log(options.localPort, '->', options.port, event.toUpperCase())
  //   })

  //   combined.once(event, function () {
  //     console.log('combined', options.localPort, '->', options.port, event.toUpperCase())
  //   })
  // })

  var togo = 2
  var closed
  combined.once('close', function () {
    closed = true
  })

  c.once('close', function () {
    encoder.end()
  })

  ;['end', 'finish'].forEach(function (event) {
    combined.once(event, function () {
      if (--togo === 0 && !closed) {
        process.nextTick(function () {
          combined.emit('close')
        })
      }
    })
  })

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
