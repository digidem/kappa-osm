var test = require('tape')
var createDb = require('./lib/create-db')
var setup = require('./lib/setup')

test('2-peer node fork', function (t) {
  t.plan(11)

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
            replicate(osm0, osm1, check)
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
        { type: 'node',
          lat: '62.5',
          lon: '-146.2',
          id: 'C',
          changeset: '14',
          version: versions.C[1] },
        { type: 'node',
          lat: '62.4',
          lon: '-146.3',
          id: 'C',
          changeset: '16',
          version: versions.C[2] },
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
      var q1 = [[62, 64], [-149.5, -146]]
      var ex1 = [
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
        { type: 'node',
          lat: '62.5',
          lon: '-146.2',
          changeset: '14',
          id: 'C',
          version: versions.C[1] },
        { type: 'node',
          lat: '62.4',
          lon: '-146.3',
          changeset: '16',
          id: 'C',
          version: versions.C[2] },
        { type: 'way',
          refs: [ 'A', 'B', 'C' ],
          id: 'D',
          changeset: '15',
          version: versions.D[0] }
      ].sort(idcmp)
      osm0.query(q1, function (err, res) {
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex1, 'updated query 1')
      })
      osm1.query(q1, function (err, res) {
        t.ifError(err)
        t.deepEqual(res.sort(idcmp), ex1, 'updated query 1')
      })
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
  r0.once('end', cb)
}
