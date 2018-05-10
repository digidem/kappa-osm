module.exports = Osm

var through = require('through2')
var readonly = require('read-only-stream')
var sub = require('subleveldown')
var collect = require('collect-stream')
var utils = require('./lib/utils')
var once = require('once')
var xtend = require('xtend')
var uniq = require('uniq')

var checkElement = require('./lib/check-element')
var validateBoundingBox = require('./lib/utils').validateBoundingBox
//var createGeoIndex = require('./lib/geo-index')
//var createRefsIndex = require('./lib/refs-index')
var createKvIndex = require('./lib/kv-index')

module.exports = Osm

function Osm (opts) {
  if (!(this instanceof Osm)) return new Osm(opts)
  if (!opts.log) throw new Error('missing param "log"')
  if (!opts.index) throw new Error('missing param "index"')
  if (!opts.spatial) throw new Error('missing param "spatial"')

  var self = this

  this.log = opts.log
  this.index = opts.index
  this.spatial = opts.spatial

  this.writer = null
  this.readyFns = []
  this.log.writer('default', function (err, writer) {
    self.writer = writer
    self.readyFns.forEach(function (fn) { fn() })
    self.readyFns = []
  })

  // Create indexes
  // this.refs = createRefsIndex(this.log, this.index)
  // this.geo = createGeoIndex(this.log, sub(this.index, 'geo'), this.spatial)
  this.kv = createKvIndex(this.log, sub(this.index, 'kv'), this.spatial)
}

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
  this.kv.ready(cb)
}

// OsmElement -> Error
Osm.prototype.create = function (element, cb) {
  var self = this

  // Element format verification
  var errs = checkElement(element, 'put')
  if (errs.length) return cb(errs[0])

  utils.populateElementDefaults(element)

  // Generate unique ID for element
  var id = utils.generateId()

  // Write the element to the log
  // TODO: how are 'links' passed in? opts.links?
  var data = {
    type: 'osm/element',
    id: id,
    element: element
  }

  console.log('creating', id, '->', element)

  this._ready(function () {
    self.writer.append(data, function (err) {
      if (err) return cb(err)
      var version = self.writer.key.toString('hex') + '@' + (self.writer.length-1)
      cb(null, xtend(data, {version:version}))
    })
  })
}

// OsmId -> [OsmElement]
Osm.prototype.get = function (id, cb) {
  var self = this

  this.kv.get(id, function (err, versions) {
    if (err) return cb(err)
    versions = versions || []

    // TODO: async map to elements

    cb(null, versions)
  })
}

// OsmVersion -> OsmElement
Osm.prototype.getByVersion = function (osmVersion, cb) {
  // TODO: have umkv index version too
  throw new Error('not implemented')
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
  var data = {
    type: 'osm/element',
    id: id,
    element: element
  }

  console.log('updating', id, '->', element)

  this.writer.append(data, function (err) {
    if (err) return cb(err)
    var version = self.writer.key.toString('hex') + '@' + (self.writer.length-1)
    cb(null, version)
  })
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

  throw new Error('not implemented')

//   // Retrieve the combined refs/members of all previous known heads.
//   this._getRefsMembers(id, function (err, res) {
//     if (err) return cb(err)
// 
//     var base = { deleted: true }
//     if (res.refs) base.refs = res.refs
//     else if (res.members) base.members = res.members
// 
//     var elmCopy = merge(element, base)
// 
//     // Write to hyperdb
//     var key = id
//     // console.log('deleting', key, '->', elmCopy)
// 
//     self.db.put(key, elmCopy, function (err, node) {
//       if (err) return cb(err)
//       var version = utils.versionFromKeySeq(self.db._localWriter.key, node.seq)
//       var elm = merge(node.value, { id: id, version: version })
//       cb(null, elm)
//     })
//   })
}

// TODO: should element validation happen on batch jobs?
Osm.prototype.batch = function (ops, cb) {
  if (!ops || !ops.length) return cb()

  var self = this
  cb = once(cb)

  throw new Error('not implemented')

//  // Populate way & relation deletions with correct refs/members.
//  var pending = 0
//  var error
//  for (var i = 0; i < ops.length; i++) {
//    if (ops[i].type === 'del') {
//      pending++
//      updateRefs(ops[i].id, ops[i].value, function (err) {
//        if (err) error = err
//        if (!--pending) write(error)
//      })
//    }
//  }
//  if (!pending) write()
//
//  function write (err) {
//    if (err) return cb(err)
//
//    var batch = ops.map(osmOpToHyperdbOp)
//
//    self.db.batch(batch, function (err, res) {
//      if (err) return cb(err)
//      res = res.map(function (node, n) {
//        return merge(node.value, {
//          id: hyperdbKeyToId(batch[n].key),
//          version: utils.versionFromKeySeq(self.db._writers[node.feed].key, node.seq)
//        })
//      })
//      cb(null, res)
//    })
//  }
//
//  function updateRefs (id, elm, cb) {
//    self._getRefsMembers(id, function (err, res) {
//      if (err) return cb(err)
//      if (res.refs) elm.refs = res.refs
//      else if (res.members) elm.members = res.members
//      cb()
//    })
//  }
//
//  function hyperdbKeyToId (key) {
//    return key.substring(key.lastIndexOf('/') + 1)
//  }
//
//  function osmOpToHyperdbOp (op) {
//    var id = (op.id || utils.generateId())
//
//    if (op.type === 'put') {
//      return {
//        type: 'put',
//        key: id,
//        value: op.value
//      }
//    } else if (op.type === 'del') {
//      return {
//        type: 'put',
//        key: id,
//        value: merge(op.value || {}, { deleted: true })
//      }
//    } else {
//      cb(new Error('unknown type'))
//    }
//  }
}

