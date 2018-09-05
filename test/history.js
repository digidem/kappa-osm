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
        timestamp: '2018-09-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '1',
        lon: '2',
        timestamp: '2017-12-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '5',
        lon: '6',
        timestamp: '2019-08-01T00:00:00.000Z'
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
          version: res[1].version
        },
        {
          type: 'node',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version
        },
        {
          type: 'node',
          lat: '5',
          lon: '6',
          timestamp: '2019-08-01T00:00:00.000Z',
          id: res[2].id,
          version: res[2].version
        }
      ])
      t.end()
    })
  })
})

test('get all docs by type ordered by date', function (t) {
  t.plan(3)
  var db = createDb()
  var batch = [
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '3',
        lon: '4',
        timestamp: '2018-09-01T00:00:00.000Z'
      }
    },
    {
      type: 'put',
      value: {
        type: 'node',
        lat: '1',
        lon: '2',
        timestamp: '2017-12-01T00:00:00.000Z'
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
        type: 'node',
        lat: '5',
        lon: '6',
        timestamp: '2019-08-01T00:00:00.000Z'
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
          version: res[1].version
        },
        {
          type: 'node',
          lat: '3',
          lon: '4',
          timestamp: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version
        },
        {
          type: 'node',
          lat: '5',
          lon: '6',
          timestamp: '2019-08-01T00:00:00.000Z',
          id: res[3].id,
          version: res[3].version
        }
      ])
      t.end()
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
          version: res[1].version
        },
        {
          type: 'observation',
          created_at: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version
        },
        {
          type: 'observation',
          created_at: '2019-08-01T00:00:00.000Z',
          id: res[3].id,
          version: res[3].version
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
          version: res[3].version
        },
        {
          type: 'observation',
          created_at: '2018-09-01T00:00:00.000Z',
          id: res[0].id,
          version: res[0].version
        },
        {
          type: 'observation',
          created_at: '2017-12-01T00:00:00.000Z',
          id: res[1].id,
          version: res[1].version
        }
      ])
      t.end()
    })
  })
})
