
var Duplex = require('readable-stream').Duplex
var net = require('@tradle/utp')
var duplexify = require('duplexify')
var reemit = require('re-emitter')
// var extend = require('xtend')
var noop = function () {}

module.exports = function (options) {
  var events = {
    end: false,
    finish: false,
    close: false
  }

  var togo = 1 // writable 'close'
  var timeout
  var dup = duplexify(null, null, { allowHalfOpen: false })
  var readable
  var server = net.createServer(function (connection) {
    if (readable) return

    togo++ // readable 'close'
    readable = connection
    stopOnEOS(readable)

    // debugger
    readable.pause()
    dup.setReadable(readable)

    // reemit(readable, dup, ['timeout'])
    readable.on('timeout', function () {
      var now = Date.now()
      var time = Math.min(
        readable._millisSinceLastReceived(),
        writable._millisSinceLastReceived()
      )

      if (time < timeout) {
        // reset timeout
        readable.setTimeout(0) // clear timeout
        readable.setTimeout(timeout - time)
        return
      }

      var args = [].slice.call(arguments)
      args.unshift('timeout')
      dup.emit.apply(dup, args)
    })

    setReadableTimeout()
  })

  if (options.serverSocket) {
    server.listenSocket(options.serverSocket)
  } else {
    server.listen(options.localPort)
  }

  var writable
  if (options.clientSocket) {
    writable = net.connect({
      port: options.port,
      host: options.host,
      socket: options.clientSocket
    })
  } else {
    writable = net.connect(options)
  }

  stopOnEOS(writable)
  reemit(writable, dup, ['delivered'])

  dup.setWritable(writable)
  dup.send = dup.write
  ;['end', 'finish', 'close'].forEach(function (event) {
    dup.once(event, function () {
      // if (event === 'close' && dup.name === 'a') debugger
      events[event] = true
      // if (events.finish && events.end && !events.close) {
      //   finish()
      // }

      // console.log(events)
      // console.log(dup.name, event)
    })
  })

  // setInterval(function () {
  //   console.log(readable && readable._utpState, writable._utpState)
  // }, 2000).unref()

  // var togo = 2
  // server.once('close', stop)
  // writable.once('end', stop)
  // writable.once('finish', stop)
  // writable.once('close', stop)

  dup.setTimeout = function (millis) {
    timeout = millis
    setReadableTimeout()
  }

  return dup

  function stop () {
    closeServer()
    writable.end()
    if (!readable) dup.push(null)
  }

  function stopOnEOS (stream) {
    ;['end', 'finish'].forEach(function (event) {
      stream.once(event, stop)
    })

    stream.once('close', finish)
  }

  function finish () {
    if (--togo === 0 && !events.close) {
      dup.destroy()
    }
  }

  function setReadableTimeout () {
    if (typeof timeout !== 'undefined' && readable) {
      readable.setTimeout(0) // clear timeout
      readable.setTimeout(timeout)
    }
  }

  function closeServer () {
    if (server) {
      server.close()
      server = null
    }
  }

  // function closeDup () {
  //   // if (--togo === 0) {
  //     // dup.end()
  //     dup.destroy()
  //   // }
  // }

  // function ensure (event) {
  //   process.nextTick(function () {
  //     if (!events[event]) dup.emit(event)
  //   })
  // }
}
