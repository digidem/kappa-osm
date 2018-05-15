var umkv = require('unordered-materialized-kv')
var sub = require('subleveldown')
var through = require('through2')
var readonly = require('read-only-stream')
var utils = require('./utils')

function createIndex (ldb) {
  var self = this

  var kv = umkv(ldb)

  return {
    maxBatch: 100,
    map: function (nodes, next) {
      var ops = nodes
        .filter(function (node) {
          return node.value.type === 'osm/element'
        })
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
        var res = []
        this.ready(function () {
          kv.get(id, function (err, versions) {
            if (err && err.notFound) cb(null, [])
            else cb(err, versions)
          })
        })
      }
    }
    // TODO: fetchState, storeState + ldb
  }
}

module.exports = createIndex
