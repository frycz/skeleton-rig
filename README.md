# Skeleton Rig Visualizer

A web-based skeletal animation editor for creating 2D character animations. Create bone hierarchies, attach SVG graphics, animate with keyframes, and export to multiple formats.

[Demo](https://frycz.github.io/skeleton-rig/)

![Main screen](screenshots/1.png)

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Interface Overview](#interface-overview)
  - [Header](#header)
  - [Sidebar Tabs](#sidebar-tabs)
  - [Timeline](#timeline-animation-mode-only)
- [Controls](#controls)
  - [Mouse Controls](#mouse-controls)
  - [Timeline Controls](#timeline-controls-animation-mode)
- [Workflow](#workflow)
  - [Creating a Skeleton](#creating-a-skeleton)
  - [Attaching Graphics](#attaching-graphics)
  - [Animating](#animating)
  - [Exporting](#exporting)
- [File Formats](#file-formats)
  - [Skeleton JSON](#skeleton-json)
  - [Motion JSON](#motion-json)
  - [Picture JSON](#picture-json)
  - [Complete Project JSON](#complete-project-json)
- [Edit Mode vs Animation Mode](#edit-mode-vs-animation-mode)
- [Tips](#tips)
- [Project Structure](#project-structure)
- [Browser Support](#browser-support)
- [Technical Details](#technical-details)

---

## Quick Start

1. Run a http server in the project root directory, eg.: `python -m http.server`
2. A sample skeleton with graphics loads automatically
3. Drag bone endpoints to pose the character
4. Switch to Animation Mode to create keyframe animations

## Features

- **Skeleton Editing** - Create and modify bone hierarchies with drag-and-drop
- **Graphics Attachment** - Attach SVG images to bones with transform controls
- **Keyframe Animation** - Timeline-based animation with interpolation
- **Multiple Export Formats** - JSON, animated SVG, keyframe data

---

## Interface Overview

### Header
- **Debug Panel** - Toggle JSON/SVG inspection panel
- **Load All** - Load a complete project file (skeleton + graphics + animation)
- **Download All** - Save entire project as single JSON file
- **Mode Toggle** - Switch between Edit Mode and Animation Mode
- **Export Keyframes** - Export animation with absolute world coordinates
- **Export Animated SVG** - Export self-contained animated SVG file

![Header](screenshots/header.png)

### Sidebar Tabs

#### Skeleton Tab
- Skeleton info (name, version, bone count)
- Show/hide skeleton checkbox
- Load/download skeleton JSON
- Bone hierarchy list with drag-and-drop reordering

![Skeleton](screenshots/tab-skeleton.png)

#### Keyframes Tab
- List of animation keyframes
- Click to jump to keyframe time
- Click time value to edit inline
- Duplicate/delete buttons per keyframe

![Skeleton](screenshots/tab-keyframes.png)

#### Graphics Tab
- Load/save picture configuration files
- Upload SVG graphics
- Graphics list with selection
- Transform controls for selected graphic:
  - Bone attachment dropdown
  - Position offset (X, Y)
  - Rotation (degrees)
  - Scale (X, Y)
  - Z-Index ordering (up/down buttons)
  - Delete graphic button

![Skeleton](screenshots/tab-graphics.png)

### Timeline (Animation Mode only)
- Visual keyframe markers
- Draggable playhead
- Play/pause and rewind controls
- Add/delete keyframe buttons
- Duration adjustment (0.5-60 seconds)

![Skeleton](screenshots/timeline.png)

---

## Controls

### Mouse Controls

| Action | Control |
|--------|---------|
| Rotate bone | Drag bone endpoint |
| Move bone | Drag bone body (Edit Mode only) |
| Pan viewport | Middle mouse button OR Shift + Left click |
| Zoom | Mouse wheel |
| Select graphic | Click on graphic (Edit Mode) |
| Move graphic | Drag center handle |
| Rotate graphic | Drag rotation handle (corner) |
| Scale graphic | Drag corner handles |

### Timeline Controls (Animation Mode)

| Action | Control |
|--------|---------|
| Jump to time | Click on timeline |
| Scrub animation | Drag playhead |
| Move keyframe | Drag keyframe marker |

---

## Workflow

### Creating a Skeleton

1. Load a skeleton JSON file or start with the example

<p align="center">
  <img src="screenshots/load-skeleton.png" width="300">
</p>

2. In the bone list, drag bones to reorganize the hierarchy

<p align="center">
  <img src="screenshots/bones.png" width="500">
</p>

3. On canvas, drag bone endpoints to adjust rotations

<p align="center">
  <img src="screenshots/bones-adjust.png" width="300">
</p>

4. Drag bone bodies to reposition bones (changes parent-relative offset)

<p align="center">
  <img src="screenshots/bones-move.png" width="300">
</p>

5. Download the skeleton JSON to save

<p align="center">
  <img src="screenshots/skeleton-download.png" width="300">
</p>

### Attaching Graphics

1. Go to the **Graphics** tab

<p align="center">
  <img src="screenshots/g-graphics.png" width="300">
</p>

2. Click **Upload SVG** to add graphic files

<p align="center">
  <img src="screenshots/g-upload-graphics.png" width="500">
</p>

3. Select a graphic from the list
4. Choose a bone from the **Attached to** dropdown

<p align="center">
  <img src="screenshots/g-attach-to.png" width="500">
</p>

5. Adjust position offset, rotation, and scale as needed

<p align="center">
  <img src="screenshots/g-adjust.png" width="500">
</p>

6. Set z-index (negative = behind skeleton, positive = in front)

<p align="center">
  <img src="screenshots/g-z-index.png" width="300">
</p>

7. Download configuration (optionally) with **Download Picture JSON**

<p align="center">
  <img src="screenshots/g-save.png" width="300">
</p>

### Animating

1. Click **Switch To Animation Mode** in the header

<p align="center">
  <img src="screenshots/a-header-switch.png">
</p>

2. The timeline appears at the bottom
3. Pose the skeleton by rotating bones

<p align="center">
  <img src="screenshots/a-move-bones.png" width="300">
</p>

4. Click **Add Keyframe** to capture the pose

<p align="center">
  <img src="screenshots/a-add-keyframe.png">
</p>

5. Move the playhead to a new time

<p align="center">
  <img src="screenshots/a-move-playhead.png">
</p>

6. Adjust the pose (on skeleton) and add another keyframe ("Add Keyframe" button)
7. Click **Play** to preview the animation

<p align="center">
  <img src="screenshots/a-play.png">
</p>

8. Adjust keyframe times by dragging markers or editing in the Keyframes tab

<p align="center">
  <img src="screenshots/a-adjust-markers.png">
</p>

### Exporting

- **Download All** - Complete project (skeleton + graphics + animation) as JSON

<p align="center">
  <img src="screenshots/e-download-all.png">
</p>

- **Download Skeleton** - Bone hierarchy only

<p align="center">
  <img src="screenshots/e-download-skeleton.png" width="300">
</p>

- **Download Motion** - Animation keyframes only

<p align="center">
  <img src="screenshots/e-download-motion.png">
</p>

- **Download Picture** - Graphics configuration only

<p align="center">
  <img src="screenshots/e-download-graphics.png" width="300">
</p>

- **Export Keyframes** - Animation with world-space coordinates (for external renderers)

<p align="center">
  <img src="screenshots/e-keyframes.png">
</p>

- **Export Animated SVG** - Self-contained animated SVG with SMIL animations

<p align="center">
  <img src="screenshots/e-svg.png">
</p>

---

## File Formats

### Skeleton JSON

```json
{
  "version": "1.0",
  "name": "character",
  "metadata": { "author": "", "description": "" },
  "bones": [
    {
      "id": "root",
      "parent": null,
      "position": [0, 0],
      "rotation": 0,
      "length": 0
    },
    {
      "id": "torso",
      "parent": "root",
      "position": [0, 0],
      "rotation": 90,
      "length": 60
    }
  ]
}
```

### Motion JSON

```json
{
  "version": "1.0",
  "skeletonRef": "character",
  "duration": 2.0,
  "fps": 60,
  "tracks": [
    {
      "boneId": "torso",
      "keyframes": [
        { "time": 0, "rotation": 90, "easing": "linear" },
        { "time": 1.0, "rotation": 100, "easing": "linear" }
      ]
    }
  ]
}
```

### Picture JSON

```json
{
  "version": "1.0",
  "skeletonRef": "character",
  "graphics": [
    {
      "id": "graphic-1",
      "fileName": "head.svg",
      "svgData": "data:image/svg+xml;base64,...",
      "attachedToBone": "neck",
      "transform": {
        "position": [0, -10],
        "rotation": 0,
        "scale": [1.0, 1.0]
      },
      "zIndex": 0
    }
  ]
}
```

### Complete Project JSON

Combines all three formats into a single file:

```json
{
  "skeleton": { /* skeleton data */ },
  "character": { /* picture data */ },
  "motion": { /* motion data */ }
}
```

---

## Edit Mode vs Animation Mode

### Edit Mode (Default)
- Full skeleton editing (length, position, rotation)
- Drag bone bodies to reposition
- Graphics transform handles visible
- No timeline or playback

### Animation Mode
- Rotation-only bone changes (lengths locked)
- Timeline visible with playback controls
- Keyframe system active
- Graphics handles hidden
- Graphics follow bone transforms automatically

---

## Tips

- **Bone hierarchy matters** - Child bones inherit transforms from parents
- **Use z-index** - Negative values render behind the skeleton, positive in front
- **Angle interpolation** - Rotations take the shortest path (359° to 1° goes through 0°)
- **Graphics follow bones** - Attached graphics automatically move/rotate with their parent bone
- **Debug panel** - Use it to inspect the current JSON state or preview combined SVG output

---

## Project Structure

```
skeleton-rig/
├── index.html              # Main application (standalone)
├── app/
│   └── index.html          # Application (alternate location)
├── main.js                 # Application logic
├── animation.js            # Keyframe and timeline system
├── skeleton-renderer.js    # Canvas rendering
├── skeleton-loader.js      # Skeleton JSON parser
├── graphics-manager.js     # SVG graphics management
├── picture-loader.js       # Picture JSON loader
├── keyframe-exporter.js    # Keyframe export utility
├── svg-exporter.js         # Animated SVG export
├── animations/             # Sample animation files
├── character/              # Sample SVG graphics
└── docs/                   # Technical documentation
```

---

## Browser Support

Works in modern browsers with HTML5 Canvas support:
- Chrome
- Firefox
- Safari
- Edge

No server required - runs entirely in the browser.

---

## Technical Details

- **Coordinate System**: X-right, Y-down (standard canvas coordinates)
- **Rotation**: Degrees, counter-clockwise from right (0° = pointing right)
- **Transforms**: Hierarchical - child bones inherit parent world transforms
- **Interpolation**: Linear for position/scale, shortest-path for angles
- **FPS**: 60 frames per second for animation playback
