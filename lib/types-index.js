var umkv = require('unordered-materialized-kv')
var through = require('through2')

function createIndex (ldb) {
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
          accum.push({
            id: version,
            key: node.value.element.type + '!' + node.value.id,
            links: node.value.links
          })
          return accum
        }, [])
      kv.batch(ops, next)
    },
    storeState: function (state, cb) {
      ldb.put('state', state, { valueEncoding: 'binary' }, cb)
    },
    fetchState: function (cb) {
      ldb.get('state', { valueEncoding: 'binary' }, function (err, state) {
        if (err && err.notFound) cb()
        else if (err) cb(err)
        else cb(null, state)
      })
    },
    clearIndex: function (cb) {
      // TODO: mutex to prevent other view APIs from running?
      var batch = []
      ldb.createKeyStream()
        .pipe(through(function (key, _, next) {
          batch.push({ type: 'del', key: key })
          next()
        }, function (flush) {
          ldb.batch(batch, function () {
            flush()
            cb()
          })
        }))
    },
    api: {
      createReadStream: function (core, type, opts) {
        opts = opts || {}
        var xform = through.obj(function (row, _, next) {
          next(null, {
            id: row.key.split('!')[2],
            version: row.value
          })
        })
        this.ready(function () {
          var key = 'k!' + type + '!'
          opts = Object.assign(opts, {
            gt: key,
            lt: key + '~'
          })
          ldb.createReadStream(opts).pipe(xform)
        })
        return xform
      }
    }
  }
}

module.exports = createIndex
