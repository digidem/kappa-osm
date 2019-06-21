var view = require('kappa-view')
var through = require('through2')

function createIndex (kv, lvl) {
  return view(lvl, function (db) {
    return {
      maxBatch: 100,
      map: function (nodes, next) {
        var ops = nodes
          .reduce(function (accum, node) {
            var version = node.key.toString('hex') + '@' + node.seq
            accum.push({  // index id
              id: version,
              key: node.value.id,
              links: node.value.links
            })
            return accum
          }, [])
        kv.batch(ops, next)
      },
      api: {
        get: function (core, id, cb) {
          this.ready(function () {
            kv.get(id, function (err, versions) {
              if (err && err.notFound) cb(null, [])
              else cb(err, versions)
            })
          })
        }
      }
    }
  })
}

module.exports = createIndex
