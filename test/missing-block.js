var test = require('tape')
var createDb = require('./lib/create-db')

test('missing block', function (t) {
  // t.plan(4)
  var batch0 = [
    {
      type: 'put',
      id: 'A',
      value: { type: 'node', lat: '64.5', lon: '-147.3', changeset: '15' }
    },
    {
      type: 'put',
      id: 'B',
      value: { type: 'node', lat: '63.9', lon: '-147.6', changeset: '15' }
    },
    {
      type: 'put',
      id: 'C',
      value: { type: 'node', lat: '64.2', lon: '-146.5', changeset: '15' }
    },
    {
      type: 'put',
      id: 'D',
      value: { type: 'way', refs: [ 'A', 'B', 'C' ], changeset: '15' }
    }
  ]
  var batch1 = [
    {
      type: 'put',
      id: 'D',
      value: { type: 'way', refs: [ 'A', 'B' ], links: [], changeset: '16' }
    }
  ]
  var versions = { A: [], B: [], C: [], D: [] }
  createDb.two(function (osm0, osm1) {
    osm0.batch(batch0, function (err, docs) {
      t.error(err)
      docs.forEach(function (doc) {
        versions[doc.id].push(doc.version)
      })
      replicate(osm0, osm1, function () {
				batch1[0].value.links.push(osm0.core._logs._feeds.default.key.toString('hex')+'@5')

				osm1.on('error', function (error) {
					console.log('error', error)
					t.error(error)
					t.end() // todo: remove and use t.plan
				})

        osm1.batch(batch1, function (err, docs) {
					osm1.ready(() => {
						// t.end()
					})
        })
      })
    })
  })
})

function replicate (osm0, osm1, cb) {
  var pending = 2
  osm0.ready(onready)
  osm1.ready(onready)
  function onready () {
    if (--pending !== 0) return
    var r0 = osm0.replicate(true)
    var r1 = osm1.replicate(false)
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
