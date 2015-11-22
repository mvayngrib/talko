
var util = require('util')
var Duplex = require('readable-stream').Duplex
var lps = require('length-prefixed-stream')
var reemit = require('re-emitter')
var Client = require('./client2')
var combine = require('stream-combiner2')
var debug = require('debug')('talko-msgr')
var UINT32 = 0xffffffff

module.exports = function messenger (options) {
  var CALLBACK_ID = 0
  var c = new Client(options)
  var clientClosed
  var encoder = lps.encode()
  var decoder = lps.decode()
  var awaitingDelivery = 0
  var deliveryCallbacks = {}
  var combined = combine(
    encoder,
    c,
    decoder
  )

  combined.setMaxListeners(0)
  var numSent = 0
  var numDelivered = 0
  var numDeliveredEvents = 0
  combined.send = function (msg, enc, ondelivered) {
    if (typeof enc === 'function') {
      ondelivered = enc
      enc = null
    }

    numSent++
    awaitingDelivery++
    deliveryCallbacks[nextId()] = {
      count: awaitingDelivery,
      fn: ondelivered
    }

    return combined.write(msg, enc)
  }

  combined.on('delivered', function () {
    awaitingDelivery--
    Object.keys(deliveryCallbacks).forEach(function (cbId) {
      var cbInfo = deliveryCallbacks[cbId]
      if (--cbInfo.count === 0) {
        delete deliveryCallbacks[cbId]
        if (cbInfo.fn) cbInfo.fn()
      }
    })
  })

  combined.on('data', function (d) {
    var args = [].slice.call(arguments)
    args.unshift('message')
    combined.emit.apply(combined, args)
  })

  var closeTimeout
  var togo = 2
  var closed
  combined.once('close', function () {
    closed = true
  })

  c.once('close', function () {
    clientClosed = true
    encoder.end()
    decoder.end()
  })

  ;['end', 'finish'].forEach(function (event) {
    combined.once(event, function () {
      if (--togo) return

      if (!clientClosed) {
        c.once('close', emitClose)
        closeTimeout = setTimeout(emitClose, 5000)
      } else {
        emitClose()
      }
    })
  })

  // var events = {}
  // ;['end', 'finish', 'close'].forEach(function (event) {
  //   combined.once(event, function () {
  //     // if (event === 'close' && dup.name === 'a') debugger
  //     events[event] = true
  //     // if (events.finish && events.end && !events.close) {
  //     //   finish()
  //     // }

  //     console.log(events)
  //     // console.log(dup.name, event)
  //   })
  // })

  // setInterval(function () {
  //   console.log(events)
  // }, 2000).unref()

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

  function nextId () {
    return '' + (CALLBACK_ID++ & UINT32)
  }

  function emitClose () {
    clearTimeout(closeTimeout)
    process.nextTick(function () {
      if (!closed) {
        combined.emit('close')
      }
    })
  }
}
