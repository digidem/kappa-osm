var test = require('tape')
var createDb = require('./lib/create-db')

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
    db._getAuthor('A', function (err, deviceId) {
      t.error(err)
      t.deepEqual(deviceId, results[2][0].deviceId)
    })
    db._getAuthor('B', function (err, deviceId) {
      t.error(err)
      t.deepEqual(deviceId, results[2][1].deviceId)
    })
    db._getAuthor('C', function (err, deviceId) {
      t.error(err)
      t.deepEqual(deviceId, null)
    })
  }
})
