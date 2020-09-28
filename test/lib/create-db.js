var kappa = require('kappa-core')
var Osm = require('../..')
var ram = require('random-access-memory')
var level = require('level')
var tmp = require('os').tmpdir()
var path = require('path')

module.exports = createOne
module.exports.two = createTwo

function createOne (opts) {
  const index = opts && opts.index
  var core = kappa(ram, { valueEncoding: 'json' })
  var dir = path.join(tmp, 'kappa-osm-' + String(Math.random()).substring(10))
  return Osm({
    core: core,
    index: index || level(dir),
    storage: function (name, cb) { cb(null, ram()) }
  })
}

function createTwo (cb) {
  var a = createOne()
  a.ready(function () {
    var b = createOne()
    b.ready(function () {
      cb(a, b)
    })
  })
}
