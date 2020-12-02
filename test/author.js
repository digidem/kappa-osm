var test = require('tape')
var createDb = require('./lib/create-db')
var setup = require('./lib/setup')
var pump = require('pump')

test('original entry has authorId set', function (t) {
  t.plan(4)

  var db = createDb()
  var batches = [
    [
      {
        type: 'put',
        id: 'A',
        value: {
          type: 'node',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z'
        }
      }
    ]
  ]

  batchesWrite(db, batches, (err, res) => {
    t.error(err, 'batch writes ok')

    db.get('A', (err, elms) => {
      t.error(err, 'got element ok')
      t.equals(elms.length, 1, 'one result')
      const elm = elms[0]
      t.deepEquals(elm.deviceId, elm.authorId, 'authorId and deviceId are the same')
    })
  })
})

test('first edit with same authorId', function (t) {
  t.plan(4)

  var db = createDb()
  var batches = [
    [
      {
        type: 'put',
        id: 'A',
        value: {
          type: 'node',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z'
        }
      }
    ],
    [
      {
        type: 'put',
        id: 'A',
        value: {
          type: 'node',
          lat: '4',
          lon: '5',
          timestamp: '2018-09-02T00:00:00.000Z'
        }
      }
    ]
  ]

  batchesWrite(db, batches, (err, res) => {
    t.error(err, 'batch writes ok')

    db.get('A', (err, elms) => {
      t.error(err, 'got element ok')
      t.equals(elms.length, 1, 'one result')
      const elm = elms[0]
      t.deepEquals(elm.deviceId, elm.authorId, 'authorId and deviceId are the same')
    })
  })
})

test('edit performed by a different author', function (t) {
  t.plan(20)

  const batch0 = [
    {
      type: 'put',
      id: 'A',
      value: {
        type: 'node',
        lat: '3',
        lon: '4',
        timestamp: '2018-09-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      id: 'B',
      value: {
        type: 'node',
        lat: '3',
        lon: '4',
        timestamp: '2018-09-01T00:00:00.000Z'
      }
    }
  ]
  const batch1 = [
    {
      type: 'put',
      id: 'A',
      value: {
        type: 'node',
        lat: '4',
        lon: '5',
        timestamp: '2018-10-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      id: 'B',
      value: {
        type: 'node',
        lat: '4',
        lon: '5',
        timestamp: '2018-10-01T00:00:00.000Z'
      }
    }
  ]

  createDb.two(function (osm0, osm1) {
    const key0 = osm0.core.feeds()[0].key.toString('hex')
    const key1 = osm1.core.feeds()[0].key.toString('hex')
    var versions = {}
    setup(osm0, batch0, function (err, elms) {
      t.error(err, 'osm0 setup ok')
      replicate(osm0, osm1, err => {
        t.error(err, 'sync ok')
        setup(osm1, batch1, function (err, elms) {
          t.error(err, 'osm1 setup ok')
          replicate(osm0, osm1, err => {
            t.error(err, 'sync ok')
            check()
          })
        })
      })
    })

    function check () {
      osm0.get('A', (err, elms) => {
        t.error(err, 'got elements ok')
        t.equals(elms.length, 1, 'one result')
        const elm = elms[0]
        t.deepEquals(elm.deviceId, key1, 'deviceId ok')
        t.deepEquals(elm.authorId, key0, 'authorId ok')
      })
      osm1.get('A', (err, elms) => {
        t.error(err, 'got elements ok')
        t.equals(elms.length, 1, 'one result')
        const elm = elms[0]
        t.deepEquals(elm.deviceId, key1, 'deviceId ok')
        t.deepEquals(elm.authorId, key0, 'authorId ok')
      })
      osm0.get('B', (err, elms) => {
        t.error(err, 'got elements ok')
        t.equals(elms.length, 1, 'one result')
        const elm = elms[0]
        t.deepEquals(elm.deviceId, key1, 'deviceId ok')
        t.deepEquals(elm.authorId, key0, 'authorId ok')
      })
      osm1.get('B', (err, elms) => {
        t.error(err, 'got elements ok')
        t.equals(elms.length, 1, 'one result')
        const elm = elms[0]
        t.deepEquals(elm.deviceId, key1, 'deviceId ok')
        t.deepEquals(elm.authorId, key0, 'authorId ok')
      })
    }
  })
})

// TODO: create utility function + share across tests
function replicate (osm0, osm1, cb) {
  osm0.ready(() => {
    osm1.ready(onready)
  })
  function onready () {
    var r0 = osm0.replicate(true)
    var r1 = osm1.replicate(false)
    pump(r0, r1, r0, err => {
      if (err) return cb(err)
      osm0.ready(() => {
        osm1.ready(cb)
      })
    })
  }
}

// Write multiple batches of batch writes.
// So, Array<Array<WriteOp>>
function batchesWrite (db, batches, cb) {
  var results = []
  ;(function next (i) {
    var batch = batches[i]
    if (!batch) return cb(null, results)
    db.batch(batch, function (err, res) {
      if (err) return cb(err)
      results.push(res)
      next(i + 1)
    })
  })(0)
}
