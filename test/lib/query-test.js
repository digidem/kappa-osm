var setup = require('./setup')
var collect = require('./collect')

module.exports = function (t, db, data, expected, cb) {
  expected = expected.slice()

  setup(db, data, function (err) {
    t.error(err)

    ;(function next () {
      var q = expected.shift()
      if (!q) return cb()
      var pending = 2

      db.query(q.bbox, function (err, res) {
        t.error(err, 'no error on cb query')
        var ids = res.map(function (elm) { return elm.id }).sort()
        t.deepEquals(ids, q.expected.sort(), 'ids match cb query')
        if (!--pending) next()
      })

      collect(db.query(q.bbox), function (err, res) {
        t.error(err, 'no error on streaming query')
        var ids = res.map(function (elm) { return elm.id }).sort()
        t.deepEquals(ids, q.expected.sort(), 'ids match cb query')
        if (!--pending) next()
      })
    })()
  })
}
