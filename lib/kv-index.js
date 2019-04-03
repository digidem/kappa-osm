var through = require('through2')

function createIndex (kv, ldb) {
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
}

module.exports = createIndex
