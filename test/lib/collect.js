var collect = require('collect-stream')
module.exports = function (stream, cb) {
  collect(stream, { encoding: 'object' }, cb)
}
