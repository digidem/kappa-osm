var multifeed = require('multifeed')
var hypercore = require('hypercore')
var Osm = require('../..')
var ram = require('random-access-memory')
var Grid = require('grid-point-store')
var memdb = require('memdb')

module.exports = createOne
module.exports.two = createTwo

function createOne () {
  var logs = multifeed(hypercore, ram, { valueEncoding: 'json' })
  return Osm({
    logs: logs,
    index: memdb(),
    spatial: Grid({ store: memdb(), zoomLevel: 10 })
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
