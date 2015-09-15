
var Duplex = require('readable-stream').Duplex
var net = require('utp')
var duplexify = require('duplexify')
var noop = function () {}

module.exports = function (options) {
  var events = {
    end: false,
    finish: false,
    close: false
  }

  var dup = duplexify(null, null, { allowHalfOpen: false })
  var readable
  var server = net.createServer(function (connection) {
    if (readable) return

    readable = connection
    // readable.on('data', noop)
    readable.once('end', function () {
      // console.log(dup.name, 'readable closed')
      // if (dup.name === 'a') debugger
      if (!events.end) dup.emit('end')

      closeServer()
      // dup.destroy()
      writable.end()
    })

    // debugger
    dup.setReadable(readable)
    // readable.resume()
  })

  server.listen(options.localPort)

  var writable = net.connect({
    localPort: options.localPort,
    port: options.port,
    host: options.address
  })

  writable.once('finish', function () {
    // console.log(dup.name, 'writable closed')
    if (!events.finish) dup.emit('finish')

    closeServer()
  })

  dup.setWritable(writable)
  dup.send = dup.write
  ;['end', 'finish', 'close'].forEach(function (event) {
    dup.once(event, function () {
      events[event] = true
      // console.log(dup.name, event)
    })
  })

  var togo = 2
  server.once('close', closeDup)
  writable.once('close', closeDup)

  return dup

  function closeServer () {
    if (server) {
      server.close()
      server = null
    }
  }

  function closeDup () {
    if (--togo === 0) dup.destroy()
  }
}
