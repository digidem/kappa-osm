var test = require('tape')
var createDb = require('./lib/create-db')

test('create nodes', function (t) {
  var db = createDb({ index: null })
  t.plan(2)

  var nodes = [
    {
      type: 'node',
      changeset: '9',
      lat: '-11',
      lon: '-10',
      timestamp: '2017-10-10T19:55:08.570Z'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '-11',
      lon: '-10'
    }
  ]

  var batch = nodes.map(function (node) {
    return {
      type: 'put',
      value: node
    }
  })

  db.batch(batch, function (err, elms) {
    t.error(err)
    elms.forEach(clearIdVersion)
    t.deepEquals(elms, nodes)
  })
})
function clearIdVersion (elm) {
  delete elm.id
  delete elm.version
  delete elm.deviceId
}
