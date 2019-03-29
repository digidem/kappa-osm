var through = require('through2')
var umbr = require('unordered-materialized-backrefs')

function createIndex (ldb) {
  var br = umbr(ldb)
  return {
    maxBatch: 100,
    map: function (nodes, next) {
      var ops = nodes
        .reduce(function (accum, node) {
          var version = node.key.toString('hex') + '@' + node.seq
          var id = version + '!' + node.value.id
          var elm = node.value
          var links = node.value.links.map(function (version) {
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
    }
  }
}

module.exports = createIndex

function isDel (node) {
  return node && node.value && !!node.value.deleted
}
