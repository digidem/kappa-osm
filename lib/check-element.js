module.exports = checkElement

// OsmElement -> [Error]
function checkElement (element, op) {
  if (op === 'del') {
    if (!element.changeset) {
      return [new Error('Deleted elements must have a "changeset" set.')]
    } else {
      return []
    }
  } else {
    var res = checkNewElement(element)
    switch (element.type) {
      case 'node': return res.concat(checkNewNode(element))
      case 'way': return res.concat(checkNewWay(element))
      case 'relation': return res.concat(checkNewRelation(element))
      case 'changeset': return res.concat(checkNewChangeset(element))
      default: return res.concat([new Error('unknown value for "type" field')])
    }
  }
}

function checkNewElement (elm) {
  var res = []

  if (elm.deleted) {
    res.push(new Error('Non-deleted elements cannot have a "deleted" field'))
  }

  if (!elm.type) {
    res.push(new Error('missing "type" field'))
  }
  if (typeof elm.type !== 'string') {
    res.push(new Error('"type" field must be a string'))
  }

  if (elm.type !== 'changeset') {
    if (!elm.changeset) {
      res.push(new Error('missing "changeset" field'))
    }
    if (typeof elm.changeset !== 'string') {
      res.push(new Error('"changeset" field must be a string'))
    }
    // TODO: check that ensures changeset exists
  }

  if (elm.timestamp && !/^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d\dZ$/.test(elm.timestamp)) {
    res.push(new Error('"timestamp" must be in String.prototype.toUTCString format'))
  }

  return res
}

// OsmNode -> [Error]
function checkNewNode (node) {
  var res = []

  res = res.concat(checkNewElement(node))

  if (node.lat === undefined || node.lat === null) {
    res.push(new Error('missing "lat" field'))
  }
  if (typeof node.lat !== 'string') node.lat = String(node.lat)
  if (Number(node.lat) < -90 || Number(node.lat) > 90) {
    res.push(new Error('"lat" field must be between -90 and 90'))
  }
  if (node.tags && typeof node.tags !== 'object') {
    res.push(new Error('"tags" field must be an object'))
  }

  if (node.lon === undefined || node.lon === null) {
    res.push(new Error('missing "lon" field'))
  }
  if (typeof node.lon !== 'string') node.lon = String(node.lon)
  if (Number(node.lon) < -180 || Number(node.lon) > 180) {
    res.push(new Error('"lon" field must be between -180 and 180'))
  }

  return res
}

// OsmWay -> [Error]
function checkNewWay (way) {
  var res = []

  res = res.concat(checkNewElement(way))

  if (!way.refs) {
    res.push(new Error('missing "refs" field'))
  }
  if (!Array.isArray(way.refs)) {
    res.push(new Error('"refs" field must be an array'))
  }
  if (way.refs && way.refs.length < 3) {
    res.push(new Error('"refs" field must have > 2 nodes'))
  }
  // TODO: check that all refs exist in the db

  return res
}

// OsmRelation -> [Error]
function checkNewRelation (rel) {
  var res = []

  res = res.concat(checkNewElement(rel))

  if (!rel.tags) {
    res.push(new Error('missing "tags" field'))
  }
  if (rel.tags && typeof rel.tags !== 'object') {
    res.push(new Error('"tags" field must be an object'))
  }
  if (rel.tags && Object.keys(rel.tags).length < 1) {
    res.push(new Error('"tags" field must have >= 1 members'))
  }

  if (!rel.members) {
    res.push(new Error('missing "members" field'))
  }
  if (!Array.isArray(rel.members)) {
    res.push(new Error('"members" field must be an array'))
  }

  if (rel.members && Array.isArray(rel.members)) {
    rel.members.forEach(function (member, idx) {
      // TODO: this is more of a linter hint than an error
      // if (!member.type) {
      //   res.push(new Error('"members[' + idx + ']" missing "type" field'))
      // }
      if (member.type && typeof member.type !== 'string') {
        res.push(new Error('"members[' + idx + '].type" must be a string'))
      }
      if (member.type && !isValidRelationMemberType(member.type)) {
        res.push(new Error('"members[' + idx + '].type" must be one of node, way, relation'))
      }

      // TODO: this is more of a linter hint than an error
      // if (!member.ref) {
      //   res.push(new Error('"members[' + idx + ']" missing "ref" field'))
      // }
      if (member.ref && typeof member.ref !== 'string') {
        res.push(new Error('"members[' + idx + '].ref" must be a string'))
      }

      // TODO(noffle): check for 'role'; if set it must be a string
    })
  }

  // TODO: check that all members exist in the db

  return res
}

// String -> Boolean
function isValidRelationMemberType (type) {
  return ['node', 'way', 'relation'].indexOf(type) !== -1
}

// OsmChangeset -> [Error]
function checkNewChangeset (changes) {
  var res = []
  return res
}
