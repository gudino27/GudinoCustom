// The homepage kitchen (scripts/build_kitchen.py) as one Job: the room, the
// back wall and the oven wall, and the island. buildJob(homepageKitchen)
// reproduces all 748 parts of tests/engine/reference/homepage-parts.json, with their build
// steps, groups and zones, and buildScene on those parts gives the meshes of
// public/models/kitchen.glb.
import { REFERENCE_ISLAND } from './island.js'
import { referenceRoom } from './room.js'
import { referenceBackWall, referenceRightWall } from './walls.js'

export const homepageKitchen = {
  units: 'in',
  room: referenceRoom,
  runs: [referenceBackWall, referenceRightWall],
  islands: [REFERENCE_ISLAND], // zone defaults to 'island'
}
