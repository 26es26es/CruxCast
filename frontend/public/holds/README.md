# Your own hold models

The 3D wall in Crux setting builds its holds in code. You can replace them with real
models: STL files (for example from [Printables](https://www.printables.com/tag/climbinghold))
or GLB/glTF files, which phone scanning apps (Polycam, Scaniverse, Luma) and image-to-3D
tools export. Scan or generate one hold at a time, not a whole wall.

1. Get the model of a hold whose licence lets you share it (for example CC BY or CC0, not
   "non-commercial" or the Standard Digital File License if the repository is public). Your own
   scans are yours to share.
2. Put the `.stl`, `.glb` or `.gltf` file in this folder.
3. Add an entry to `holds.json`:

```json
[
  {
    "file": "big-jug.stl",
    "type": "jug",
    "name": "Big jug",
    "author": "Their username",
    "licence": "CC BY 4.0",
    "url": "https://www.printables.com/model/…",
    "up": "y",
    "out": "z"
  }
]
```

- `type` is one of: jug, crimp, edge, sloper, pinch, pocket, sidepull, undercling, foot_chip, volume, macro.
- `up` is the model's axis that points up the wall when the hold is mounted (the gripping side
  faces up), and `out` the axis that points away from the wall: `x`, `y`, `z`, `-x`, `-y` or `-z`.
  Most hold models lie flat on their back, so `out` is usually `z`.
- The model is scaled to the hold's size on the wall, so its units don't matter. Only its shape is
  used: holds take the route's colour.

Every hold of that type then uses your models (several for one type take turns), and the
credits are shown under the wall.
