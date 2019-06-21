var view = require('kappa-view')
var umkv = require('unordered-materialized-kv')
var through = require('through2')

function createIndex (lvl) {
  return view(lvl, function (db) {
    var kv = umkv(db)
    return {
      maxBatch: 100,
      map: function (nodes, next) {
        var ops = nodes
          .filter(function (node) {
            return !!node.value.type
          })
          .reduce(function (accum, node) {
            var version = node.key.toString('hex') + '@' + node.seq
            accum.push({
              id: version,
              key: node.value.type + '!' + node.value.id,
              links: node.value.links
            })
            return accum
          }, [])
        kv.batch(ops, next)
      },
      api: {
        createReadStream: function (core, type, opts) {
          opts = opts || {}
          var xform = through.obj(function (row, _, next) {
            var id = row.key.split('!')[2]
            var versions = row.value.split(',')
            versions.forEach(v => {
              this.push({
                id: id,
                version: v
              })
            })
            next()
          })
          this.ready(function () {
            var key = 'k!' + type + '!'
            opts = Object.assign(opts, {
              gt: key,
              lt: key + '~'
            })
            db.createReadStream(opts).pipe(xform)
          })
          return xform
        }
      }
    }
  })
}

module.exports = createIndex
