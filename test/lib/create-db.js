var kappa = require('kappa-core')
var Osm = require('../..')
var ram = require('random-access-memory')
var level = require('level')
var tmp = require('os').tmpdir()
var path = require('path')

module.exports = createOne
module.exports.two = createTwo

function createOne (opts) {
  opts = opts || {}
  var core = kappa(ram, { valueEncoding: 'json', sparse: opts.sparse })
  var dir = path.join(tmp, 'kappa-osm-' + String(Math.random()).substring(10))
  return Osm({
    core: core,
    index: level(dir),
    storage: function (name, cb) { cb(null, ram()) }
  })
}

function createTwo (opts, cb) {
  if (!cb) {
    cb = opts
    opts = undefined
  }
  var a = createOne(opts)
  a.ready(function () {
    var b = createOne(opts)
    b.ready(function () {
      cb(a, b)
    })
  })
}
