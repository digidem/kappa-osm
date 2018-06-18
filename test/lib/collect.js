var pull = require('pull-stream')

module.exports = function (stream, cb) {
  pull(stream, pull.collect(cb))
}
