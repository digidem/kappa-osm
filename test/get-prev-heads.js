var test = require('tape')
var createDb = require('./lib/create-db')
var setup = require('./lib/setup')

test.skip('node with one previous head', function (t) {
  var node = {
    type: 'node',
    lat: '64.5',
    lon: '-147.3',
    changeset: '15'
  }

  var osm = createDb()
  osm.put('A', node, function (err, prev) {
    t.error(err)
    node.changeset = '16'
    osm.put('A', node, function (err, elm) {
      t.error(err)
      osm.getPreviousHeads(elm.version, function (err, elms) {
        t.error(err)
        t.equals(elms.length, 1)
        t.equals(elms[0].version, prev.version)
        t.equals(elms[0].changeset, '15')
        t.end()
      })
    })
  })
})

//       /-- C1 <--\
// C <---           --- C3
//       \-- C2 <--/
test.skip('node with two previous heads', function (t) {
  var elms = [
    { type: 'node', id: 'A', lat: '64.5', lon: '-147.3', changeset: '15' },
    { type: 'node', id: 'B', lat: '63.9', lon: '-147.6', changeset: '15' },
    { type: 'node', id: 'C', lat: '64.2', lon: '-146.5', changeset: '15' },
    { type: 'way', id: 'D', refs: [ 'A', 'B', 'C' ], changeset: '15' }
  ]

  createDb.two(function (osm0, osm1) {
    var versions = {}

    setup(osm0, elms, function (err, elms) {
      t.error(err)
      elms.forEach(function (elm) {
        versions[elm.id] = [elm.version]
      })
      replicate(osm0, osm1, function () {
        var newdoc0 = { type: 'node', lat: 62.5, lon: -146.2, changeset: '14' }
        var newdoc1 = { type: 'node', lat: 62.4, lon: -146.3, changeset: '16' }
        osm0.put('C', newdoc0, function (err, elm) {
          t.ifError(err)
          versions.C.push(elm.version)
          osm1.put('C', newdoc1, function (err, elm) {
            t.ifError(err)
            versions.C.push(elm.version)
            replicate(osm0, osm1, function () {
              osm0.del('C', { changeset: '19' }, function (err, elm) {
                t.error(err)
                versions.C.push(elm.version)
                replicate(osm0, osm1, check)
              })
            })
          })
        })
      })
    })

    function check () {
      osm0.getPreviousHeads(versions.C[3], function (err, elms) {
        t.error(err)
        t.equals(elms.length, 2)
        var eq1 = elms[0].version === versions.C[1] && elms[1].version === versions.C[2]
        var eq2 = elms[1].version === versions.C[2] && elms[0].version === versions.C[1]
        t.ok(eq1 || eq2)
        t.end()
      })
    }
  })
})

function replicate (osm0, osm1, cb) {
  var r0 = osm0.replicate()
  var r1 = osm1.replicate()
  r0.pipe(r1).pipe(r0)
  r0.once('end', cb)
}
