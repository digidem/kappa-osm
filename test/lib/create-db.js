var multifeed = require('multifeed')
var hypercore = require('hypercore')
var Osm = require('../..')
var ram = require('random-access-memory')
var Grid = require('grid-point-store')
var memdb = require('memdb')

module.exports = createOne
module.exports.two = createTwo

function createOne () {
  var log = multifeed(hypercore, ram, { valueEncoding: 'json' })
  return Osm({
    log: log,
    index: memdb(),
    spatial: Grid({ store: memdb(), zoomLevel: 10 })
  })
}

function createTwo (cb) {
  var a = createOne()
  a.db.ready(function () {
    var b = createOne(a.db.key)
    b.db.ready(function () {
      cb(a, b)
    })
  })
}
