var kappa = require('kappa-core')
var ram = require('random-access-memory')
var memdb = require('memdb')
var Osm = require('../')

var osm = Osm({
  core: kappa(ram, { valueEncoding: 'json' }),
  index: memdb(),
  storage: function (name, cb) { cb(null, ram()) }
})

var node = {
  type: 'node',
  lat: '-12.7',
  lon: '1.3',
  tags: { feature: 'water fountain' },
  changeset: 'abcdef'
}

osm.create(node, function (err, node) {
  if (err) return console.error(err)
  console.log('created node with id', node.id)
  var bbox = [1, -13, 2, -11]
  osm.query(bbox, function (err, nodes) {
    if (err) console.error(err)
    else console.log(nodes)
  })
})
