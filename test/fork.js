var test = require('tape')
var createDb = require('./lib/create-db')
var setup = require('./lib/setup')

test.only('2-peer node fork', function (t) {
  t.plan(11)

  var elms = [
    { type: 'node', id: 'A', lat: '64.5', lon: '-147.3', changeset: '15' },
    { type: 'node', id: 'B', lat: '63.9', lon: '-147.6', changeset: '15' },
    { type: 'node', id: 'C', lat: '64.2', lon: '-146.5', changeset: '15' },
    { type: 'way', id: 'D', refs: [ 'A', 'B', 'C' ], changeset: '15' }
  ]

  createDb.two(function (osm0, osm1) {
    var versions = {}
    osm0.core._name = 'osm0'
    osm1.core._name = 'osm1'

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
            replicate(osm0, osm1, check)
          })
        })
      })
    })

    function check () {
      var q0 = [-148,63,-146,65]
      var ex0 = [
        {
          type: 'osm/element',
          id: 'A',
          links: [],
          element: {
            type: 'node',
            lat: '64.5',
            lon: '-147.3',
            changeset: '15'
          },
          version: versions.A[0]
        },
        {
          type: 'osm/element',
          id: 'B',
          links: [],
          element: {
            type: 'node',
            lat: '63.9',
            lon: '-147.6',
            changeset: '15'
          },
          version: versions.B[0]
        },
        {
          type: 'osm/element',
          id: 'C',
          links: [versions.C[0]],
          element: {
            type: 'node',
            lat: '62.5',
            lon: '-146.2',
            changeset: '14'
          },
          version: versions.C[1]
        },
        {
          type: 'osm/element',
          id: 'C',
          links: [versions.C[0]],
          element: {
            type: 'node',
            lat: '62.4',
            lon: '-146.3',
            changeset: '16',
          },
          version: versions.C[2]
        },
        {
          type: 'osm/element',
          id: 'D',
          links: [],
          element: {
            type: 'way',
            refs: [ 'A', 'B', 'C' ],
            changeset: '15'
          },
          version: versions.D[0]
        }
      ].sort(idcmp)
      osm0.query(q0, function (err, res) {
        console.log('RES=',res.sort(idcmp))
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex0, 'updated query 0 (osm0)')
      })
      /*
      osm1.query(q0, function (err, res) {
        console.log('RES=',res.sort(idcmp))
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex0, 'updated query 0 (osm1)')
      })
      */
      var q1 = [-149.5,62,-146,64]
      var ex1 = [
        {
          type: 'osm/element',
          id: 'A',
          links: [],
          element: {
            type: 'node',
            lat: '64.5',
            lon: '-147.3',
            changeset: '15'
          },
          version: versions.A[0]
        },
        {
          type: 'osm/element',
          id: 'B',
          links: [],
          element: {
            type: 'node',
            lat: '63.9',
            lon: '-147.6',
            changeset: '15'
          },
          version: versions.B[0]
        },
        {
          type: 'osm/element',
          id: 'C',
          links: [versions.C[0]],
          element: {
            type: 'node',
            lat: '62.5',
            lon: '-146.2',
            changeset: '14'
          },
          version: versions.C[1]
        },
        {
          type: 'osm/element',
          id: 'C',
          links: [versions.C[0]],
          element: {
            type: 'node',
            lat: '62.4',
            lon: '-146.3',
            changeset: '16'
          },
          version: versions.C[2]
        },
        {
          type: 'osm/element',
          id: 'D',
          links: [],
          element: {
            type: 'way',
            refs: [ 'A', 'B', 'C' ],
            changeset: '15'
          },
          version: versions.D[0]
        }
      ].sort(idcmp)
      /*
      osm0.query(q1, function (err, res) {
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex1, 'updated query 1 (osm0)')
      })
      osm1.query(q1, function (err, res) {
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex1, 'updated query 1 (osm1)')
      })
      */
    }
  })
})

//       /-- A1 <--\
// A <---           --- (deletion)
//       \-- A2 <--/
test('2-peer deletion of forked nodes', function (t) {
  t.plan(8)

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
      var q0 = [[63, 65], [-148, -146]]
      var ex0 = [
        { type: 'node',
          lat: '64.5',
          lon: '-147.3',
          id: 'A',
          changeset: '15',
          version: versions.A[0] },
        { type: 'node',
          lat: '63.9',
          lon: '-147.6',
          id: 'B',
          changeset: '15',
          version: versions.B[0] },
        { deleted: true,
          id: 'C',
          changeset: '19',
          version: versions.C[3] },
        { type: 'way',
          refs: [ 'A', 'B', 'C' ],
          id: 'D',
          changeset: '15',
          version: versions.D[0] }
      ].sort(idcmp)
      osm0.query(q0, function (err, res) {
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex0, 'updated query 0')
      })
      osm1.query(q0, function (err, res) {
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex0, 'updated query 0')
      })
    }
  })
})

function idcmp (a, b) {
  var aloc = a.lat + ',' + a.lon
  var bloc = b.lat + ',' + b.lon
  if (a.id === b.id) return aloc < bloc ? -1 : 1
  return a.id < b.id ? -1 : 1
}

function replicate (osm0, osm1, cb) {
  var r0 = osm0.replicate()
  var r1 = osm1.replicate()
  r0.pipe(r1).pipe(r0)
  var pending = 2
  r0.once('end', onend)
  r1.once('end', onend)
  function onend () {
    if (--pending !== 0) return
    var p = 2
    osm0.ready(onready)
    osm1.ready(onready)
    function onready () { if (--p === 0) cb() }
  }
}
