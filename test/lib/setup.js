module.exports = function (db, data, cb) {
  var batch = data.map(function (elm) {
    var id = elm.id
    delete elm.id
    return {
      type: 'put',
      id: id,
      value: elm
    }
  })

  db.batch(batch, cb)
}
