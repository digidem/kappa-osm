var umbkd = require('unordered-materialized-bkd')
var concatMap = require('concat-map')
var duplexify = require('duplexify')
var through = require('through2')
var collect = require('collect-stream')
var toStream = require('pull-stream-to-stream')
var pump = require('pump')
var once = require('once')

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
      var feed = core._logs.feed(parts[0])
      feed.ready(function () {
        feed.get(parts[1], { wait: false }, function (err, doc) {
          //if (err) return cb(err)
          if (!doc || !doc.element) return cb(null, null)
          cb(null, {
            point: [Number(doc.element.lon),Number(doc.element.lat)],
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
    _bkd: bkd,
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
          point: [
            Number(op.value.element.lon),
            Number(op.value.element.lat)
          ]
        }
      })
      /*
      var refs = concatMap(ops.filter(hasRefs), function (node) {
        return node.value.element.refs || []
      })
      console.log('refs',refs)
      */
      //bkd.batch(batch, next)
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
        var d = duplexify.obj()
        if (typeof opts === 'function') {
          cb = opts
        }
        if (cb) d.once('error', cb)
        if (!Array.isArray(bbox)) {
          return error('bounding box must be an array')
        }
        if (bbox.length !== 4 || typeof bbox[0] !== 'number') {
          return error(
            'bounding box must be a flat array with 4 elements: [W,S,E,N]'
          )
        }
        if (bbox[0] > bbox[2] || bbox[1] > bbox[3]) {
          return error(
            'minimum must be less than maximum in bounding box'
          )
        }
        var seen = {}, seenDocs = {}
        var stream = through.obj(map)
        core.ready(function () {
          var q = toStream.source(bkd.query(bbox))
          pump(q, stream)
        })
        if (cb) collect(stream, cb)
        d.setReadable(stream)
        return d

        function error (msg) {
          var err = new Error(msg)
          process.nextTick(function () {
            d.emit('error', err)
          })
          return d
        }

        function map (result, enc, next) {
          next = once(next)
          var stream = this
          var key = result.value[0].slice(0,32).toString('hex')
          var seq = result.value[0].readUInt32BE(32)
          var feed = core._logs.feed(key)
          feed.get(seq, function (err, doc) {
            if (err) return next(err)
            if (seenDocs[key+seq]) return next()
            var pending = 0
            stream.push(doc)
            checkRefs(doc)
            seenDocs[key+seq] = true
            pending++
            core.api.refs.get(doc.id, scanRefs)
            function scanRefs (err, refs) {
              if (err) return next(err)
              refs.forEach(function (ref) {
                if (seen[ref.version]) return
                seen[ref.version] = true
                var parts = ref.version.split('@')
                var rkey = parts[0]
                var rseq = Number(parts[1])
                var rfeed = core._logs.feed(rkey)
                pending++
                rfeed.get(rseq, function (err, rdoc) {
                  if (err) return next(err)
                  seenDocs[rkey+rseq] = true
                  stream.push(rdoc)
                  checkRefs(rdoc)
                  pending++
                  core.api.refs.get(rdoc.id, scanRefs)
                  if (--pending === 0) next()
                })
              })
              if (--pending === 0) next()
            }
            function checkRefs (doc) {
              if (doc.element && Array.isArray(doc.element.refs)) {
                doc.element.refs.forEach(addRef)
              } else if (doc.element && Array.isArray(doc.element.members)) {
                doc.element.members.forEach(addMember)
              }
            }
            function addRef (id) {
              pending++
              core.api.kv.get(id, function (err, values) {
                if (err) return next(err)
                values.forEach(function (value) {
                  var parts = value.split('@')
                  var key = parts[0]
                  var seq = Number(parts[1])
                  if (seenDocs[key+seq]) return
                  pending++
                  var feed = core._logs.feed(key)
                  feed.get(seq, function (err, doc) {
                    if (err) return next(err)
                    seenDocs[key+seq] = true
                    stream.push(doc)
                    checkRefs(doc)
                    pending++
                    core.api.refs.get(doc.id, scanRefs)
                    if (--pending === 0) next()
                  })
                })
                if (--pending === 0) next()
              })
            }
            function addMember (member) {
              addRef(member.id)
            }
          })
        }
      }
    }
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
