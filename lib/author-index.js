var view = require('kappa-view')

function createIndex (lvl) {
  return view(lvl, function (db) {
    return {
      maxBatch: 100,
      map: function (nodes, next) {
        var ops = nodes
          .filter(function (node) {
            return !node.value.links.length
          })
          .reduce(function (accum, node) {
            var authorId = node.key.toString('hex')
            accum.push({
              type: 'put',
              key: node.value.id,
              value: authorId
            })
            return accum
          }, [])
        db.batch(ops, next)
      },
      api: {
        get: function (core, id, cb) {
          db.get(id, function (err, authorId) {
            if (err && err.notFound) cb(null, null)
            else cb(err, authorId)
          })
        }
      }
    }
  })
}

module.exports = createIndex
