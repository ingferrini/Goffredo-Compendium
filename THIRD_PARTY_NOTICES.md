# Third-Party Notices

This module interoperates with Foundry VTT, the D&D5e system, Midi-QOL, Dynamic Active Effects, and Coven's Automation Toolkit through their public runtime APIs. Those projects are not bundled in this repository and retain their respective ownership and licenses.

## Chris's Premades

The CAT lazy-proxy boundary and the broad organization of the Echo Knight automation were informed by the public Chris's Premades project:

- Project: https://github.com/chrisk123999/chris-premades
- License file: MIT License
- Copyright notice in the upstream license: Copyright (c) 2020 Repository Owner

The MIT permission notice and warranty disclaimer are reproduced below as required for adapted portions:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## Coven's Automation Toolkit

- Project: https://github.com/chrisk123999/covens-automation-toolkit
- Package metadata declares the ISC license.

CAT is a required external dependency. No CAT source files are distributed in this module. `rollItem` in `scripts/platform/midi.mjs` adapts the option handling of CAT's `workflowUtils.completeItemUse` (ISC).

## Gambit's Premades

- Project: https://github.com/gambit07/gambits-premades

The Reactions panel (one row per reaction with enable toggle and prompt timeout) follows the settings layout of Gambit's Premades. No Gambit's Premades code is included.

## Game terminology

Names such as Manifest Echo, Unleash Incarnation, D&D, and Dungeons & Dragons belong to their respective rights holders. This repository includes no full rules text or official artwork.
