var hyperdb = require('hyperdb')
var hyperosm = require('../..')
var ram = require('random-access-memory')
var Grid = require('grid-point-store')
var memdb = require('memdb')

module.exports = createOne
module.exports.two = createTwo

function createOne (key) {
  var db
  if (key) db = hyperdb(ram, key, { valueEncoding: 'json' })
  else db = hyperdb(ram, { valueEncoding: 'json' })
  return hyperosm({
    db: db,
    index: memdb(),
    pointstore: Grid({ store: memdb(), zoomLevel: 10 })
  })
}

function createTwo (cb) {
  var a = createOne()
  a.db.ready(function () {
    var b = createOne(a.db.key)
    b.db.ready(function () {
      a.db.authorize(b.db.local.key, function () {
        cb(a, b)
      })
    })
  })
}
