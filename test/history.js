var test = require('tape')
var createDb = require('./lib/create-db')
var collect = require('./lib/collect')

test('get all docs ordered by date', function (t) {
  t.plan(3)
  var db = createDb()
  var batch = [
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '3',
        lon: '4',
        timestamp: '2018-09-01T00:00:00.000Z',
        links: []
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '1',
        lon: '2',
        timestamp: '2017-12-01T00:00:00.000Z',
        links: []
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '5',
        lon: '6',
        timestamp: '2019-08-01T00:00:00.000Z',
        links: []
      }
    }
  ]
  db.batch(batch, function (err, res) {
    t.error(err)
    collect(db.history(), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'node',
          lat: '1',
          lon: '2',
          timestamp: '2017-12-01T00:00:00.000Z',
          id: res[1].id,
          version: res[1].version,
          deviceId: res[1].deviceId,
          links: []
        },
        {
          type: 'node',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version,
          deviceId: res[0].deviceId,
          links: []
        },
        {
          type: 'node',
          lat: '5',
          lon: '6',
          timestamp: '2019-08-01T00:00:00.000Z',
          id: res[2].id,
          version: res[2].version,
          deviceId: res[2].deviceId,
          links: []
        }
      ])
      t.end()
    })
  })
})

test('get all docs by type ordered by date', function (t) {
  t.plan(5)
  var db = createDb()
  var batch = [
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '3',
        lon: '4',
        timestamp: '2018-09-01T00:00:00.000Z',
        links: []
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '1',
        lon: '2',
        timestamp: '2017-12-01T00:00:00.000Z',
        links: []
      }
    },
    {
      type: 'put',
      value: {
        type: 'way',
        timestamp: '2018-04-01T00:00:00.000Z',
        links: []
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '5',
        lon: '6',
        timestamp: '2019-08-01T00:00:00.000Z',
        links: []
      }
    }
  ]
  db.batch(batch, function (err, res) {
    t.error(err)
    collect(db.history({ type: 'node' }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'node',
          lat: '1',
          lon: '2',
          timestamp: '2017-12-01T00:00:00.000Z',
          id: res[1].id,
          version: res[1].version,
          deviceId: res[1].deviceId,
          links: []
        },
        {
          type: 'node',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version,
          deviceId: res[0].deviceId,
          links: []
        },
        {
          type: 'node',
          lat: '5',
          lon: '6',
          timestamp: '2019-08-01T00:00:00.000Z',
          id: res[3].id,
          version: res[3].version,
          deviceId: res[3].deviceId,
          links: []
        }
      ])
    })
    collect(db.history({ type: 'way' }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'way',
          timestamp: '2018-04-01T00:00:00.000Z',
          id: res[2].id,
          version: res[2].version,
          deviceId: res[2].deviceId,
          links: []
        }
      ])
    })
  })
})

test('observation history', function (t) {
  t.plan(3)
  var db = createDb()
  var batch = [
    {
      type: 'put',
      value: {
        type: 'observation',
        created_at: '2018-09-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'observation',
        created_at: '2017-12-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'way',
        timestamp: '2018-04-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'observation',
        created_at: '2019-08-01T00:00:00.000Z'
      }
    }
  ]
  db.batch(batch, function (err, res) {
    t.error(err)
    collect(db.history({ type: 'observation' }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'observation',
          created_at: '2017-12-01T00:00:00.000Z',
          id: res[1].id,
          version: res[1].version,
          deviceId: res[1].deviceId,
          links: []
        },
        {
          type: 'observation',
          created_at: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version,
          deviceId: res[0].deviceId,
          links: []
        },
        {
          type: 'observation',
          created_at: '2019-08-01T00:00:00.000Z',
          id: res[3].id,
          version: res[3].version,
          deviceId: res[3].deviceId,
          links: []
        }
      ])
      t.end()
    })
  })
})

