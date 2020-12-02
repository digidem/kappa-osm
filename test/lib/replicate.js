var pump = require('pump')

module.exports = replicate

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

