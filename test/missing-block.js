var test = require('tape')
var createDb = require('./lib/create-db')

test('arbitrary missing block', function (t) {
	t.plan(3)

	var batch = [
    {
      type: 'put',
      id: 'A',
      value: { type: 'node', refs: [], links: [], changeset: '1' }
    }
  ]

	createDb.two(function (osm0, osm1) {
		replicate(osm0, osm1, function () {
			const feeds = osm0.core.feeds()
			const feed = feeds[0]
			batch[0].value.links.push(feed.key.toString('hex')+'@1')

			osm1.on('error', function (error) {
				console.log('got an error!', error)
				t.error(error, 'error emitted')
			})

			osm1.batch(batch, function (error, docs) {
				t.error(error, 'no batch error')
				t.ok(docs.length === 1, 'correct batch docs length')
			})
		})
  })
})

test('arbitrary missing block, continue indexing', function (t) {
  t.plan(3)

  var batch = [
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

  createDb.two(function (osm0, osm1) {
    replicate(osm0, osm1, function () {
			const feeds = osm0.core.feeds()
			const feed = feeds[0]
			batch[0].value.links = [feed.key.toString('hex')+'@5']

			osm1.on('error', function (error) {
				console.log('got an error!', error)
				t.error(error, 'error emitted')
			})

			osm1.batch(batch, function (error, docs) {
				t.error(error, 'no batch error')
				t.ok(docs.length === 4, 'correct batch docs length')
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
