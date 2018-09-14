module.exports = Osm

var sub = require('subleveldown')
var utils = require('./lib/utils')
var once = require('once')
var xtend = require('xtend')
var uniq = require('uniq')
var EventEmitter = require('events').EventEmitter

var umkv = require('unordered-materialized-kv')
var checkElement = require('./lib/check-element')
var createRefsIndex = require('./lib/refs-index.js')
var createChangesetIndex = require('./lib/changeset-index.js')
var createKvIndex = require('./lib/kv-index.js')
var createBkdIndex = require('./lib/bkd-index.js')

module.exports = Osm

function Osm (opts) {
  if (!(this instanceof Osm)) return new Osm(opts)
  if (!opts.core) throw new Error('missing param "core"')
  if (!opts.index) throw new Error('missing param "index"')
  if (!opts.storage) throw new Error('missing param "storage"')

  var self = this

  this.core = opts.core
  this.index = opts.index

  this.writer = null
  this.readyFns = []
  this.core.feed('default', function (err, writer) {
    if (err) return self.emit('error', err)
    self.writer = writer
    self.readyFns.forEach(function (fn) { fn() })
    self.readyFns = []
  })

  // Create indexes
  var kv = umkv(sub(this.index, 'kvu'))
  var bkd = createBkdIndex(
    this.core, sub(this.index, 'bkd'), kv, opts.storage
  )
  this.core.use('kv', createKvIndex(kv, sub(this.index, 'kvi')))
  this.core.use('refs', createRefsIndex(sub(this.index, 'refs')))
  this.core.use('changeset', createChangesetIndex(sub(this.index, 'ch')))
  this.core.use('geo', bkd)
}
Osm.prototype = Object.create(EventEmitter.prototype)

// Is the log ready for writing?
Osm.prototype._ready = function (cb) {
  if (this.writer) cb()
  else this.readyFns.push(cb)
}

Osm.prototype.ready = function (cb) {
  // TODO: one day we'll have a readonly mode!
  if (!this.writer) {
    this.readyFns.push(cb)
    return
  }
  this.core.ready(cb)
}

// OsmElement -> Error
Osm.prototype.create = function (element, cb) {
  // Generate unique ID for element
  var id = utils.generateId()

  this.put(id, element, cb)
}

// OsmId -> [OsmElement]
Osm.prototype.get = function (id, cb) {
  var self = this

  var elms = []
  var error
  var pending = 0

  this.core.api.kv.get(id, function (err, versions) {
    if (err) return cb(err)
    versions = versions || []
    pending = versions.length + 1

    for (var i = 0; i < versions.length; i++) {
      self.getByVersion(versions[i], done)
    }
    done()
  })

  function done (err, elm) {
    if (err) error = err
    if (elm) elms.push(elm)
    if (--pending) return
    if (error) cb(error)
    else cb(null, elms)
  }
}

// String -> [Message]
Osm.prototype._getByVersion = function (version, cb) {
  var key = version.split('@')[0]
  var seq = version.split('@')[1]
  var feed = this.core._logs.feed(key)
  if (feed) {
    feed.get(seq, cb)
  } else {
    cb(null, null)
  }
}

// OsmVersion -> [OsmElement]
Osm.prototype.getByVersion = function (version, opts, cb) {
  if (typeof opts === 'function' && !cb) {
    cb = opts
    opts = {}
  }

  this._getByVersion(version, function (err, msg) {
    if (err) return cb(err)
    if (opts.raw) return cb(null, msg)
    if (!msg) return cb(null, null)
    var elm = msg.element
    elm.id = msg.id
    elm.version = version
    cb(null, elm)
  })
}

