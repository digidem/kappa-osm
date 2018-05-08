var LevelIndex = require('hyperdb-index-level')
var sub = require('subleveldown')
var through = require('through2')
var readonly = require('read-only-stream')
var utils = require('./utils')

function createIndex (hdb, ldb) {
  ldb = sub(ldb, 'refs')
  var idx = LevelIndex(hdb, ldb, onNode)

  // TODO: this needs to erase old, non-head refs as they are replaced!
  // otherwise we'll be wasting a lot of space.
  function onNode (node, next) {
    var id = idFromKey(node.key)
    var version = utils.nodeToVersion(hdb, node)
    var elm = node.value
    var ops = []
    if (elm.refs) {
      ops = elm.refs.map(function (refId) {
        return {
          type: 'put',
          key: refId + '!' + version,
          value: id
        }
      })
    } else if (elm.members) {
      ops = elm.members.map(function (member) {
        return {
          type: 'put',
          key: member.id + '!' + version,
          value: id
        }
      })
    }

    if (elm.changeset) {
      ops.push({
        type: 'put',
        key: elm.changeset + '!' + version,
        value: id
      })
    }

    utils.getPreviousHeads(hdb, node, function (err, heads) {
      if (err) return next(err)
      if (!heads || !heads.length) return done()

      for (var i = 0; i < heads.length; i++) {
        var head = heads[i]
        var elm = head.value
        var headVersion = utils.nodeToVersion(hdb, head)
        var newOps = []
        if (elm.type === 'way' && elm.refs) {
          newOps = elm.refs.map(function (r) {
            return {
              type: 'del',
              key: r + '!' + headVersion
            }
          })
        } else if (elm.type === 'relation') {
          newOps = elm.members.map(function (m) {
            return {
              type: 'del',
              key: m.id + '!' + headVersion
            }
          })
        }
        ops.push.apply(ops, newOps)
      }
      done()
    })

    function done () {
      if (ops.length) ldb.batch(ops, next)
      else next()
    }
  }

  idx.getReferersById = function (id, cb) {
    var res = []

    var t = through.obj(function (row, enc, next) {
      next(null, row2obj(row))
    })

    function row2obj (row) {
      return {
        id: row.value,
        version: row.key.split('!')[1]
      }
    }

    this.ready(function () {
      var r = ldb.createReadStream({
        gte: id + '!',
        lte: id + '~'
      })
      if (!cb) {
        r.pipe(t)
      } else {
        r.on('data', function (row) { res.push(row2obj(row)) })
        r.once('end', cb.bind(null, null, res))
        r.once('error', cb)
      }
    })

    if (!cb) return readonly(t)
  }

  return idx
}

// HyperDbKey -> Id
function idFromKey (key) {
  return key.substring(key.lastIndexOf('/') + 1)
}

module.exports = createIndex
