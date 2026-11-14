# Neon Tide credits

Game by Steeve (@gamersteeve) for PlayChain.

## Vendored libraries

| File | Library | Licence |
|------|---------|---------|
| `three.vendor.min.js` | three.js r187 (core plus EffectComposer, RenderPass, UnrealBloomPass, ShaderPass from `examples/jsm`), tree-shaken and minified with esbuild | MIT, copyright 2010-2025 three.js authors. Full text in `THREE_LICENSE.txt` |

## Assets

All other assets are generated in code at runtime:

- Music (Title, Ride, Results tracks) and every sound effect are synthesised with the Web Audio API. No samples or recordings.
- Ocean, sun, sky, stars, mountains, craft, orbs, gates, buoys, rocks, pearls, lightning and particles are drawn with WebGL shaders and geometry.
- The cover image `cover.png` is a screenshot of the game's own title scene.
- Fonts: system font stack only, nothing is downloaded.