test('reverse observation history', function (t) {
  t.plan(3)
  var db = createDb()
  var batch = [
    {
      type: 'put',
      value: {
        type: 'observation',
        created_at: '2018-09-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'observation',
        created_at: '2017-12-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'way',
        timestamp: '2018-04-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'observation',
        created_at: '2019-08-01T00:00:00.000Z'
      }
    }
  ]
  db.batch(batch, function (err, res) {
    t.error(err)
    collect(db.history({ type: 'observation', reverse: true }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'observation',
          created_at: '2019-08-01T00:00:00.000Z',
          id: res[3].id,
          version: res[3].version,
          deviceId: res[3].deviceId,
          links: []
        },
        {
          type: 'observation',
          created_at: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version,
          deviceId: res[0].deviceId,
          links: []
        },
        {
          type: 'observation',
          created_at: '2017-12-01T00:00:00.000Z',
          id: res[1].id,
          version: res[1].version,
          deviceId: res[1].deviceId,
          links: []
        }
      ])
      t.end()
    })
  })
})

test('get history by id', function (t) {
  t.plan(10)
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
      },
      {
        type: 'put',
        id: 'B',
        value: {
          type: 'node',
          lat: '1',
          lon: '2',
          timestamp: '2017-12-01T00:00:00.000Z'
        }
      }
    ],
    [
      {
        type: 'put',
        id: 'A',
        value: {
          type: 'node',
          lat: '3.3',
          lon: '4.4',
          timestamp: '2018-09-01T01:00:00.000Z'
        }
      }
    ],
    [
      {
        type: 'put',
        id: 'A',
        value: {
          type: 'node',
          lat: '3.33',
          lon: '4.44',
          timestamp: '2018-09-01T02:00:00.000Z'
        }
      },
      {
        type: 'put',
        id: 'B',
        value: {
          type: 'node',
          lat: '1.11',
          lon: '2.22',
          timestamp: '2017-12-01T01:00:00.000Z'
        }
      }
    ],
    [ // this one is first, testing for out of order:
      {
        type: 'put',
        id: 'A',
        value: {
          type: 'node',
          lat: '3.01',
          lon: '4.01',
          timestamp: '2017-09-01T00:00:00.000Z'
        }
      }
    ]
  ]
  var results = []
  ;(function next (i) {
    var batch = batches[i]
    if (!batch) return check()
    db.batch(batch, function (err, res) {
      t.error(err)
      results.push(res)
      next(i + 1)
    })
  })(0)

  function check () {
    collect(db.history({ id: 'A' }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'node',
          id: 'A',
          lat: '3.01',
          lon: '4.01',
          timestamp: '2017-09-01T00:00:00.000Z',
          version: results[3][0].version,
          deviceId: results[3][0].deviceId,
          links: [results[2][0].version]
        },
        {
          type: 'node',
          id: 'A',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z',
          version: results[0][0].version,
          deviceId: results[0][0].deviceId,
          links: []
        },
        {
          type: 'node',
          id: 'A',
          lat: '3.3',
          lon: '4.4',
          timestamp: '2018-09-01T01:00:00.000Z',
          version: results[1][0].version,
          deviceId: results[1][0].deviceId,
          links: [results[0][0].version]
        },
        {
          type: 'node',
          id: 'A',
          lat: '3.33',
          lon: '4.44',
          timestamp: '2018-09-01T02:00:00.000Z',
          version: results[2][0].version,
          deviceId: results[2][0].deviceId,
          links: [results[1][0].version]
        }
      ])
    })
    collect(db.history({ id: 'B' }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [
        {
          type: 'node',
          id: 'B',
          lat: '1',
          lon: '2',
          timestamp: '2017-12-01T00:00:00.000Z',
          version: results[0][1].version,
          deviceId: results[0][1].deviceId,
          links: []
        },
        {
          type: 'node',
          id: 'B',
          lat: '1.11',
          lon: '2.22',
          timestamp: '2017-12-01T01:00:00.000Z',
          version: results[2][1].version,
          deviceId: results[2][1].deviceId,
          links: [results[0][1].version]
        }
      ])
    })
    collect(db.history({ id: 'C' }), function (err, docs) {
      t.error(err)
      t.deepEqual(docs, [])
    })
  }
})

test('exclusive id and type history sorting options', function (t) {
  t.plan(2)
  var db = createDb()
  var batch = [
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
  db.batch(batch, function (err, res) {
    t.error(err)
    collect(db.history({ id: 'A', type: 'node' }), function (err, docs) {
      t.ok(err, 'error present for exclusive options')
    })
  })
})
