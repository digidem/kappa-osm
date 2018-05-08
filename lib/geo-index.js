var LevelIndex = require('hyperdb-index-level')
var d64 = require('d64')
var varint = require('varint')
var toBuffer = require('to-buffer')
var utils = require('./utils')
var Types = require('comparable-storable-types')
var through = require('through2')
var readonly = require('read-only-stream')

function createIndex (hdb, ldb, geo) {
  // HACK: override the value type on the geo store. won't work for any store
  // but grid-point-store!
  geo.valueType = Types('buffer[36]')

  var idx = LevelIndex(hdb, ldb, geoProcessor)

  function geoProcessor (node, next) {
    // console.log('geo node', idx.id, node.key, node.value)

    if (!node.value) next()
    else if (isNode(node.value)) processNode(node, next)
    else if (node.value.deleted) processDeletion(node, next)
    else next()
  }

  function processNode (node, cb) {
    var v = node.value
    var nodeVersion = utils.nodeToVersion(hdb, node)
    var version = versionToBuffer36(nodeVersion)
    geo.insert([Number(v.lat), Number(v.lon)], version, function (err) {
      if (err) return cb(err)

      utils.getPreviousHeads(hdb, node, function (err, oldNodes) {
        if (err) return cb(err)
        if (!oldNodes || !oldNodes.length) return cb()
        var pending = oldNodes.length
        for (var i = 0; i < oldNodes.length; i++) {
          var oldNode = oldNodes[i]
          var oldVersion = versionToBuffer36(utils.nodeToVersion(hdb, oldNode))
          var pt = [Number(oldNode.value.lat), Number(oldNode.value.lon)]
          geo.remove(pt, { value: oldVersion }, function (err) {
            if (!--pending) cb(err)
          })
        }
      })
    })
  }

  function processDeletion (node, cb) {
    // Remove old heads
    utils.getPreviousHeads(hdb, node, function (err, oldNodes) {
      if (err) return cb(err)

      // Only bother doing this with OSM nodes
      oldNodes = (oldNodes || []).filter(n => n.value.type === 'node')

      if (!oldNodes.length) return cb()

      var pts = []
      var pending = oldNodes.length
      for (var i = 0; i < oldNodes.length; i++) {
        var oldNode = oldNodes[i]
        var oldVersion = versionToBuffer36(utils.nodeToVersion(hdb, oldNode))
        var pt = [Number(oldNode.value.lat), Number(oldNode.value.lon)]
        pts.push(pt)
        geo.remove(pt, { value: oldVersion }, function (err) {
          if (!--pending) {
            if (err) cb(err)
            else writeNewPoints(pts, cb)
          }
        })
      }
    })

    // Rewrite the heads, but pointing to the new version (this deletion node)
    function writeNewPoints (pts, cb) {
      if (!pts.length) return cb()

      var pending = pts.length
      var version = versionToBuffer36(utils.nodeToVersion(hdb, node))
      for (var i = 0; i < pts.length; i++) {
        geo.insert(pts[i], version, function (err) {
          if (!--pending) cb(err)
        })
      }
    }
  }

  idx.queryStream = function (bbox) {
    var t = through.obj(write)
    geo.queryStream(bbox).pipe(t)

    function write (chunk, enc, next) {
      next(null, buffer36ToVersion(chunk.value))
    }

    return readonly(t)
  }

  idx.geo = geo

  return idx
}

// String -> Buffer[36]
function versionToBuffer36 (version) {
  var buf = d64.decode(version)
  var key = buf.slice(0, 32)
  var seq = varint.decode(buf, 32)
  var seqOut = Buffer.alloc(4)
  seqOut.writeUInt32LE(seq, 0)
  return Buffer.concat([key, seqOut])
}

// Buffer[36] -> String
function buffer36ToVersion (buf) {
  var key = buf.slice(0, 32)
  var seq = buf.readUInt32LE(32)
  var seqOut = toBuffer(varint.encode(seq))
  var res = Buffer.concat([key, seqOut])
  return d64.encode(res)
}

// Element -> Bool
function isNode (elm) {
  return elm && elm.type === 'node'
}

module.exports = createIndex
