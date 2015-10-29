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

a.name = 'a'

var b = new Client({
  port: aPort,
  localPort: bPort
})

b.name = 'b'

msgs.forEach(function (m) {
  a.send(m)
})

var counter = 0
b.on('data', function (data) {
  data = data.toString()
  counter++
  // console.log('equal', data === msgs[counter++])
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
