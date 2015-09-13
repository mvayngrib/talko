
require('sock-plex')
var dgram = require('dgram')
var Client = require('../lib/client')

var aPort = 12321
var bPort = 54345
var round = 0

function oneRound (cb) {
  var i = 10
  round++
  var a = newClient('a', aPort, bPort)
  var b = newClient('b', bPort, aPort)

  var interval = setInterval(function () {
    if (--i) {
      a.send('hey' + i)
      b.send('yo' + i)
      return
    }

    a.close()
    if (cb) b.once('close', cb)
    clearInterval(interval)
  }, 100)

  function next () {
    setTimeout(cb, 200)
  }
}

function newClient (name, localPort, remotePort) {
  var c = new Client({
    port: remotePort,
    localPort: localPort
  })

  c.once('close', function () {
    console.log(name, 'closed')
  })

  c.on('data', function (data) {
    console.log('ROUND', round, name, 'got', data.toString())
  })

  return c
}

oneRound(oneRound)
