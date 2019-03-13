var test = require('tape')
var createDb = require('./lib/create-db')
var collect = require('collect-stream')

test('type: get nodes', function (t) {
  var db = createDb()

  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z'
  }

  var way = {
    type: 'way',
    changeset: '9',
    refs: ['bob', 'dole', 'for', 'prez']
  }

  var relation = {
    type: 'relation',
    changeset: '9',
    tags: {
      waterway: 'river'
    },
    members: [
      {
        type: 'node',
        ref: '101'
      }
    ]
  }

  db.create(node, function (err, elm1) {
    t.ifError(err)
    db.create(way, function (err, elm2) {
      t.ifError(err)
      db.create(relation, function (err, elm3) {
        t.ifError(err)
        collect(db.byType('node'), function (err, res) {
          t.ifError(err)
          t.equal(res.length, 1)
          t.equal(res[0].id, elm1.id)
          t.end()
        })
      })
    })
  })
})
