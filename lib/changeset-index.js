var view = require('kappa-view')
var through = require('through2')
var umbr = require('unordered-materialized-backrefs')

function createIndex (lvl) {
  return view(lvl, function (db) {
    var br = umbr(db)
    return {
      maxBatch: 100,
      map: function (nodes, next) {
        var ops = nodes
          .reduce(function (accum, node) {
            var version = node.key.toString('hex') + '@' + node.seq
            var id = version + '!' + node.value.id
            var elm = node.value
            var links = (node.value.links||[]).map(function (version) {
              return version + '!' + node.value.id
            })
            if (isDel(node)) {
              accum.push({
                id: id,
                refs: [],
                links: links
              })
            }
            if (elm.changeset) {
              accum.push({
                id: id,
                refs: [elm.changeset],
                links: links
              })
            }
            return accum
          }, [])
        br.batch(ops, next)
      },
      api: {
        get: function (core, id, cb) {
          this.ready(function () {
            br.get(id, function (err, res) {
              if (err && err.notFound) return cb(null, [])
              res = res.map(function (vid) {
                return {
                  id: vid.split('!')[1],
                  version: vid.split('!')[0]
                }
              })
              cb(err, res)
            })
          })
        }
      }
    }
  })
}

module.exports = createIndex

function isDel (node) {
  return node && node.value && !!node.value.deleted
}
