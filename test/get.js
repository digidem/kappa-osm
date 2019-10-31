var test = require('tape')
var createDb = require('./lib/create-db')

test('get returns error when nothing found', function (t) {
  t.plan(1)

  var db = createDb()

  db.get('notakey', function (err, node) {
    t.same(node.length, 0)
  })
})

test('getByVersion', function (t) {
  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z'
  }

  t.plan(3)

  var db = createDb()

  db.create(node, function (err, elm) {
    t.error(err, 'create worked')
    t.equals(elm.timestamp, node.timestamp, 'timestamp preserved')

    db.getByVersion(elm.version, function (err, elm2) {
      t.deepEquals(elm, elm2, 'written & fetched elements match')
    })
  })
})
