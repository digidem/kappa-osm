var kappa = require('kappa-core')
var Osm = require('../..')
var ram = require('random-access-memory')
var memdb = require('memdb')

module.exports = createOne
module.exports.two = createTwo

function createOne () {
  var core = kappa(ram, { valueEncoding: 'json' })
  return Osm({
    core: core,
    index: memdb(),
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
