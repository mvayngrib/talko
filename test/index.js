require('sock-plex')
var dgram = require('dgram')
var assert = require('assert')
var Client = require('../lib/messenger')
var msgs = require('./fixtures/strings')

var aPort = 12321
var bPort = 32123
// var aSock = dgram.createSocket('udp4')
// aSock.bind(aPort)
var a = new Client({
  port: bPort,
  localPort: aPort
})

var b = new Client({
  port: aPort,
  localPort: bPort
})

msgs.forEach(a.send, a)

var counter = 0
b.on('data', function (data) {
  data = data.toString()
  console.log('equal', data === msgs[counter++])
  if (counter === msgs.length) {
    b.end()
  }
})

;[a, b].forEach(function (c) {
  ;['end', 'finish', 'close'].forEach(function (event) {
    c.once(event, function () {
      console.log((c === a ? 'a' : 'b'), event)
    })
  })
})

// setInterval(function () {
//   console.log(process._getActiveHandles())
// }, 2000).unref()