// OsmId, OsmElement -> OsmElement
Osm.prototype.put = function (id, element, opts, cb) {
  if (opts && !cb && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  var self = this

  // Check for type errors
  var errs = checkElement(element, 'put')
  if (errs.length) return cb(errs[0])

  // TODO: how are 'links' passed in? opts.links?
  var msg = {
    type: 'osm/element',
    id: id,
    element: Object.assign({ timestamp: new Date().toISOString() }, element)
  }

  // set links
  if (opts.links) {
    msg.links = opts.links
    write()
  } else {
    self.core.api.kv.get(id, function (err, versions) {
      if (err) return cb(err)
      msg.links = versions
      write()
    })
  }

  // write to the feed
  function write () {
    self._ready(function () {
      self.writer.append(msg, function (err) {
        if (err) return cb(err)
        var version = self.writer.key.toString('hex') +
          '@' + (self.writer.length - 1)
        var elm = xtend(element, { id: id, version: version })
        cb(null, elm)
      })
    })
  }
}

// OsmId, OsmElement -> OsmElement
Osm.prototype.del = function (id, element, opts, cb) {
  if (opts && !cb && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  var self = this

  // Check for type errors
  var errs = checkElement(element, 'del')
  if (errs.length) return cb(errs[0])

  getLinks(function (err, links) {
    if (err) return cb(err)
    getElms(links, function (err, elms) {
      if (err) return cb(err)
      var refs = self._mergeElementRefsAndMembers(elms)
      var msg = {
        type: 'osm/element',
        id: id,
        element: xtend({deleted: true}, element),
        links: links
      }
      if (refs.refs) msg.element.refs = refs.refs
      else if (refs.members) msg.element.members = refs.members
      write(msg, cb)
    })
  })

  // Get links
  function getLinks (cb) {
    if (opts.links) {
      cb(null, opts.links)
    } else {
      self.core.api.kv.get(id, function (err, versions) {
        if (err) return cb(err)
        cb(null, versions)
      })
    }
  }

  function getElms (links, cb) {
    if (!links.length) return cb(null, [])

    var res = []
    var error
    var pending = links.length
    for (var i = 0; i < links.length; i++) {
      self.getByVersion(links[i], onElm)
    }

    function onElm (err, elm) {
      if (err) error = err
      if (--pending) return
      if (error) return cb(error)
      cb(null, res)
    }
  }

  // write to the feed
  function write (msg, cb) {
    self._ready(function () {
      self.writer.append(msg, function (err) {
        if (err) return cb(err)
        var version = self.writer.key.toString('hex') +
          '@' + (self.writer.length - 1)
        var elm = xtend(element, { id: id, version: version })
        cb(null, elm)
      })
    })
  }
}

// TODO: should element validation happen on batch jobs?
Osm.prototype.batch = function (ops, cb) {
  if (!ops || !ops.length) return cb()

  var self = this
  cb = once(cb)

  populateWayRelationRefs(function (err) {
    if (err) return cb(err)
    populateMissingLinks(function (err) {
      if (err) return cb(err)
      writeData(cb)
    })
  })

  // First, populate way & relation deletions with correct refs/members.
  function populateWayRelationRefs (cb) {
    var pending = 0
    var error
    for (var i = 0; i < ops.length; i++) {
      if (ops[i].type === 'del') {
        pending++
        updateRefs(ops[i].id, ops[i].links, ops[i].value, function (err) {
          if (err) error = err
          if (!--pending) cb(error)
        })
      }
    }
    if (!pending) cb()
  }

  function populateMissingLinks (cb) {
    var pending = 1
    for (var i = 0; i < ops.length; i++) {
      if (!ops[i].id) {
        ops[i].id = utils.generateId()
        ops[i].links = []
      } else if (!ops[i].links) {
        pending++
        ;(function get (op) {
          self.core.api.kv.get(op.id, function (err, versions) {
            op.links = versions || []
            if (!--pending) cb(err)
          })
        })(ops[i])
      }
    }
    if (!--pending) cb()
  }

  function writeData (cb) {
    var batch = ops.map(osmOpToMsg)

    self._ready(function () {
      var key = self.writer.key.toString('hex')
      var startSeq = self.writer.length
      self.writer.append(batch, function (err) {
        if (err) return cb(err)
        var res = batch.map(function (msg, n) {
          var version = key + '@' + (startSeq + n)
          return xtend(msg.element, {
            id: msg.id,
            version: version
          })
        })
        cb(null, res)
      })
    })
  }

  function updateRefs (id, links, elm, cb) {
    if (links) self._getRefsMembersByVersions(links, done)
    else self._getRefsMembersById(id, done)

    function done (err, res) {
      if (err) return cb(err)
      if (res.refs) elm.refs = res.refs
      else if (res.members) elm.members = res.members
      cb()
    }
  }

  function osmOpToMsg (op) {
    if (op.type === 'put') {
      return {
        type: 'osm/element',
        id: op.id,
        element: op.value,
        links: op.links
      }
    } else if (op.type === 'del') {
      return {
        type: 'osm/element',
        id: op.id,
        element: xtend(op.value, { deleted: true }),
        links: op.links
      }
    } else {
      cb(new Error('unknown type'))
    }
  }
}

// Id -> { id, version }
Osm.prototype.getChanges = function (id, cb) {
  var self = this
  this.core.api.changeset.ready(function () {
    self.core.api.changeset.get(id, cb)
  })
}

// Id -> { id, version }
Osm.prototype.refs = function (id, cb) {
  var self = this
  this.core.api.refs.ready(function () {
    self.core.api.refs.get(id, cb)
  })
}

// BoundingBox -> (Stream or Callback)
Osm.prototype.query = function (bbox, opts, cb) {
  if (opts && !cb && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}
  return this.core.api.geo.query(bbox, opts, cb)
}

Osm.prototype.createReplicationStream = function (opts) {
  return this.core.replicate(opts)
}
Osm.prototype.replicate = Osm.prototype.createReplicationStream

// OsmId -> {refs: [OsmId]} | {members: [OsmId]} | {}
Osm.prototype._mergeElementRefsAndMembers = function (elms) {
  var res = {}
  for (var i = 0; i < elms.length; i++) {
    var elm = elms[i]
    if (elm.refs) {
      res.refs = res.refs || []
      mergeRefs(res.refs, elm.refs)
    } else if (elm.members) {
      res.members = res.members || []
      mergeMembers(res.members, elm.members)
    }
  }
  return res

  function mergeRefs (into, from) {
    into.push.apply(into, from)
    return uniq(into)
  }

  function mergeMembers (into, from) {
    into.push.apply(into, from)
    return uniq(into, memberCmp)
  }

  function memberCmp (a, b) {
    return a.id === b.id ? 0 : -1
  }
}

// OsmId -> {refs: [OsmId]} | {members: [OsmId]} | {}
Osm.prototype._getRefsMembersById = function (id, cb) {
  var self = this
  this.get(id, function (err, elms) {
    if (err || !elms || !elms.length) return cb(err, {})
    var res = self._mergeElementRefsAndMembers(elms)
    cb(null, res)
  })
}

// [OsmVersion] -> {refs: [OsmId]} | {members: [OsmId]} | {}
Osm.prototype._getRefsMembersByVersions = function (versions, cb) {
  var self = this
  if (!versions.length) return cb(null, [])

  var elms = []
  var error
  var pending = versions.length
  for (var i = 0; i < versions.length; i++) {
    self.getByVersion(versions[i], onElm)
  }

  function onElm (err, elm) {
    if (err) error = err
    if (elm) elms.push(elm)
    if (--pending) return
    if (error) return cb(error)

    var res = self._mergeElementRefsAndMembers(elms)
    cb(null, res)
  }
}
