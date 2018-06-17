var umbkd = require('unordered-materialized-bkd')
var once = require('once')
var concatMap = require('concat-map')

module.exports = function (core, db, kv, storage) {
  var bkd = umbkd({
    storage: storage,
    isLinked: function (id, cb) {
      kv.isLinked(id, cb)
    },
    getPoint: function (key, cb) {
      var parts = key.split('@')
      var value = Buffer.alloc(36)
      value.write(parts[0],0)
      value.writeUInt32BE(parts[1],32)
      core.feed(parts[0], function (err, feed) {
        if (err) return cb(err)
        feed.get(parts[1], function (err, doc) {
          if (err) return cb(err)
          cb(null, {
            point: [doc.lon,doc.lat],
            value: value
          })
        })
      })
    },
    type: {
      point: [ 'float32be', 'float32be' ],
      value: [ 'char[36]' ]
    },
    compare: function (a, b) {
      return a.value[0].equals(b.value[0])
    }
  })
  return {
    maxBatch: 100,
    map: function (ops, next) {
      var batch = ops.filter(isNode).map(function (op) {
        var version = Buffer.alloc(36)
        version.write(op.key,0,'hex')
        version.writeUInt32BE(op.seq,32)
        return {
          type: op.type === 'delete' ? 'delete' : 'insert',
          id: version,
          links: op.value.links,
          point: [op.value.element.lon,op.value.element.lat]
        }
      })
      /*
      var refs = concatMap(ops.filter(hasRefs), function (node) {
        return node.value.element.refs || []
      })
      console.log('refs',refs)
      */
      bkd.batch(batch, next)
    },
    storeState: function (state, cb) {
      db.put('state', state, cb)
    },
    fetchState: function (cb) {
      db.get('state', function (err, state) {
        if (err && err.notFound) cb()
        else if (err) cb(err)
        else cb(null, state)
      })
    },
    api: {
      query: function (core, bbox, opts, cb) {
        if (typeof opts === 'function') {
          cb = opts
        }
        cb = once(cb || noop)
        bkd.query(bbox, function (err, results) {
          if (err) return cb(err)
          var pending = 1
          var docs = []
          var seen = {}
          core.ready(function () {
            results.forEach(eachResult)
            if (--pending === 0) cb(null, docs)
          })
          function eachResult (result) {
            pending++
            var key = result.value[0].slice(0,32).toString('hex')
            var seq = result.value[0].readUInt32BE(32)
            var feed = core._logs.feed(key)
            if (err) return cb(err)
            feed.get(seq, function (err, doc) {
              if (err) return cb(err)
              docs.push(doc)
              pending++
              core.api.refs.get(doc.id, function (err, refs) {
                if (err) return cb(err)
                refs.forEach(function (ref) {
                  if (seen[ref.version]) return
                  seen[ref.version] = true
                  var parts = ref.version.split('@')
                  var rkey = parts[0]
                  var rseq = Number(parts[1])
                  var rfeed = core._logs.feed(rkey)
                  pending++
                  rfeed.get(rseq, function (err, rdoc) {
                    if (err) return cb(err)
                    docs.push(rdoc)
                    if (--pending === 0) cb(null, docs)
                  })
                })
                if (--pending === 0) cb(null, docs)
              })
              if (--pending === 0) cb(null, docs)
            })
          }
        })
      }
    }
  }
  function getFeed () {
  }
}

function isNode (node) {
  return node && node.value && node.value.type === 'osm/element'
    && node.value.element && node.value.element.type === 'node'
}
function hasRefs (node) {
  return node && node.value && node.value.type === 'osm/element'
    && node.value.element && Array.isArray(node.value.element.refs)
    && (node.value.element.type === 'way'
      || node.value.element.type === 'relation')
}
function noop () {}
