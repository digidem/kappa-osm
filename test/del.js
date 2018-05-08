var test = require('tape')
var createDb = require('./lib/create-db')

test('delete /wo changeset', function (t) {
  t.plan(3)

  var db = createDb()

  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z'
  }

  db.create(node, function (err, elm) {
    t.error(err)
    db.del(elm.id, {}, function (err) {
      t.ok(err instanceof Error)
      t.equals(err.message, 'Deleted elements must have a "changeset" set.')
    })
  })
})

test('delete', function (t) {
  t.plan(4)

  var db = createDb()

  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z'
  }

  db.create(node, function (err, elm) {
    t.error(err)
    db.del(elm.id, { changeset: '10' }, function (err) {
      t.error(err)
      db.get(elm.id, function (err, elms) {
        t.error(err)
        var expected = [
          {
            deleted: true,
            changeset: '10',
            id: elm.id,
            version: elms[0].version
          }
        ]
        t.deepEquals(elms, expected)
      })
    })
  })
})
