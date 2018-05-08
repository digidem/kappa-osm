var toBuffer = require('to-buffer')
var varint = require('varint')
var randomBytes = require('randombytes')
var d64 = require('d64')

module.exports = {
  validateBoundingBox: validateBoundingBox,
  generateId: generateId,
  populateElementDefaults: populateElementDefaults,
  versionToNode: versionToNode,
  nodeToVersion: nodeToVersion,
  versionFromKeySeq: versionFromKeySeq,
  hyperDbKeyToId: hyperDbKeyToId,
  getPreviousHeads: getPreviousHeads
}

// [[minLat,maxLat],[minLon,maxLon]] -> Error? [Mutate]
function validateBoundingBox (bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 2 ||
      bbox[0].length !== 2 || bbox[1].length !== 2) {
    return new Error('bbox format is [[minLat,maxLat],[minLon,maxLon]]')
  }

  // Cap off the edges of the bounding box
  bound(bbox[0][0], -90, 90)
  bound(bbox[0][1], -90, 90)
  bound(bbox[1][0], -180, 180)
  bound(bbox[1][1], -180, 180)

  // Check whether min < max on the bbox
  if (bbox[0][0] > bbox[0][1] || bbox[1][0] > bbox[1][1]) {
    return new Error('max cannot be smaller than min')
  }
}

// bound :: Number, Number, Number -> Number
function bound (n, min, max) {
  return Math.min(max, Math.max(min, n))
}

// generateId :: String
function generateId () {
  return randomBytes(8).toString('hex')
}

// OsmElement -> undefined [Mutate]
function populateElementDefaults (elm) {
  if (!elm.timestamp) {
    elm.timestamp = (new Date()).toISOString()
  }
}

// HyperDB, String -> Node
function versionToNode (db, version, cb) {
  var feedseq = decodeVersion(version)

  for (var i = 0; i < db._writers.length; i++) {
    var w = db._writers[i]
    if (feedseq.key.equals(w.key)) {
      return w.get(feedseq.seq, cb)
    }
  }

  throw new Error('node doesnt exist in db')
}

// String -> { key, seq }
function decodeVersion (version) {
  var buf = d64.decode(version)
  var key = buf.slice(0, 32)
  var seq = varint.decode(buf, 32)
  return {
    key: key,
    seq: seq
  }
}

// HyperDB, Node -> Buffer
function nodeToVersion (db, node) {
  for (var i = 0; i < db._writers.length; i++) {
    var w = db._writers[i]
    if (i === node.feed) {
      return versionFromKeySeq(w.key, node.seq)
    }
  }

  throw new Error('node doesnt exist in db')
}

// Buffer, Number -> String
function versionFromKeySeq (key, seq) {
  return d64.encode(
    Buffer.concat([
      key,
      toBuffer(varint.encode(seq))
    ])
  )
}

// Takes a hyperdb key like /foo/bar/baz and returns the last element (baz)
// String -> String
function hyperDbKeyToId (key) {
  var components = key.split('/')
  return components[components.length - 1]
}

// HACK: hyperdb does not yet have a public API for this, so what follows is a
// manual dirty process of reaching our arms in elbow-deep into the private
// internals in order to retrieve the old heads of a node.
//
// HyperDB, HyperDBNode -> [HyperDBNode]
function getPreviousHeads (db, node, cb) {
  var clock = node.clock.slice()

  // -1. fudge clock
  clock[node.feed] = node.seq + 1

  // 0. skip edge cases I haven't figured out yet
  if (clock[node.feed] === 0) return cb()

  // 1. turn back the clock
  clock[node.feed]--

  // 2. turn the clock into db heads
  var arr = []
  for (var i = 0; i < clock.length; i++) {
    if (clock[i] <= 0) continue
    arr.push({key: db._writers[i].key, seq: clock[i] - 1})
  }
  if (!arr.length) return cb(null, [])

  // 3. convert heads to a hyperdb version buffer
  var version = headsToVersion(arr)

  // 4. checkout that version
  var oldDb = db.checkout(version)

  // 5. do a lookup on that key
  oldDb.get(node.key, cb)
}

// [Head] -> Buffer
function headsToVersion (heads) {
  var bufAccum = []

  for (var i = 0; i < heads.length; i++) {
    bufAccum.push(heads[i].key)
    bufAccum.push(toBuffer(varint.encode(heads[i].seq)))
  }

  return Buffer.concat(bufAccum)
}
