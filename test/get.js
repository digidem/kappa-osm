var test = require('tape')
var createDb = require('./lib/create-db')

test('get returns error when nothing found', function (t) {
  t.plan(1)

  var db = createDb()

  db.get('notakey', function (err, node) {
    t.same(node.length, 0)
  })
})
