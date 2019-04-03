var test = require('tape')
var createDb = require('./lib/create-db')
var setup = require('./lib/setup')

test('merge', function (t) {
  t.plan(17)

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
        var newdoc2 = { type: 'node', lat: 62.3, lon: -146.4, changeset: '17' }
        osm0.put('C', newdoc0, function (err, elm) {
          t.ifError(err)
          versions.C.push(elm.version)
          osm1.put('C', newdoc1, function (err, elm) {
            t.ifError(err)
            versions.C.push(elm.version)
            replicate(osm0, osm1, function (err) {
              t.error(err)
              osm0.put('C', newdoc2, function (err, elm) {
                t.ifError(err)
                versions.C.push(elm.version)
                replicate(osm0, osm1, check)
              })
            })
          })
        })
      })
    })

    function check () {
      var q0 = [-148, 63, -146, 65]
      var ex0 = [
        {
          id: 'A',
          links: [],
          type: 'node',
          lat: '64.5',
          lon: '-147.3',
          changeset: '15',
          version: versions.A[0]
        },
        {
          id: 'B',
          links: [],
          type: 'node',
          lat: '63.9',
          lon: '-147.6',
          changeset: '15',
          version: versions.B[0]
        },
        {
          id: 'C',
          links: [versions.C[1], versions.C[2]].sort(),
          type: 'node',
          lat: '62.3',
          lon: '-146.4',
          changeset: '17',
          version: versions.C[3]
        },
        {
          id: 'D',
          links: [],
          type: 'way',
          refs: [ 'A', 'B', 'C' ],
          changeset: '15',
          version: versions.D[0]
        }
      ].sort(idcmp)
      osm0.query(q0, function (err, res) {
        t.ifError(err)
        t.deepEqual(sortLinks(rmTimestamp(res)).sort(idcmp), ex0, 'updated query 0 (osm0)')
        t.deepEqual(rmTimestamp(res).map(idof).sort(), ex0.map(idof).sort())
      })
      osm1.query(q0, function (err, res) {
        t.ifError(err)
        t.deepEqual(sortLinks(rmTimestamp(res)).sort(idcmp), ex0, 'updated query 0 (osm1)')
        t.deepEqual(rmTimestamp(res).map(idof).sort(), ex0.map(idof).sort())
      })
      var q1 = [-149.5, 62, -146, 64]
      var ex1 = [
        {
          id: 'A',
          links: [],
          type: 'node',
          lat: '64.5',
          lon: '-147.3',
          changeset: '15',
          version: versions.A[0]
        },
        {
          id: 'B',
          links: [],
          type: 'node',
          lat: '63.9',
          lon: '-147.6',
          changeset: '15',
          version: versions.B[0]
        },
        {
          id: 'C',
          links: [versions.C[1], versions.C[2]].sort(),
          type: 'node',
          lat: '62.3',
          lon: '-146.4',
          changeset: '17',
          version: versions.C[3]
        },
        {
          id: 'D',
          links: [],
          type: 'way',
          refs: [ 'A', 'B', 'C' ],
          changeset: '15',
          version: versions.D[0]
        }
      ].sort(idcmp)
      osm0.query(q1, function (err, res) {
        t.ifError(err)
        t.deepEqual(sortLinks(rmTimestamp(res)).sort(idcmp), ex1, 'updated query 1 (osm0)')
        t.deepEqual(rmTimestamp(res).map(idof).sort(), ex1.map(idof).sort())
      })
      osm1.query(q1, function (err, res) {
        t.ifError(err)
        t.deepEqual(sortLinks(rmTimestamp(res)).sort(idcmp), ex1, 'updated query 1 (osm1)')
        t.deepEqual(rmTimestamp(res).map(idof).sort(), ex1.map(idof).sort())
      })
    }
  })
})

function idcmp (a, b) {
  if (a.id === b.id) return a.version < b.version ? -1 : 1
  return a.id < b.id ? -1 : 1
}

function replicate (osm0, osm1, cb) {
  var pending = 2
  osm0.ready(onready)
  osm1.ready(onready)
  function onready () {
    if (--pending !== 0) return
    var r0 = osm0.replicate()
    var r1 = osm1.replicate()
    pending = 2
    r0.pipe(r1).pipe(r0)
    r0.once('end', onend)
    r1.once('end', onend)
  }
  function onend () {
    if (--pending !== 0) return
    var p = 2
    osm0.ready(onready)
    osm1.ready(onready)
    function onready () { if (--p === 0) cb() }
  }
}

function idof (doc) { return doc.id }

function sortLinks (rows) {
  return rows.map(function (row) {
    var copy = Object.assign({}, row)
    copy.links = copy.links.slice().sort()
    return copy
  })
}

function rmTimestamp (nodes) {
  return nodes.map(function (node) {
    node = Object.assign({}, node)
    delete node.timestamp
    return node
  })
}
