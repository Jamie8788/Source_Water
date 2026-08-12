# Hero real-rig experiment — asset manifest

Isolated, dev-only experiment (`USE_REAL_RIG_NPCS`, default **false**). Nothing
here ships to users unless the flag is turned on. No second page, no route.

| Asset | Source | License | Used where |
|-------|--------|---------|------------|
| `RobotExpressive.glb` | three.js repo, `examples/models/gltf/RobotExpressive/` (raw.githubusercontent.com/mrdoob/three.js) | **CC0 1.0** — model by Tomás Laulhé, rig/animation modifications by Don McCurdy | The 3 experiment NPCs (walker / fisher / researcher) in `realRigScene.js` |

Runtime library: **three.js** (already a project dependency, `^0.168.0`, used by
`src/components/NibiMascot3D.jsx`). Addons imported: `GLTFLoader`, `SkeletonUtils`.

## Why this asset

The blocked-egress reality of this environment: npm + GitHub are reachable, but
the dedicated character libraries (Kenney, Quaternius, Poly Haven) and Mixamo
are **not**. RobotExpressive is a CC0 humanoid hosted on GitHub with real
hand-authored `Walking` / `Idle` / `Wave` clips, so it can prove whether real
skeletal animation fixes puppet arms / stiff knees / foot-sliding — which is the
only question this experiment is meant to answer.

## Known limitations of THIS proof (honest)

- The character is a neutral stylized robot, **not** a field researcher. It is a
  motion test, not final art.
- The asset has no **fishing / sampling / paddling / kneeling** clips, so the
  fisher and researcher use `Idle` (+ an occasional `Wave` gesture). Casting and
  sampling motion cannot be sourced from permitted assets in this environment.
- Only one body/costume is available here, so it cannot demonstrate varied
  heights / builds / clothing.

## Revert

Set `USE_REAL_RIG_NPCS = false` (the default) — the hero is byte-for-byte the
current one. To remove the experiment entirely: delete `src/hero-rig/`, the
`public/rig-assets/` folder, and the three `USE_REAL_RIG_NPCS` guards in
`welcomeShore.js` plus the conditional mount in `Welcome.jsx`.
