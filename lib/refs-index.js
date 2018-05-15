var umbr = require('unordered-materialized-backrefs')

function createIndex (ldb) {
  var br = umbr(ldb)

  // TODO: this needs to erase old, non-head refs as they are replaced!
  // otherwise we'll be wasting a lot of space.
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
          if (elm.refs) {
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
    }
  }
}

module.exports = createIndex
