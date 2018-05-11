var umkv = require('unordered-materialized-kv')
var Index = require('multifeed-index')
var sub = require('subleveldown')
var through = require('through2')
var readonly = require('read-only-stream')
var utils = require('./utils')

function createIndex (log, ldb) {
  var self = this

  this.kv = umkv(ldb)

  this.index = Index({
    log: log,
    maxBatch: 100,
    batch: function (nodes, next) {
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
    }
    // TODO: fetchState, storeState + ldb
  })

  this.index.get = function (id, cb) {
    var res = []

    self.kv.get(id, function (err, versions) {
      if (err && err.notFound) cb(null, [])
      else cb(err, versions)
    })
  }

  return this.index
}

// HyperDbKey -> Id
function idFromKey (key) {
  return key.substring(key.lastIndexOf('/') + 1)
}

module.exports = createIndex
