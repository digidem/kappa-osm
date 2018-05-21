# kappa-osm

> Peer-to-peer OpenStreetMap database over [kappa-core](https://github.com/noffle/kappa-core)

## Current Status

*IN DEVELOPMENT*

Expect plenty of breaking changes -- [semver](https://semver.org/) will be
respected. This isn't currently ready to be relied upon by other modules!

If you're interested in this project, leave an issue and share a bit about what
you're building!

## Usage

```js
var kappa = require('kappa-core')
var Osm = require('kappa-osm')
var ram = require('random-access-memory')
var memdb = require('memdb')
var Geo = require('grid-point-store')

var core = kappa(ram, { valueEncoding: 'json' })
var indexes = memdb()
var geo = Geo(memdb())
var osm = Osm({
  core: core,
  index: indexes,
  spatial: geo
})

var node = {
  type: 'node',
  lat: '-12.7',
  lon: '1.3',
  tags: { feature: 'water fountain' },
  changeset: 'abcdef'
}

osm.create(node, function (err, node) {
  console.log('created node with id', node.id)
  var bbox = [[-13, -11], [1, 2]]
  osm.query(bbox, function (err, elms) {
    console.log(elms)
  })
})
```

outputs

```
created node with id 78d06921416fe95b
[ { type: 'node',
    lat: '-12.7',
    lon: '1.3',
    tags: { feature: 'water fountain' },
    changeset: 'abcdef',
    timestamp: '2017-12-16T00:15:55.238Z',
    id: '78d06921416fe95b',
    version: 'eAXxidJuq9PoqiDsyrLKfR4jME9hgYnGSozS7BKXUqbDH' } ]
```

## API

```js
var Osm = require('kappa-osm')
```

### var osm = Osm(opts)

Expected `opts` include:

- `core`: a [kappa-core](https://github.com/noffle/kappa-core) instance
- `index`: a [levelup](https://github.com/level/levelup) instance
- `spatial`: a [grid-point-store](https://github.com/noffle/grid-point-store)
  instance

### osm.create(element, cb)

Create the new OSM element `element` and add it to the database. The resulting
element, populated with the `id` and `version` fields, is returned by the
callback `cb`.

### osm.get(id, cb)

Fetch all of the newest OSM elements with the ID `id`. In the case that multiple
peers modified an element prior to sync'ing with each other, there may be
multiple latest elements ("heads") for the ID.

### osm.getByVersion(version, cb)

Fetch a specific OSM element by its version string. Returns `null` if not found,
otherwise the single element.

### osm.put(id, element, cb)

Update an existing element with ID `id` to be the OSM element `element`. The new
element should have all fields that the OSM element would have. The `type` of
the element cannot be changed.

If the value of ID currently returns two or more elements, this new value will
replace them all.

`cb` is called with the new element, including `id` and `version` properties.

### osm.del(id, value, cb)

Marks the element `id` as deleted. A deleted document can be `get` and
`getByVersion`'d like a normal document, and will always have the `{ deleted:
true }` field set.

Deleted ways, nodes, and relations are all still returned by the `query` API.
The nodes of a deleted are not included in the results.

### osm.batch(ops, cb)

Create and update many elements atomically. `ops` is an array of objects
describing the elements to be added or updated.

```js
{
  type: 'put|del',
  id: 'id',
  value: { /* element */ },
  links: [version0, version1, ...]
}
```

If no `id` field is set, the element is created, otherwise it is updated with
the element `value`.

An operation type of `'put'` inserts a new element or modifies an existing one,
while a type of`'del'` will mark the element as deleted.

Currently, doing a batch insert skips many validation checks in order to be as
fast as possible.

*TODO: accept `opts.validate` or `opts.strict`*

### var rs = osm.query(bbox[, cb])

Retrieves all `node`s, `way`s, and `relation`s touching the bounding box `bbox`.

`bbox` is expected to be of the format `[[minLat, maxLat], [minLon, maxLon]]`.
Latitude runs between `(-85, 85)`, and longitude between `(-180, 180)`.

A callback parameter `cb` is optional. If given, it will be called as
`cb(err, elements)`. If not provided or set to `null`, a Readable stream will be
returned that can be read from as elements are emitted. The distinction between
the two is that the callback will buffer all results before they are returned,
but the stream will emit results as they arrive, resulting in much less
buffering. This can make a large impact on memory use for queries on large
datasets.

The following [algorithm](https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box:_GET_.2Fapi.2F0.6.2Fmap) is used to determine what OSM elements are returned:

1. All nodes that are inside a given bounding box and any relations that
   reference them.
2. All ways that reference at least one node that is inside a given bounding
   box, any relations that reference them (the ways), and any nodes outside the
   bounding box that the ways may reference.
3. All relations that reference one of the nodes, ways or relations included due
   to the above rules. (This does not apply recursively; meaning that elements
   referenced by a relation are not returned by virtue of being in that
   relation.)

### var rs = osm.refs(id[, cb])

Fetch a list of all OSM elements that refer to the id `id`. This will capture
referrals by changeset, way membership, or relation membership.

A callback parameter `cb` is optional. If given, it will be called as `cb(err,
results)`. If not provided or set to `null`, a Readable stream will be returned
that can be read from as results are ready.

Objects of the following form are returned:

```js
{
  id: '...',
  version: '...'
}
```

## Architecture

*TODO: talk about forking data & forking architecture*

## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install kappa-osm
```

## License

ISC
