
var Duplex = require('readable-stream').Duplex
var net = require('utp')
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

  var timeout
  var dup = duplexify(null, null, { allowHalfOpen: false })
  var readable
  var server = net.createServer(function (connection) {
    if (readable) return

    readable = connection
    // readable.on('data', noop)
    readable.once('end', function () {
      // console.log(dup.name, 'readable ended')
      // if (dup.name === 'a') debugger
      ensure('end')
      closeServer()
      // dup.destroy()
      writable.end()
    })

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

  reemit(writable, dup, ['delivered'])
  writable.once('finish', function () {
    // console.log(dup.name, 'writable closed')
    ensure('finish')
    closeServer()
  })

  dup.setWritable(writable)
  dup.send = dup.write
  ;['end', 'finish', 'close'].forEach(function (event) {
    dup.once(event, function () {
      // if (event === 'close' && dup.name === 'a') debugger
      events[event] = true
      // console.log(dup.name, event)
    })
  })

  var togo = 2
  server.once('close', closeDup)
  writable.once('close', closeDup)

  dup.setTimeout = function (millis) {
    timeout = millis
    setReadableTimeout()
  }

  return dup

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

  function closeDup () {
    if (--togo === 0) {
      // dup.end()
      dup.destroy()
    }
  }

  function ensure (event) {
    process.nextTick(function () {
      if (!events[event]) dup.emit(event)
    })
  }
}
