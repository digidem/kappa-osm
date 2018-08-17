var umbr = require('unordered-materialized-backrefs')

function createIndex (ldb) {
  var br = umbr(ldb)
  return {
    maxBatch: 100,
    map: function (nodes, next) {
      var ops = nodes
        .filter(function (node) {
          return node.value.type === 'osm/element'
        })
        .reduce(function (accum, node) {
          var version = node.key.toString('hex') + '@' + node.seq
          var id = version + '!' + node.value.id
          var elm = node.value.element
          var links = node.value.links.map(function (version) {
            return version + '!' + node.value.id
          })
          if (isDel(node)) {
            accum.push({
              id: id,
              refs: [],
              links: links
            })
          } else if (elm.refs) {
            accum.push({
              id: id,
              refs: elm.refs,
              links: links
            })
          } else if (elm.members) {
            var refs = elm.members.map(function (member) {
              return member.id
            })
            accum.push({
              id: id,
              refs: refs,
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
      ldb.put('state', state, cb)
    },
    fetchState: function (cb) {
      ldb.get('state', function (err, state) {
        if (err && err.notFound) cb()
        else if (err) cb(err)
        else cb(null, state)
      })
    }
  }
}

module.exports = createIndex

function isDel (node) {
  return node && node.value && node.value.element
    && !!node.value.element.deleted
}
