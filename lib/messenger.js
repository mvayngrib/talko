
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
  var awaitingDelivery = 0
  var combined = combine(
    encoder,
    c,
    decoder
  )

  combined.setMaxListeners(0)
  combined.send = function (msg, enc, ondelivered) {
    if (typeof enc === 'function') {
      ondelivered = enc
      enc = null
    }

    awaitingDelivery++
    var currentlyAwaitingDelivery = awaitingDelivery
    var ret = combined.write(msg, enc)
    combined.on('delivered', onDeliveredOne)
    return ret

    function onDeliveredOne () {
      if (--currentlyAwaitingDelivery === 0) {
        combined.removeListener('delivered', onDeliveredOne)
        if (ondelivered) ondelivered()
      }
    }
  }

  combined.on('data', function (d) {
    var args = [].slice.call(arguments)
    args.unshift('message')
    combined.emit.apply(combined, args)
  })

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
      if (--togo === 0) {
        process.nextTick(function () {
          if (!closed) combined.emit('close')
        })
      }
    })
  })

  combined.setTimeout = c.setTimeout.bind(c)
  reemit(c, combined, ['timeout'])
  var reemitDelivered

  // skip every first of two (which the length prefix, not the data)
  c.on('delivered', function () {
    reemitDelivered = !reemitDelivered
    if (reemitDelivered) {
      var args = [].slice.call(arguments)
      args.unshift('delivered')
      combined.emit.apply(combined, args)
    }
  })

  return combined
}