// Id -> { id, version }
Osm.prototype.getChanges = function (id, cb) {
  return this.refs.getReferersById(id, cb)
}

// Id -> { id, version }
Osm.prototype.refs = function (id, cb) {
  throw new Error('not implemented')
  // return this.refs.getReferersById(id, cb)
}

// BoundingBox -> (Stream or Callback)
Osm.prototype.query = function (bbox, opts, cb) {
  if (opts && !cb && typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  throw new Error('not implemented')

//  // To prevent re-processing elements that were already processed.
//  var seen = [{}, {}]
//  var t
//
//  var err = validateBoundingBox(bbox)
//  if (err) {
//    if (cb) {
//      return cb(err)
//    } else {
//      t = through.obj()
//      process.nextTick(function () { t.emit('error', err) })
//      return t
//    }
//  }
//
//  // For accumulating ways and relations when element type order matters.
//  var typeQueue = []
//
//  var self = this
//  t = through.obj(onPoint, onFlush)
//  this.geo.ready(function () {
//    self.refs.ready(function () {
//      self.geo.queryStream(bbox).pipe(t)
//    })
//  })
//
//  if (!cb) {
//    return readonly(t)
//  } else {
//    collect(t, {encoding: 'object'}, cb)
//  }
//
//  // Writes an OSM element to the output stream.
//  //
//  // 'gen' is the generation of the added element. This depends on the context
//  // that the element has been added in. A node directly returned by the geo
//  // query is gen=0, but a node indirectly found by looking at nodes in a way
//  // that that gen=0 node belongs to is a gen=1. Same with ways: a way visited
//  // by a gen=0 node is also gen=0, but one found by an indirect gen=1 node is
//  // also gen=1. This is a bit difficult to wrap one's head around, but this is
//  // necessary to prevent any elements from being processed more times than
//  // they need to be.
//  function add (elm, gen) {
//    var alreadySeen = seen[0][elm.version]
//    if (gen === 1) alreadySeen = alreadySeen || seen[1][elm.version]
//
//    if (!seen[0][elm.version] && !seen[1][elm.version]) {
//      if (opts.order === 'type' && elm.type !== 'node') {
//        typeQueue.push(elm)
//      } else {
//        t.push(elm)
//      }
//    }
//
//    if (!alreadySeen) {
//      seen[gen][elm.version] = true
//      seen[1][elm.version] = true
//    }
//
//    return !alreadySeen
//  }
//
//  function isRelation (elm) {
//    return elm.type === 'relation'
//  }
//
//  // TODO: can we up the concurrency here & rely on automatic backpressure?
//  function onPoint (version, _, next) {
//    next = once(next)
//
//    self.getByVersion(version, function (err, elm) {
//      if (err) return next(err)
//
//      // Get all referrer ways and relations recursively.
//      getRefererElementsRec(elm, 0, function (err, res) {
//        if (err) return next(err)
//
//        // Only add a node here if it can prove that it has only relations
//        // referring to it. Otherwise it'll get picked up by traversing a way
//        // later. This is important for making sure that a deleted way doesn't
//        // return its nodes if they aren't referred to by anything else.
//        var addNode = res.every(isRelation)
//        if (addNode) add(elm, 0)
//
//        if (!res.length) return next()
//
//        // For each element that refers to the node, get all of its forked
//        // heads and, for ways, get all nodes they reference.
//        var pending = res.length
//        for (var i = 0; i < res.length; i++) {
//          var elm2 = res[i]
//          if (elm2.type === 'way' && !elm2.deleted) {
//            pending++
//            getWayNodes(elm2, function (err, nodes) {
//              if (err) return next(err)
//
//              pending += nodes.length
//              if (!--pending) return next()
//
//              // Recursively get their heads & relations
//              for (var j = 0; j < nodes.length; j++) {
//                getWayNodeRec(nodes[j], function (err, elms) {
//                  if (err) return cb(err)
//                  if (!--pending) return next()
//                })
//              }
//            })
//          }
//
//          if (addNode) {
//            getAllHeads(elm.id, function (err, heads) {
//              if (err) return next(err)
//              if (!--pending) return next()
//            })
//          } else {
//            if (!--pending) return next()
//          }
//        }
//      })
//    })
//  }
//
//  function onFlush (cb) {
//    typeQueue.sort(cmpType).forEach(function (elm) { t.push(elm) })
//    cb()
//  }
//
//  // Get all heads of all nodes in a way.
//  function getWayNodes (elm, cb) {
//    cb = once(cb)
//    var res = []
//    var pending = elm.refs.length
//
//    for (var i = 0; i < elm.refs.length; i++) {
//      getAllHeads(elm.refs[i], function (err, heads) {
//        if (err) cb(err)
//        res.push.apply(res, heads)
//        if (!--pending) return cb(null, res)
//      })
//    }
//  }
//
//  // Get all heads of the node, and all relations referring to it (recursively).
//  function getWayNodeRec (elm, cb) {
//    cb = once(cb)
//    var res = []
//    var pending = 2
//
//    getRefererElementsRec(elm, 1, function (err, elms) {
//      if (err) return cb(err)
//      res.push.apply(res, elms)
//      if (!--pending) cb(null, res)
//    })
//
//    getAllHeads(elm.id, function (err, heads) {
//      if (err) return cb(err)
//      res.push.apply(res, heads)
//      if (!--pending) cb(null, res)
//    })
//  }
//
//  // Get all head versions of all ways and relations referring to an element,
//  // recursively.
//  function getRefererElementsRec (elm, gen, cb) {
//    cb = once(cb)
//    var res = []
//
//    getRefererElements(elm, gen, function (err, elms) {
//      if (err) return cb(err)
//      if (!elms.length) return cb(null, [])
//
//      var pending = elms.length
//      for (var i = 0; i < elms.length; i++) {
//        res.push(elms[i])
//
//        getRefererElementsRec(elms[i], gen, function (err, elms) {
//          if (err) return cb(err)
//          for (var j = 0; j < elms.length; j++) {
//            res.push(elms[j])
//          }
//          if (!--pending) cb(null, res)
//        })
//      }
//    })
//  }
//
//  // Get all head versions of all ways and relations referring to an element.
//  function getRefererElements (elm, gen, cb) {
//    cb = once(cb)
//    var res = []
//
//    // XXX: uncomment this to skip ref lookups on indirect nodes
//    // if (gen === 1) return cb(null, [])
//
//    self.refs.getReferersById(elm.id, function (err, refs) {
//      if (err) return cb(err)
//      if (!refs.length) return cb(null, [])
//
//      var pending = refs.length
//      for (var i = 0; i < refs.length; i++) {
//        seen[gen][refs[i].id] = true
//
//        self.get(refs[i].id, function (err, elms) {
//          if (err) return cb(err)
//          for (var j = 0; j < elms.length; j++) {
//            add(elms[j], gen)
//            res.push(elms[j])
//          }
//          if (!--pending) cb(null, res)
//        })
//      }
//    })
//  }
//
//  function getAllHeads (id, cb) {
//    var res = []
//
//    if (seen[0][id]) return cb(null, [])
//    seen[0][id] = true
//
//    self.get(id, function (err, elms) {
//      if (err) return cb(err)
//      for (var i = 0; i < elms.length; i++) {
//        if (add(elms[i], 1)) res.push(elms[i])
//      }
//      cb(null, res)
//    })
//  }
}

Osm.prototype.createReplicationStream = function (opts) {
  return this.log.replicate(opts)
}
Osm.prototype.replicate = Osm.prototype.createReplicationStream

// OsmId -> {refs: [OsmId]} | {members: [OsmId]} | {}
Osm.prototype._getRefsMembers = function (id, cb) {
//  var res = {}
//  var key = this.dbPrefix + '/elements/' + id
//
//  this.db.get(key, function (err, nodes) {
//    if (err || !nodes || !nodes.length) return cb(err, {})
//
//    for (var i = 0; i < nodes.length; i++) {
//      var elm = nodes[i].value
//      if (elm.refs) {
//        res.refs = res.refs || []
//        mergeRefs(res.refs, elm.refs)
//      } else if (elm.members) {
//        res.members = res.members || []
//        mergeMembers(res.members, elm.members)
//      }
//    }
//
//    cb(null, res)
//  })
//
//  function mergeRefs (into, from) {
//    into.push.apply(into, from)
//    return uniq(into)
//  }
//
//  function mergeMembers (into, from) {
//    into.push.apply(into, from)
//    return uniq(into, memberCmp)
//  }
//
//  function memberCmp (a, b) {
//    return a.id === b.id ? 0 : -1
//  }
}

var typeOrder = { node: 0, way: 1, relation: 2 }
function cmpType (a, b) {
  return typeOrder[a.type] - typeOrder[b.type]
}
