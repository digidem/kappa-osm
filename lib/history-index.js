var through = require('through2')
var readonly = require('read-only-stream')

var TYPE = 't'
var TIME = 'a'
var ID = 'i'

function createIndex (osm, db) {
  return {
    maxBatch: 100,
    map: function (nodes, next) {
      var batch = []
      nodes.forEach(function (node) {
        if (node.value.type !== 'osm/element') return
        if (!node.value.element) return
        var key = node.value.element.type === 'observation'
          ? 'created_at' : 'timestamp'
        var timestamp = node.value.element[key]
        if (!timestamp) return
        // dates should be stored as ISO format which lexicographically sort
        // but we'll convert and re-encode just to be extra sure
        var date = new Date(timestamp)
        try {
          var iso = date.toISOString()
        } catch (err) {
          return
        }
        batch.push({
          type: 'put',
          key: TIME + '!' + iso,
          value: node.key + '@' + node.seq
        })
        var id = String(node.value.id || '').replace(/!/g, '_')
        batch.push({
          type: 'put',
          key: ID + '!' + id + '!' + iso,
          value: node.key + '@' + node.seq
        })
        var t = String(node.value.element.type || '').replace(/!/g, '_')
        if (t.length > 0) {
          batch.push({
            type: 'put',
            key: TYPE + '!' + t + '!' + iso,
            value: node.key + '@' + node.seq
          })
        }
      })
      if (batch.length === 0) next()
      else db.batch(batch, next)
    },
    storeState: function (state, cb) {
      db.put('_state', { valueEncoding: 'binary' }, state, cb)
    },
    fetchState: function (cb) {
      db.get('_state', { valueEncoding: 'binary' }, function (err, state) {
        if (err && err.notFound) cb()
        else if (err) cb(err)
        else cb(null, state)
      })
    },
    api: {
      type: function (core, type, opts) {
        var s = through.obj(write)
        this.ready(function () {
          var r = db.createReadStream(prefixOpts(TYPE + '!' + type, opts))
          r.pipe(s)
          r.on('error', function (err) { s.emit('error', err) })
        })
        return readonly(s)
        function write (row, enc, next) {
          osm.getByVersion(row.value, function (err, doc) {
            if (err) next(err)
            else if (doc) next(null, doc)
            else next(null)
          })
        }
      },
      id: function (core, id, opts) {
        var s = through.obj(write)
        this.ready(function () {
          var r = db.createReadStream(prefixOpts(ID + '!' + id, opts))
          r.pipe(s)
          r.on('error', function (err) { s.emit('error', err) })
        })
        return readonly(s)
        function write (row, enc, next) {
          osm.getByVersion(row.value, function (err, doc) {
            if (err) next(err)
            else if (doc) next(null, doc)
            else next(null)
          })
        }
      },
      all: function (core, type, opts) {
        var s = through.obj(write)
        this.ready(function () {
          var r = db.createReadStream(prefixOpts(TIME, opts))
          r.on('error', function (err) { s.emit('error', err) })
          r.pipe(s)
        })
        return readonly(s)
        function write (row, enc, next) {
          osm.getByVersion(row.value, function (err, doc) {
            if (err) next(err)
            else if (doc) next(null, doc)
            else next(null)
          })
        }
      }
    }
  }
}

module.exports = createIndex

function prefixOpts (pre, opts) {
  var xopts = {}
  if (!opts) opts = {}
  if (opts.gt !== undefined) {
    xopts.gt = pre + '!' + opts.gt
  } else if (opts.gte !== undefined) {
    xopts.gte = pre + '!' + opts.gte
  } else {
    xopts.gt = pre + '!'
  }
  if (opts.lt !== undefined) {
    xopts.lt = pre + '!' + opts.lt
  } else if (opts.lte !== undefined) {
    xopts.lte = pre + '!' + opts.lte
  } else {
    xopts.lt = pre + '!\uffff'
  }
  if (opts.limit !== undefined) xopts.limit = opts.limit
  if (opts.reverse !== undefined) xopts.reverse = opts.reverse
  return xopts
}
