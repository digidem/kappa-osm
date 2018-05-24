var test = require('tape')
var createDb = require('./lib/create-db')

test('update to different type', function (t) {
  t.plan(2)

  var db = createDb()

  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z'
  }
  var way = {
    type: 'way',
    changeset: '9',
    nodes: ['1']
  }

  db.create(node, function (err, node) {
    t.error(err)
    db.put(node.id, way, function (err) {
      t.ok(err instanceof Error)
    })
  })
})

test('put with pre-set id', function (t) {
  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z',
    id: 'PLACEHOLDER'
  }

  t.plan(4)

  var db = createDb()

  db.put('foobar', node, function (err, elm) {
    t.error(err)
    t.notEquals('PLACEHOLDER', elm.id)
    db.ready(function () {
      db.get(elm.version, function (err, elm) {
        t.error(err)
        t.notEquals('PLACEHOLDER', elm.id)
      })
    })
  })
})

test('update good nodes', function (t) {
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

  t.plan(6)

  var db = createDb()

  db.create(nodes[0], function (err, elm1) {
    t.error(err)
    t.ok(elm1)
    db.put(elm1.id, nodes[1], function (err, elm2) {
      t.error(err)
      t.ok(elm1)
      t.equals(elm1.id, elm2.id)
      t.notEquals(elm1.version, elm2.version)
    })
  })
})

test('update bad nodes', function (t) {
  var nodes = [
    {
      type: 'node'
    },
    {
      type: 'node',
      changeset: '9'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '12'
    },
    {
      type: 'node',
      changeset: '9',
      lon: '-7'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '-91',
      lon: '-7'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '291',
      lon: '-7'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '31',
      lon: '-185'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '31',
      lon: '185'
    },
    {
      type: 'node',
      changeset: '9',
      lat: '31',
      lon: '85',
      timestamp: 'soon'
    }
  ]

  t.plan(nodes.length + 1)

  var db = createDb()

  db.create({
    type: 'node',
    changeset: '12',
    lat: '12',
    lon: '17'
  }, function (err, node) {
    t.error(err)
    nodes.forEach(function (node, idx) {
      db.put(node.id, node, function (err) {
        t.ok(err instanceof Error, 'nodes[' + idx + ']')
      })
    })
  })
})

test('soft delete a node', function (t) {
  t.plan(6)

  var db = createDb()

  var node = {
    type: 'node',
    changeset: '9',
    lat: '-11',
    lon: '-10',
    timestamp: '2017-10-10T19:55:08.570Z'
  }
  var nodeDeletion = {
    type: 'node',
    changeset: '10',
    lat: '-11',
    lon: '-10',
    visible: false
  }

  db.create(node, function (err, elm) {
    t.error(err)
    db.put(elm.id, nodeDeletion, function (err) {
      t.error(err)
      db.get(elm.id, function (err, elms) {
        t.error(err)
        t.equals(elms.length, 1)
        t.equals(elms[0].id, elm.id)
        delete elms[0].id
        delete elms[0].version
        console.log('elms', elms)
        t.deepEquals(elms[0], nodeDeletion)
      })
    })
  })
})

test('version lookup correctness', function (t) {
  var db = createDb()

  var changes = {
    type: 'changeset'
  }

  db.create(changes, function (err, elm1) {
    t.error(err)
    changes.tags = { foo: 'bar' }
    db.put(elm1.id, changes, function (err, elm2) {
      t.error(err)
      t.deepEquals(elm2.tags, { foo: 'bar' })
      db.getByVersion(elm1.version, function (err, elm3) {
        t.error(err)
        t.equals(elm1.id, elm3.id)
        t.equals(elm1.version, elm3.version)
        db.getByVersion(elm2.version, { raw: true }, function (err, msg) {
          var elm4 = msg.element
          t.error(err)
          t.equals(msg.id, elm2.id)
          t.deepEquals(msg.links, [elm1.version])
          t.deepEquals(elm4.tags, { foo: 'bar' })
          t.end()
        })
      })
    })
  })
})
