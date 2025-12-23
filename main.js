/**
 * Main application entry point
 */

let skeleton = null;
let renderer = null;
let animation = null;
let timelineRenderer = null;
let isAnimationMode = false;
let graphicsManager = null;
let isDebugPanelVisible = false;

/**
 * Initialize the application
 */
async function init() {
    const canvas = document.getElementById('skeleton-canvas');

    // Set canvas size to match container
    resizeCanvas();

    renderer = new SkeletonRenderer(canvas);

    // Initialize graphics manager
    graphicsManager = new GraphicsManager();
    graphicsManager.onGraphicsUpdate = handleGraphicsUpdate;
    renderer.setGraphicsManager(graphicsManager);

    // Set up mouse interaction
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Set up callback for skeleton modifications
    renderer.onSkeletonModified = handleSkeletonModified;

    // Set up callback for viewport changes
    renderer.onViewportChanged = updateViewportControls;

    // Set up viewport controls
    setupViewportControls();

    // Set up download buttons
    const downloadAllBtn = document.getElementById('download-all-btn');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAll);
    }

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadSkeleton);
    }

    const downloadMotionBtn = document.getElementById('download-motion-btn');
    if (downloadMotionBtn) {
        downloadMotionBtn.addEventListener('click', downloadMotion);
    }

    const exportKeyframesBtn = document.getElementById('export-keyframes-btn');
    if (exportKeyframesBtn) {
        exportKeyframesBtn.addEventListener('click', exportKeyframes);
    }

    const exportSvgBtn = document.getElementById('export-svg-btn');
    if (exportSvgBtn) {
        exportSvgBtn.addEventListener('click', exportAnimatedSVG);
    }

    // Set up upload buttons
    const uploadSkeletonBtn = document.getElementById('upload-skeleton-btn');
    const uploadSkeletonInput = document.getElementById('upload-skeleton-input');
    if (uploadSkeletonBtn && uploadSkeletonInput) {
        uploadSkeletonBtn.addEventListener('click', () => {
            uploadSkeletonInput.click();
        });
        uploadSkeletonInput.addEventListener('change', handleSkeletonUpload);
    }

    const uploadMotionBtn = document.getElementById('upload-motion-btn');
    const uploadMotionInput = document.getElementById('upload-motion-input');
    if (uploadMotionBtn && uploadMotionInput) {
        uploadMotionBtn.addEventListener('click', () => {
            uploadMotionInput.click();
        });
        uploadMotionInput.addEventListener('change', handleMotionUpload);
    }

    const uploadAllBtn = document.getElementById('upload-all-btn');
    const uploadAllInput = document.getElementById('upload-all-input');
    if (uploadAllBtn && uploadAllInput) {
        uploadAllBtn.addEventListener('click', () => {
            uploadAllInput.click();
        });
        uploadAllInput.addEventListener('change', handleCombinedUpload);
    }

    // Set up graphics upload/download buttons
    const uploadSvgBtn = document.getElementById('upload-svg-btn');
    const uploadSvgInput = document.getElementById('upload-svg-input');
    if (uploadSvgBtn && uploadSvgInput) {
        uploadSvgBtn.addEventListener('click', () => {
            uploadSvgInput.click();
        });
        uploadSvgInput.addEventListener('change', handleSVGUpload);
    }

    const uploadPictureBtn = document.getElementById('upload-picture-btn');
    const uploadPictureInput = document.getElementById('upload-picture-input');
    if (uploadPictureBtn && uploadPictureInput) {
        uploadPictureBtn.addEventListener('click', () => {
            uploadPictureInput.click();
        });
        uploadPictureInput.addEventListener('change', handlePictureUpload);
    }

    const downloadPictureBtn = document.getElementById('download-picture-btn');
    if (downloadPictureBtn) {
        downloadPictureBtn.addEventListener('click', downloadPicture);
    }

    // Set up graphics property controls
    setupGraphicsControls();

    // Set up mode toggle
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleAnimationMode);
    }

    // Set up tabs
    setupTabs();

    // Set up skeleton visibility toggle
    const skeletonVisibleCheckbox = document.getElementById('skeleton-visible');
    if (skeletonVisibleCheckbox) {
        skeletonVisibleCheckbox.addEventListener('change', () => {
            if (renderer) {
                renderer.setSkeletonVisible(skeletonVisibleCheckbox.checked);
            }
        });
    }

    // Set up debug panel toggle
    const debugToggleBtn = document.getElementById('debug-toggle-btn');
    if (debugToggleBtn) {
        debugToggleBtn.addEventListener('click', toggleDebugPanel);
    }

    // Set up debug copy button
    const debugCopyBtn = document.getElementById('debug-copy-btn');
    if (debugCopyBtn) {
        debugCopyBtn.addEventListener('click', copyDebugToClipboard);
    }

    // Set up debug toggle view button
    const debugToggleViewBtn = document.getElementById('debug-toggle-view-btn');
    if (debugToggleViewBtn) {
        debugToggleViewBtn.addEventListener('click', toggleDebugView);
    }

    // Set up debug download SVG button
    const debugDownloadSvgBtn = document.getElementById('debug-download-svg-btn');
    if (debugDownloadSvgBtn) {
        debugDownloadSvgBtn.addEventListener('click', downloadCombinedSVG);
    }

    // Load the complete animation file (skeleton + character + motion)
    try {
        const response = await fetch('../example-complete-animation.json');
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
        }
        const combinedData = await response.json();

        // Validate combined data structure
        if (!combinedData.skeleton || !combinedData.skeleton.bones) {
            throw new Error('Invalid combined file: missing skeleton data');
        }

        // Load the skeleton
        skeleton = SkeletonLoader.parse(combinedData.skeleton);
        console.log('Skeleton loaded from combined file:', skeleton);

        // Initialize animation
        animation = new Animation(skeleton);
        animation.onTimeUpdate = handleTimeUpdate;
        animation.onKeyframesUpdate = handleKeyframesUpdate;

        // Initialize timeline
        const timelineCanvas = document.getElementById('timeline-canvas');
        timelineRenderer = new TimelineRenderer(timelineCanvas, animation);

        // Set up timeline controls
        setupTimelineControls();

        // Load graphics if present
        if (combinedData.character && combinedData.character.graphics && combinedData.character.graphics.length > 0) {
            graphicsManager.clear();
            graphicsManager.graphics = combinedData.character.graphics;
            graphicsManager.nextGraphicId = Math.max(...combinedData.character.graphics.map(g => {
                const match = g.id.match(/graphic-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }), 0) + 1;
            console.log('Graphics loaded from combined file:', graphicsManager.graphics.length);
        }

        // Load motion data if present
        if (combinedData.motion && combinedData.motion.tracks) {
            // Set duration from motion file
            if (combinedData.motion.duration) {
                animation.duration = combinedData.motion.duration;
                const durationInput = document.getElementById('duration-input');
                if (durationInput) {
                    durationInput.value = combinedData.motion.duration.toFixed(2);
                }
            }

            // Extract unique keyframe times from all tracks
            const keyframeTimes = new Set();
            combinedData.motion.tracks.forEach(track => {
                track.keyframes.forEach(kf => keyframeTimes.add(kf.time));
            });

            // Create keyframes for each unique time
            Array.from(keyframeTimes).sort((a, b) => a - b).forEach(time => {
                // Apply bone rotations from tracks at this time
                combinedData.motion.tracks.forEach(track => {
                    const trackKeyframe = track.keyframes.find(kf => kf.time === time);
                    if (trackKeyframe) {
                        const bone = skeleton.bones.find(b => b.id === track.boneId);
                        if (bone) {
                            // Only apply rotation - position and length come from skeleton
                            bone.rotation = trackKeyframe.rotation;
                        }
                    }
                });

                // Recompute transforms
                renderer.recomputeTransforms();

                // Add keyframe at this time
                animation.addKeyframe(time);
            });

            console.log('Motion loaded from combined file:', animation.keyframes.length, 'keyframes');
        }

        // Set time to 0 and update
        animation.setTime(0);

        // Update UI
        updateUI();
        updateGraphicsList();
        updateKeyframesList();

        // Render the skeleton
        renderer.setSkeleton(skeleton);
        renderer.recomputeTransforms();
        renderer.render();

        console.log('Complete animation data loaded successfully');
    } catch (error) {
        console.error('Failed to load complete animation:', error);
        alert('Failed to load complete animation: ' + error.message);
    }
}

/**
 * Update UI with skeleton information
 */
function updateUI() {
    if (!skeleton) return;

    // Update info panel
    document.getElementById('skeleton-name').textContent = skeleton.name;
    document.getElementById('skeleton-version').textContent = skeleton.version;
    document.getElementById('bone-count').textContent = skeleton.bones.length;

    // Build and display bone hierarchy
    const hierarchy = SkeletonLoader.buildHierarchy(skeleton);
    const boneList = document.getElementById('bone-list');
    boneList.innerHTML = '';

    function addBoneToList(bone, depth = 0) {
        const li = document.createElement('li');
        li.className = 'bone-item';
        li.draggable = true;

        if (depth === 0) li.classList.add('root');
        else if (depth === 1) li.classList.add('child');
        else li.classList.add('grandchild');

        const indent = '\u00A0'.repeat(depth * 4);
        const prefix = depth > 0 ? '\u2514\u2500 ' : '';

        li.textContent = `${indent}${prefix}${bone.id}`;
        li.dataset.boneId = bone.id;

        // Add hover effect
        li.addEventListener('mouseenter', () => {
            if (!li.classList.contains('dragging')) {
                renderer.setHoveredBone(bone.id);
            }
        });

        li.addEventListener('mouseleave', () => {
            renderer.setHoveredBone(null);
        });

        // Add drag and drop handlers
        li.addEventListener('dragstart', handleBoneDragStart);
        li.addEventListener('dragend', handleBoneDragEnd);
        li.addEventListener('dragover', handleBoneDragOver);
        li.addEventListener('dragleave', handleBoneDragLeave);
        li.addEventListener('drop', handleBoneDrop);

        boneList.appendChild(li);

        // Add children recursively
        if (bone.children && bone.children.length > 0) {
            bone.children.forEach(child => {
                addBoneToList(child, depth + 1);
            });
        }
    }

    hierarchy.forEach(root => addBoneToList(root));
}

/**
 * Handle mouse movement over canvas
 */
async function handleMouseMove(event) {
    if (!renderer) return;

    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Update mouse position display relative to root
    renderer.updateMousePosition(x, y);

    if (renderer.isPanning) {
        // Update pan position
        renderer.updatePan(x, y);
    } else if (renderer.isDragging) {
        // Update bone drag position
        renderer.updateDrag(x, y);
    } else if (renderer.draggedGraphic) {
        // Update graphic drag position
        renderer.updateGraphicDrag(x, y);
    } else {
        // Check for bone endpoints FIRST (bones have priority for hover too)
        const boneResult = renderer.getBoneEndpointAtPosition(x, y);
        if (boneResult) {
            // In animation mode, don't allow hovering/dragging start points (attachment points)
            if (isAnimationMode && boneResult.endpoint === 'start') {
                renderer.setHoveredBone(null, null);
                renderer.hoveredBoneBody = null;
                renderer.canvas.style.cursor = 'default';
            } else {
                renderer.setHoveredBone(boneResult.bone.id, boneResult.endpoint);
                renderer.hoveredBoneBody = null;
                renderer.canvas.style.cursor = 'grab';
                renderer.hoveredHandle = null;
                return;
            }
        } else {
            renderer.setHoveredBone(null, null);
        }

        // Check for bone body (if no endpoint is hovered)
        const boneBody = renderer.getBoneBodyAtPosition(x, y);
        if (boneBody) {
            // In animation mode, don't allow hovering/dragging bone bodies
            if (!isAnimationMode) {
                renderer.hoveredBoneBody = boneBody.id;
                renderer.canvas.style.cursor = 'grab';
                renderer.hoveredHandle = null;
                renderer.render();
                return;
            }
        } else {
            renderer.hoveredBoneBody = null;
        }

        // Check for graphic handles (if a graphic is selected and not in animation mode)
        if (!isAnimationMode && graphicsManager && graphicsManager.getSelectedGraphic()) {
            const graphicHandle = await renderer.getGraphicHandleAtPosition(x, y);
            if (graphicHandle) {
                renderer.hoveredHandle = graphicHandle.handle;

                // Set cursor based on handle type
                if (graphicHandle.handle === 'move') {
                    renderer.canvas.style.cursor = 'move';
                } else if (graphicHandle.handle === 'rotate') {
                    renderer.canvas.style.cursor = 'grab';
                } else if (graphicHandle.handle.startsWith('scale-')) {
                    // Set resize cursor based on corner
                    const cursorMap = {
                        'scale-nw': 'nwse-resize',
                        'scale-ne': 'nesw-resize',
                        'scale-se': 'nwse-resize',
                        'scale-sw': 'nesw-resize'
                    };
                    renderer.canvas.style.cursor = cursorMap[graphicHandle.handle];
                }

                renderer.render();
                return;
            } else {
                renderer.hoveredHandle = null;
            }
        }

        // Check if hovering over a graphic (for visual feedback)
        if (!isAnimationMode && graphicsManager) {
            const hoveredGraphic = await renderer.getGraphicAtPosition(x, y);
            if (hoveredGraphic) {
                renderer.canvas.style.cursor = 'pointer';
                return;
            }
        }

        renderer.canvas.style.cursor = 'default';
    }
}

/**
 * Handle mouse down on canvas
 */
async function handleMouseDown(event) {
    if (!renderer) return;

    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Middle mouse button (button 1) or shift+left click for panning
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
        renderer.startPan(x, y);
        event.preventDefault();
        return;
    }

    // Left mouse button for graphic or bone manipulation
    if (event.button === 0) {
        // Check for bone endpoint manipulation FIRST (endpoints have highest priority)
        const boneResult = renderer.getBoneEndpointAtPosition(x, y);
        if (boneResult) {
            renderer.startDrag(boneResult.bone.id, boneResult.endpoint);
            event.preventDefault();
            return;
        }

        // Check for bone body (move entire bone)
        const boneBody = renderer.getBoneBodyAtPosition(x, y);
        if (boneBody) {
            renderer.startBoneBodyDrag(boneBody.id, x, y);
            event.preventDefault();
            return;
        }

        // Check for graphic handles (if a graphic is selected and not in animation mode)
        if (!isAnimationMode && graphicsManager && graphicsManager.getSelectedGraphic()) {
            const graphicHandle = await renderer.getGraphicHandleAtPosition(x, y);
            if (graphicHandle) {
                renderer.startGraphicDrag(graphicHandle.graphic, graphicHandle.handle, x, y);
                event.preventDefault();
                return;
            }
        }

        // Check if clicking on a graphic (for selection)
        if (!isAnimationMode && graphicsManager) {
            const clickedGraphic = await renderer.getGraphicAtPosition(x, y);
            if (clickedGraphic) {
                // Select the graphic
                graphicsManager.selectGraphic(clickedGraphic.id);
                event.preventDefault();
                return;
            } else {
                // Deselect graphic if clicking outside all graphics and bones
                graphicsManager.selectGraphic(null);
            }
        }

        // Start panning if clicking on empty space
        renderer.startPan(x, y);
        event.preventDefault();
    }
}

/**
 * Handle mouse up on canvas
 */
function handleMouseUp(event) {
    if (!renderer) return;
    renderer.stopDrag();
    renderer.stopPan();
    renderer.stopGraphicDrag();
}

/**
 * Handle mouse leaving canvas
 */
function handleMouseLeave(event) {
    if (!renderer) return;
    renderer.stopDrag();
    renderer.stopPan();
    renderer.stopGraphicDrag();
    renderer.setHoveredBone(null, null);
    renderer.hoveredBoneBody = null;
    renderer.hoveredHandle = null;
    renderer.clearMousePosition();
}

/**
 * Handle mouse wheel for zooming
 */
function handleMouseWheel(event) {
    if (!renderer) return;

    event.preventDefault();

    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Normalize wheel delta across browsers
    const delta = event.deltaY > 0 ? -1 : 1;

    renderer.handleZoom(delta, x, y);
}

/**
 * Handle skeleton modification
 */
function handleSkeletonModified() {
    // If we're editing a keyframe, update it with the new skeleton state
    if (animation && animation.selectedKeyframeTime !== null) {
        animation.updateSelectedKeyframe();
        console.log(`Updated keyframe at ${animation.selectedKeyframeTime.toFixed(2)}s`);
    }
    console.log('Skeleton modified');
}

/**
 * Toggle animation mode
 */
function toggleAnimationMode() {
    isAnimationMode = !isAnimationMode;

    const timelineContainer = document.getElementById('timeline-container');
    const modeToggle = document.getElementById('mode-toggle');
    const debugPanel = document.getElementById('debug-panel');

    if (isAnimationMode) {
        // Re-apply the current time's bone states to ensure skeleton reflects animation
        if (animation && animation.keyframes.length > 0) {
            animation.setTime(animation.currentTime);
        }

        timelineContainer.classList.add('active');
        modeToggle.classList.add('active');
        modeToggle.textContent = 'Switch To Edit Mode';

        // Adjust debug panel for timeline
        if (debugPanel) {
            debugPanel.classList.add('timeline-active');
        }

        // Enable animation mode in renderer (locks bone lengths)
        if (renderer) {
            renderer.setAnimationMode(true);
        }

        // Resize timeline canvas now that container is visible
        if (timelineRenderer) {
            timelineRenderer.resizeCanvas();
        }

        // Resize main canvas to adjust for timeline
        // Use setTimeout to ensure the timeline container has finished its layout
        setTimeout(() => {
            resizeCanvas();
        }, 0);
    } else {
        timelineContainer.classList.remove('active');
        modeToggle.classList.remove('active');
        modeToggle.textContent = 'Switch To Animation Mode';

        // Restore debug panel height
        if (debugPanel) {
            debugPanel.classList.remove('timeline-active');
        }

        // Disable animation mode in renderer (allows bone length changes)
        if (renderer) {
            renderer.setAnimationMode(false);
        }

        // Stop playback
        if (animation) {
            animation.pause();
        }

        // Resize main canvas to reclaim space
        // Use setTimeout to ensure the timeline container has finished its layout
        setTimeout(() => {
            resizeCanvas();
        }, 0);
    }
}

/**
 * Setup timeline controls
 */
function setupTimelineControls() {
    const timelineCanvas = document.getElementById('timeline-canvas');
    const playBtn = document.getElementById('play-btn');
    const rewindBtn = document.getElementById('rewind-btn');
    const addKeyframeBtn = document.getElementById('add-keyframe-btn');
    const deleteKeyframeBtn = document.getElementById('delete-keyframe-btn');
    const durationInput = document.getElementById('duration-input');

    // Timeline canvas interactions
    timelineCanvas.addEventListener('mousedown', (e) => {
        if (timelineRenderer) timelineRenderer.handleMouseDown(e);
    });

    timelineCanvas.addEventListener('mousemove', (e) => {
        if (timelineRenderer) timelineRenderer.handleMouseMove(e);
    });

    timelineCanvas.addEventListener('mouseup', () => {
        if (timelineRenderer) timelineRenderer.handleMouseUp();
    });

    timelineCanvas.addEventListener('mouseleave', () => {
        if (timelineRenderer) timelineRenderer.handleMouseUp();
    });

    // Play/Pause button
    playBtn.addEventListener('click', () => {
        if (!animation) return;

        if (animation.isPlaying) {
            animation.pause();
            playBtn.textContent = 'Play';
        } else {
            animation.play();
            playBtn.textContent = 'Pause';
        }
    });

    // Rewind button
    rewindBtn.addEventListener('click', () => {
        if (!animation) return;
        animation.rewind();
        playBtn.textContent = 'Play';
    });

    // Add keyframe button
    addKeyframeBtn.addEventListener('click', () => {
        if (!animation) return;
        animation.addKeyframe(animation.currentTime);
        console.log(`Added keyframe at ${animation.currentTime.toFixed(2)}s`);
    });

    // Delete keyframe button
    deleteKeyframeBtn.addEventListener('click', () => {
        if (!animation) return;
        const deleted = animation.deleteKeyframe(animation.currentTime);
        if (deleted) {
            console.log(`Deleted keyframe at ${animation.currentTime.toFixed(2)}s`);
        } else {
            console.log('No keyframe at current time');
        }
    });

    // Duration input
    durationInput.addEventListener('change', () => {
        if (!animation) return;

        const newDuration = parseFloat(durationInput.value);

        // Validate duration
        if (isNaN(newDuration) || newDuration < 0.5 || newDuration > 60) {
            // Revert to current duration
            durationInput.value = animation.duration.toFixed(2);
            alert('Duration must be between 0.5 and 60 seconds');
            return;
        }

        // Check if any keyframes would be outside the new duration
        const keyframesOutsideDuration = animation.keyframes.filter(kf => kf.time > newDuration);

        if (keyframesOutsideDuration.length > 0) {
            const confirm = window.confirm(
                `${keyframesOutsideDuration.length} keyframe(s) are beyond ${newDuration.toFixed(2)}s and will be removed. Continue?`
            );

            if (!confirm) {
                // Revert to current duration
                durationInput.value = animation.duration.toFixed(2);
                return;
            }

            // Remove keyframes outside the new duration
            keyframesOutsideDuration.forEach(kf => {
                animation.deleteKeyframe(kf.time);
            });
        }

        // Update duration
        animation.duration = newDuration;

        // Clamp current time if needed
        if (animation.currentTime > newDuration) {
            animation.setTime(newDuration);
        }

        // Update timeline renderer
        if (timelineRenderer) {
            timelineRenderer.render();
        }

        console.log(`Duration changed to ${newDuration.toFixed(2)}s`);
    });

    // Update duration input when changed externally
    durationInput.addEventListener('blur', () => {
        if (animation) {
            durationInput.value = animation.duration.toFixed(2);
        }
    });
}

/**
 * Handle time update from animation
 */
function handleTimeUpdate(time) {
    // Update time display
    document.getElementById('current-time').textContent = time.toFixed(2);

    // Recompute transforms and render
    renderer.recomputeTransforms();
    renderer.render();

    // Update timeline
    if (timelineRenderer) {
        timelineRenderer.render();
    }

    // Update debug display
    updateDebugDisplay();
}

/**
 * Handle keyframes update
 */
function handleKeyframesUpdate() {
    // Update keyframe count display
    if (animation) {
        const keyframeCountElement = document.getElementById('keyframe-count');
        const timelineInfo = document.getElementById('timeline-info');

        // Check if we're editing a keyframe
        if (animation.selectedKeyframeTime !== null) {
            keyframeCountElement.textContent = animation.keyframes.length;

            // Add or update editing indicator
            let editingIndicator = document.getElementById('editing-indicator');
            if (!editingIndicator) {
                editingIndicator = document.createElement('span');
                editingIndicator.id = 'editing-indicator';
                editingIndicator.style.marginLeft = '20px';
                editingIndicator.style.color = '#fbbf24';
                editingIndicator.style.fontWeight = 'bold';
                timelineInfo.appendChild(editingIndicator);
            }
            editingIndicator.textContent = `Editing keyframe at ${animation.selectedKeyframeTime.toFixed(2)}s`;
        } else {
            keyframeCountElement.textContent = animation.keyframes.length;

            // Remove editing indicator if it exists
            const editingIndicator = document.getElementById('editing-indicator');
            if (editingIndicator) {
                editingIndicator.remove();
            }
        }
    }

    // Update timeline
    if (timelineRenderer) {
        timelineRenderer.render();
    }

    // Update keyframes list
    updateKeyframesList();
}

/**
 * Download motion file
 */
function downloadMotion() {
    if (!animation || !skeleton) return;

    const motionData = animation.exportMotion(skeleton.name);
    const jsonString = JSON.stringify(motionData, null, 2);

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skeleton.name || 'motion'}-animation.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Motion downloaded');
}

/**
 * Download the skeleton as JSON file
 */
function downloadSkeleton() {
    if (!skeleton) return;

    // Create a clean skeleton object for export (remove computed properties)
    const exportData = {
        version: skeleton.version,
        name: skeleton.name,
        metadata: skeleton.metadata,
        bones: skeleton.bones.map(bone => ({
            id: bone.id,
            parent: bone.parent,
            position: bone.position,
            rotation: bone.rotation,
            length: bone.length,
            ...(bone.sprite && { sprite: bone.sprite })
        }))
    };

    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skeleton.name || 'skeleton'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Skeleton downloaded');
}

/**
 * Download everything (skeleton, character/graphics, and motion) as a single JSON file
 */
function downloadAll() {
    if (!skeleton) {
        alert('Please load a skeleton first');
        return;
    }

    // Create combined export data structure
    const exportData = {
        version: "1.0",
        name: skeleton.name || 'project',
        exportedAt: new Date().toISOString(),

        // Skeleton data
        skeleton: {
            version: skeleton.version,
            name: skeleton.name,
            metadata: skeleton.metadata,
            bones: skeleton.bones.map(bone => ({
                id: bone.id,
                parent: bone.parent,
                position: bone.position,
                rotation: bone.rotation,
                length: bone.length,
                ...(bone.sprite && { sprite: bone.sprite })
            }))
        },

        // Character/Graphics data
        character: {
            graphics: graphicsManager && graphicsManager.graphics.length > 0
                ? graphicsManager.graphics.map(graphic => ({
                    id: graphic.id,
                    fileName: graphic.fileName,
                    svgData: graphic.svgData,
                    transform: graphic.transform,
                    attachedToBone: graphic.attachedToBone,
                    zIndex: graphic.zIndex
                }))
                : []
        },

        // Motion data
        motion: animation && animation.keyframes.length > 0
            ? animation.exportMotion(skeleton.name)
            : null
    };

    // Convert to JSON string with formatting
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skeleton.name || 'project'}-complete.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Complete project downloaded (skeleton + character + motion)');
}

/**
 * Export keyframes with absolute coordinates
 */
function exportKeyframes() {
    if (!skeleton || !animation || !graphicsManager) {
        alert('Please load a skeleton and create some keyframes first');
        return;
    }

    if (animation.keyframes.length === 0) {
        alert('No keyframes to export. Please create some keyframes in Animation Mode first.');
        return;
    }

    // Create exporter instance
    const exporter = new KeyframeExporter(skeleton, animation, graphicsManager);

    // Generate JSON
    const jsonString = exporter.exportToJSON(true);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skeleton.name || 'skeleton'}-keyframes.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Keyframes exported with absolute coordinates');
}

/**
 * Export animated SVG file
 */
function exportAnimatedSVG() {
    if (!skeleton || !animation || !graphicsManager) {
        alert('Please load a skeleton and create some keyframes first');
        return;
    }

    if (animation.keyframes.length === 0) {
        alert('No keyframes to export. Please create some keyframes in Animation Mode first.');
        return;
    }

    if (graphicsManager.graphics.length === 0) {
        alert('No graphics to animate. Please add some SVG graphics in the Graphics tab first.');
        return;
    }

    // Create keyframe exporter to get the data
    const keyframeExporter = new KeyframeExporter(skeleton, animation, graphicsManager);
    const keyframeData = keyframeExporter.exportKeyframes();

    // Create SVG exporter and download
    const svgExporter = new SVGExporter(keyframeData);
    svgExporter.download(`${skeleton.name || 'skeleton'}-animated`);

    console.log('Animated SVG exported');
}

/**
 * Handle skeleton file upload
 */
async function handleSkeletonUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const skeletonData = JSON.parse(text);

        // Validate skeleton data
        if (!skeletonData.bones || !Array.isArray(skeletonData.bones)) {
            throw new Error('Invalid skeleton file: missing bones array');
        }

        // Load the skeleton using SkeletonLoader to ensure proper processing
        skeleton = SkeletonLoader.parse(skeletonData);
        console.log('Skeleton loaded from file:', skeleton);

        // Reinitialize animation with new skeleton
        animation = new Animation(skeleton);
        animation.onTimeUpdate = handleTimeUpdate;
        animation.onKeyframesUpdate = handleKeyframesUpdate;

        // Update timeline with new animation
        if (timelineRenderer) {
            timelineRenderer.animation = animation;
        }

        // Update UI
        updateUI();

        // Update renderer with new skeleton
        renderer.setSkeleton(skeleton);
        renderer.recomputeTransforms();
        renderer.render();

        console.log('Skeleton uploaded and applied successfully');
    } catch (error) {
        console.error('Failed to load skeleton file:', error);
        alert('Failed to load skeleton file: ' + error.message);
    }

    // Clear the input so the same file can be uploaded again
    event.target.value = '';
}

/**
 * Handle motion file upload
 */
async function handleMotionUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const motionData = JSON.parse(text);

        // Validate motion data
        if (!motionData.tracks || !Array.isArray(motionData.tracks)) {
            throw new Error('Invalid motion file: missing tracks array');
        }

        if (!skeleton || !animation) {
            throw new Error('Please load a skeleton first before loading motion data');
        }

        // Clear existing keyframes
        animation.keyframes = [];

        // Set duration from motion file
        if (motionData.duration) {
            animation.duration = motionData.duration;
            const durationInput = document.getElementById('duration-input');
            if (durationInput) {
                durationInput.value = motionData.duration.toFixed(2);
            }
        }

        // Extract unique keyframe times from all tracks
        const keyframeTimes = new Set();
        motionData.tracks.forEach(track => {
            track.keyframes.forEach(kf => keyframeTimes.add(kf.time));
        });

        // Create keyframes for each unique time
        Array.from(keyframeTimes).sort((a, b) => a - b).forEach(time => {
            // Apply bone rotations from tracks at this time
            motionData.tracks.forEach(track => {
                const trackKeyframe = track.keyframes.find(kf => kf.time === time);
                if (trackKeyframe) {
                    const bone = skeleton.bones.find(b => b.id === track.boneId);
                    if (bone) {
                        // Only apply rotation - position and length come from skeleton
                        bone.rotation = trackKeyframe.rotation;
                    }
                }
            });

            // Recompute transforms
            renderer.recomputeTransforms();

            // Add keyframe at this time
            animation.addKeyframe(time);
        });

        // Set time to 0 and update
        animation.setTime(0);

        // Update keyframes list
        handleKeyframesUpdate();

        // Update timeline renderer
        if (timelineRenderer) {
            timelineRenderer.render();
        }

        console.log(`Motion uploaded successfully: ${animation.keyframes.length} keyframes loaded`);
    } catch (error) {
        console.error('Failed to load motion file:', error);
        alert('Failed to load motion file: ' + error.message);
    }

    // Clear the input so the same file can be uploaded again
    event.target.value = '';
}

/**
 * Handle combined (all) data file upload
 */
async function handleCombinedUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const combinedData = JSON.parse(text);

        // Validate combined data structure
        if (!combinedData.skeleton || !combinedData.skeleton.bones) {
            throw new Error('Invalid combined file: missing skeleton data');
        }

        // Load the skeleton
        skeleton = SkeletonLoader.parse(combinedData.skeleton);
        console.log('Skeleton loaded from combined file:', skeleton);

        // Reinitialize animation
        animation = new Animation(skeleton);
        animation.onTimeUpdate = handleTimeUpdate;
        animation.onKeyframesUpdate = handleKeyframesUpdate;

        // Update timeline with new animation
        if (timelineRenderer) {
            timelineRenderer.animation = animation;
        }

        // Load graphics if present
        if (combinedData.character && combinedData.character.graphics && combinedData.character.graphics.length > 0) {
            graphicsManager.clear();
            graphicsManager.graphics = combinedData.character.graphics;
            graphicsManager.nextGraphicId = Math.max(...combinedData.character.graphics.map(g => {
                const match = g.id.match(/graphic-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }), 0) + 1;
            console.log('Graphics loaded from combined file:', graphicsManager.graphics.length);
        } else {
            graphicsManager.clear();
        }

        // Load motion data if present
        if (combinedData.motion && combinedData.motion.tracks) {
            // Clear existing keyframes
            animation.keyframes = [];

            // Set duration from motion file
            if (combinedData.motion.duration) {
                animation.duration = combinedData.motion.duration;
                const durationInput = document.getElementById('duration-input');
                if (durationInput) {
                    durationInput.value = combinedData.motion.duration.toFixed(2);
                }
            }

            // Extract unique keyframe times from all tracks
            const keyframeTimes = new Set();
            combinedData.motion.tracks.forEach(track => {
                track.keyframes.forEach(kf => keyframeTimes.add(kf.time));
            });

            // Create keyframes for each unique time
            Array.from(keyframeTimes).sort((a, b) => a - b).forEach(time => {
                // Apply bone rotations from tracks at this time
                combinedData.motion.tracks.forEach(track => {
                    const trackKeyframe = track.keyframes.find(kf => kf.time === time);
                    if (trackKeyframe) {
                        const bone = skeleton.bones.find(b => b.id === track.boneId);
                        if (bone) {
                            // Only apply rotation - position and length come from skeleton
                            bone.rotation = trackKeyframe.rotation;
                        }
                    }
                });

                // Recompute transforms
                renderer.recomputeTransforms();

                // Add keyframe at this time
                animation.addKeyframe(time);
            });

            console.log('Motion loaded from combined file:', animation.keyframes.length, 'keyframes');
        }

        // Set time to 0 and update
        animation.setTime(0);

        // Update UI
        updateUI();
        updateGraphicsList();
        updateKeyframesList();

        // Update renderer with new skeleton
        renderer.setSkeleton(skeleton);
        renderer.recomputeTransforms();
        renderer.render();

        // Update timeline renderer
        if (timelineRenderer) {
            timelineRenderer.render();
        }

        console.log('Combined data loaded successfully');
    } catch (error) {
        console.error('Failed to load combined file:', error);
        alert('Failed to load combined file: ' + error.message);
    }

    // Clear the input so the same file can be uploaded again
    event.target.value = '';
}

/**
 * Resize canvas to match container
 */
function resizeCanvas() {
    const canvas = document.getElementById('skeleton-canvas');
    const container = document.getElementById('canvas-container');

    if (!canvas || !container) return;

    // Store old dimensions if renderer exists
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    // Get container dimensions
    const rect = container.getBoundingClientRect();

    // Set canvas resolution
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Update renderer viewport if it exists
    if (renderer && oldWidth > 0 && oldHeight > 0) {
        // Calculate the change in dimensions
        const widthChange = rect.width - oldWidth;
        const heightChange = rect.height - oldHeight;

        // Adjust offsets to keep the viewport centered
        // Only adjust by half the change to keep content centered
        renderer.offsetX += widthChange / 2;
        renderer.offsetY += heightChange / 2;

        renderer.render();
        updateViewportControls();
    } else if (renderer) {
        // Initial setup
        renderer.offsetX = rect.width / 2;
        renderer.offsetY = rect.height / 2 + 100;
        renderer.render();
        updateViewportControls();
    }
}

/**
 * Handle window resize
 */
function handleResize() {
    resizeCanvas();
}

// Drag and drop state
let draggedBoneId = null;

/**
 * Handle drag start on bone list item
 */
function handleBoneDragStart(event) {
    draggedBoneId = event.target.dataset.boneId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedBoneId);
}

/**
 * Handle drag end on bone list item
 */
function handleBoneDragEnd(event) {
    event.target.classList.remove('dragging');
    // Clean up any drag-over classes
    document.querySelectorAll('.bone-item').forEach(item => {
        item.classList.remove('drag-over', 'invalid-drop');
    });
    draggedBoneId = null;
}

/**
 * Handle drag over bone list item
 */
function handleBoneDragOver(event) {
    if (!draggedBoneId) return;

    event.preventDefault();
    const targetBoneId = event.target.dataset.boneId;

    if (!targetBoneId || targetBoneId === draggedBoneId) return;

    // Check if this would create a circular dependency
    const isValid = isValidReparent(draggedBoneId, targetBoneId);

    event.target.classList.remove('drag-over', 'invalid-drop');
    event.target.classList.add(isValid ? 'drag-over' : 'invalid-drop');

    if (isValid) {
        event.dataTransfer.dropEffect = 'move';
    } else {
        event.dataTransfer.dropEffect = 'none';
    }
}

/**
 * Handle drag leave bone list item
 */
function handleBoneDragLeave(event) {
    event.target.classList.remove('drag-over', 'invalid-drop');
}

/**
 * Handle drop on bone list item
 */
function handleBoneDrop(event) {
    event.preventDefault();
    event.target.classList.remove('drag-over', 'invalid-drop');

    if (!draggedBoneId) return;

    const targetBoneId = event.target.dataset.boneId;

    if (!targetBoneId || targetBoneId === draggedBoneId) return;

    // Validate and perform reparenting
    if (isValidReparent(draggedBoneId, targetBoneId)) {
        reparentBone(draggedBoneId, targetBoneId);
    }
}

/**
 * Check if reparenting would be valid (no circular dependencies)
 */
function isValidReparent(childId, newParentId) {
    if (!skeleton) return false;

    // Can't parent to itself
    if (childId === newParentId) return false;

    // Check if new parent is a descendant of the child (would create cycle)
    const isDescendant = (parentId, potentialDescendantId) => {
        const bone = skeleton.bones.find(b => b.id === potentialDescendantId);
        if (!bone || !bone.parent) return false;
        if (bone.parent === parentId) return true;
        return isDescendant(parentId, bone.parent);
    };

    return !isDescendant(childId, newParentId);
}

/**
 * Reparent a bone to a new parent
 */
function reparentBone(childId, newParentId) {
    if (!skeleton) return;

    const childBone = skeleton.bones.find(b => b.id === childId);
    if (!childBone) return;

    const oldParentId = childBone.parent;
    const newParent = skeleton.bones.find(b => b.id === newParentId);

    if (!newParent) return;

    console.log(`Reparenting ${childId} from ${oldParentId || 'root'} to ${newParentId}`);

    // Get current world position before reparenting
    const worldPos = [...childBone.worldTransform.position];
    const worldRot = childBone.worldTransform.rotation;

    // Update parent
    childBone.parent = newParentId;

    // Convert world position to new local position
    const newParentRotRad = (newParent.worldTransform.rotation * Math.PI) / 180;
    const dx = worldPos[0] - newParent.worldTransform.position[0];
    const dy = worldPos[1] - newParent.worldTransform.position[1];

    // Rotate by negative parent rotation to get local position
    childBone.position[0] = dx * Math.cos(-newParentRotRad) - dy * Math.sin(-newParentRotRad);
    childBone.position[1] = dx * Math.sin(-newParentRotRad) + dy * Math.cos(-newParentRotRad);
    childBone.rotation = worldRot - newParent.worldTransform.rotation;

    // Recompute all transforms
    renderer.recomputeTransforms();

    // Update UI
    updateUI();
    renderer.render();

    // Mark as modified
    handleSkeletonModified();
}

/**
 * Setup tab switching functionality
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const content = document.getElementById(`${tabName}-tab`);
            if (content) {
                content.classList.add('active');
            }
        });
    });
}

/**
 * Setup viewport controls
 */
function setupViewportControls() {
    const viewportX = document.getElementById('viewport-x');
    const viewportY = document.getElementById('viewport-y');
    const viewportZoom = document.getElementById('viewport-zoom');
    const viewportReset = document.getElementById('viewport-reset');

    if (!viewportX || !viewportY || !viewportZoom || !viewportReset) return;

    // Initialize values
    updateViewportControls();

    // Handle X input change
    viewportX.addEventListener('change', () => {
        const x = parseFloat(viewportX.value);
        if (!isNaN(x)) {
            renderer.setViewportPosition(x, renderer.offsetY, true);
        }
    });

    // Handle Y input change
    viewportY.addEventListener('change', () => {
        const y = parseFloat(viewportY.value);
        if (!isNaN(y)) {
            renderer.setViewportPosition(renderer.offsetX, y, true);
        }
    });

    // Handle zoom input change
    viewportZoom.addEventListener('change', () => {
        const zoom = parseFloat(viewportZoom.value);
        if (!isNaN(zoom)) {
            renderer.setViewportZoom(zoom, true);
        }
    });

    // Handle reset button
    viewportReset.addEventListener('click', () => {
        renderer.resetViewport();
    });
}

/**
 * Update viewport controls to match current renderer state
 */
function updateViewportControls() {
    if (!renderer) return;

    const viewportX = document.getElementById('viewport-x');
    const viewportY = document.getElementById('viewport-y');
    const viewportZoom = document.getElementById('viewport-zoom');

    if (viewportX) viewportX.value = Math.round(renderer.offsetX);
    if (viewportY) viewportY.value = Math.round(renderer.offsetY);
    if (viewportZoom) viewportZoom.value = renderer.scale.toFixed(2);
}

/**
 * Handle SVG file upload
 */
async function handleSVGUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        await graphicsManager.loadSVG(file);
        console.log('SVG uploaded successfully:', file.name);
        updateGraphicsList();
        renderer.render();
    } catch (error) {
        console.error('Failed to load SVG:', error);
        alert('Failed to load SVG file: ' + error.message);
    }

    event.target.value = '';
}

/**
 * Handle picture file upload
 */
async function handlePictureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!skeleton) {
        alert('Please load a skeleton first before loading a picture.');
        event.target.value = '';
        return;
    }

    try {
        const pictureData = await PictureLoader.loadFromFile(file, skeleton.name);

        // Clear existing graphics
        graphicsManager.clear();

        // Load graphics from picture
        graphicsManager.graphics = pictureData.graphics;
        graphicsManager.nextGraphicId = Math.max(...pictureData.graphics.map(g => {
            const match = g.id.match(/graphic-(\d+)/);
            return match ? parseInt(match[1]) : 0;
        }), 0) + 1;

        console.log('Picture loaded successfully:', pictureData.name);
        updateGraphicsList();
        renderer.render();
    } catch (error) {
        console.error('Failed to load picture:', error);
        alert('Failed to load picture file: ' + error.message);
    }

    event.target.value = '';
}

/**
 * Download picture file
 */
function downloadPicture() {
    if (!skeleton || !graphicsManager) return;

    if (graphicsManager.graphics.length === 0) {
        alert('No graphics to save. Upload some SVG graphics first.');
        return;
    }

    const pictureName = `${skeleton.name}-picture`;
    const skeletonRef = `${skeleton.name}.json`;

    PictureLoader.download(pictureName, skeletonRef, graphicsManager.graphics);
}

/**
 * Handle graphics update
 */
function handleGraphicsUpdate() {
    updateGraphicsList();
    updateSelectedGraphicPanel();
    renderer.render();
    updateDebugDisplay();
}

/**
 * Update graphics list in the sidebar
 */
function updateGraphicsList() {
    const graphicsList = document.getElementById('graphics-list');
    const emptyState = document.getElementById('graphics-empty');

    if (!graphicsList || !emptyState) return;

    graphicsList.innerHTML = '';

    if (graphicsManager.graphics.length === 0) {
        emptyState.style.display = 'block';
        graphicsList.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    graphicsList.style.display = 'block';

    graphicsManager.graphics.forEach(graphic => {
        const li = document.createElement('li');
        li.className = 'graphic-item';

        if (graphic.id === graphicsManager.selectedGraphicId) {
            li.classList.add('selected');
        }

        const info = document.createElement('div');
        info.className = 'graphic-item-info';

        const name = document.createElement('span');
        name.className = 'graphic-item-name';
        name.textContent = graphic.fileName;

        const meta = document.createElement('div');
        meta.className = 'graphic-item-meta';
        meta.textContent = graphic.attachedToBone
            ? `Attached to: ${graphic.attachedToBone}`
            : 'Not attached';

        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'graphic-item-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'graphic-item-btn delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete graphic "${graphic.fileName}"?`)) {
                graphicsManager.removeGraphic(graphic.id);
            }
        });

        actions.appendChild(deleteBtn);

        li.appendChild(info);
        li.appendChild(actions);

        li.addEventListener('click', () => {
            graphicsManager.selectGraphic(graphic.id);
        });

        graphicsList.appendChild(li);
    });

    updateBoneSelectOptions();
}

/**
 * Update selected graphic panel
 */
function updateSelectedGraphicPanel() {
    const panel = document.getElementById('selected-graphic-panel');
    const selectedGraphic = graphicsManager.getSelectedGraphic();

    if (!panel) return;

    if (!selectedGraphic) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';

    // Update graphic name
    const nameElement = document.getElementById('selected-graphic-name');
    if (nameElement) {
        nameElement.textContent = selectedGraphic.fileName;
    }

    // Update bone select
    const boneSelect = document.getElementById('attach-bone-select');
    if (boneSelect) {
        boneSelect.value = selectedGraphic.attachedToBone || '';
    }

    // Update transform values
    document.getElementById('graphic-pos-x').value = selectedGraphic.transform.position[0].toFixed(1);
    document.getElementById('graphic-pos-y').value = selectedGraphic.transform.position[1].toFixed(1);
    document.getElementById('graphic-rotation').value = selectedGraphic.transform.rotation.toFixed(1);
    document.getElementById('graphic-scale-x').value = selectedGraphic.transform.scale[0].toFixed(2);
    document.getElementById('graphic-scale-y').value = selectedGraphic.transform.scale[1].toFixed(2);

    // Update z-index display
    const zIndexDisplay = document.getElementById('graphic-z-index');
    if (zIndexDisplay) {
        zIndexDisplay.textContent = selectedGraphic.zIndex;
    }
}

/**
 * Update bone select options
 */
function updateBoneSelectOptions() {
    const boneSelect = document.getElementById('attach-bone-select');
    if (!boneSelect || !skeleton) return;

    // Store current value
    const currentValue = boneSelect.value;

    // Clear options except first (None)
    boneSelect.innerHTML = '<option value="">None (detached)</option>';

    // Add bone options
    skeleton.bones.forEach(bone => {
        const option = document.createElement('option');
        option.value = bone.id;
        option.textContent = bone.id;
        boneSelect.appendChild(option);
    });

    // Restore value if it still exists
    if (currentValue) {
        boneSelect.value = currentValue;
    }
}

/**
 * Setup graphics controls
 */
function setupGraphicsControls() {
    // Bone attachment
    const boneSelect = document.getElementById('attach-bone-select');
    if (boneSelect) {
        boneSelect.addEventListener('change', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;

            const boneId = boneSelect.value;
            if (boneId) {
                graphicsManager.attachToBone(selectedGraphic.id, boneId, skeleton);
            } else {
                graphicsManager.detachFromBone(selectedGraphic.id, skeleton);
            }
        });
    }

    // Position controls
    const posXInput = document.getElementById('graphic-pos-x');
    const posYInput = document.getElementById('graphic-pos-y');

    if (posXInput) {
        posXInput.addEventListener('change', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            const x = parseFloat(posXInput.value) || 0;
            graphicsManager.updateTransform(selectedGraphic.id, {
                position: [x, selectedGraphic.transform.position[1]]
            });
        });
    }

    if (posYInput) {
        posYInput.addEventListener('change', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            const y = parseFloat(posYInput.value) || 0;
            graphicsManager.updateTransform(selectedGraphic.id, {
                position: [selectedGraphic.transform.position[0], y]
            });
        });
    }

    // Rotation control
    const rotationInput = document.getElementById('graphic-rotation');
    if (rotationInput) {
        rotationInput.addEventListener('change', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            const rotation = parseFloat(rotationInput.value) || 0;
            graphicsManager.updateTransform(selectedGraphic.id, { rotation });
        });
    }

    // Scale controls
    const scaleXInput = document.getElementById('graphic-scale-x');
    const scaleYInput = document.getElementById('graphic-scale-y');

    if (scaleXInput) {
        scaleXInput.addEventListener('change', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            const scaleX = parseFloat(scaleXInput.value) || 1;
            graphicsManager.updateTransform(selectedGraphic.id, {
                scale: [scaleX, selectedGraphic.transform.scale[1]]
            });
        });
    }

    if (scaleYInput) {
        scaleYInput.addEventListener('change', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            const scaleY = parseFloat(scaleYInput.value) || 1;
            graphicsManager.updateTransform(selectedGraphic.id, {
                scale: [selectedGraphic.transform.scale[0], scaleY]
            });
        });
    }

    // Z-index controls
    const zUpBtn = document.getElementById('graphic-z-up');
    const zDownBtn = document.getElementById('graphic-z-down');

    if (zUpBtn) {
        zUpBtn.addEventListener('click', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            graphicsManager.moveUp(selectedGraphic.id);
        });
    }

    if (zDownBtn) {
        zDownBtn.addEventListener('click', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;
            graphicsManager.moveDown(selectedGraphic.id);
        });
    }

    // Delete button
    const deleteBtn = document.getElementById('delete-graphic-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const selectedGraphic = graphicsManager.getSelectedGraphic();
            if (!selectedGraphic) return;

            if (confirm(`Delete graphic "${selectedGraphic.fileName}"?`)) {
                graphicsManager.removeGraphic(selectedGraphic.id);
            }
        });
    }
}

/**
 * Toggle debug panel visibility
 */
function toggleDebugPanel() {
    isDebugPanelVisible = !isDebugPanelVisible;
    const debugPanel = document.getElementById('debug-panel');
    const debugToggleBtn = document.getElementById('debug-toggle-btn');

    if (isDebugPanelVisible) {
        debugPanel.classList.add('active');
        debugToggleBtn.classList.add('active');
        updateDebugDisplay();
    } else {
        debugPanel.classList.remove('active');
        debugToggleBtn.classList.remove('active');
    }
}

/**
 * Update debug display with current frame data
 */
function updateDebugDisplay() {
    if (!isDebugPanelVisible || !graphicsManager || !skeleton || !renderer) {
        return;
    }

    // Only show debug info when animation is not running
    if (animation && animation.isPlaying) {
        const debugDisplay = document.getElementById('debug-json-display');
        if (debugDisplay) {
            debugDisplay.textContent = 'Animation is running. Pause to see debug info.';
        }
        return;
    }

    const debugData = {
        frame: animation ? animation.currentTime.toFixed(2) + 's' : '0.00s',
        elements: []
    };

    // Get all graphics with their world transforms
    const graphics = graphicsManager.getGraphicsForRendering();

    for (const graphic of graphics) {
        const worldTransform = graphicsManager.getWorldTransform(graphic, skeleton);

        debugData.elements.push({
            id: graphic.id,
            fileName: graphic.fileName,
            svgData: graphic.svgData,
            position: {
                x: parseFloat(worldTransform.position[0].toFixed(2)),
                y: parseFloat(worldTransform.position[1].toFixed(2))
            },
            rotation: parseFloat(worldTransform.rotation.toFixed(2)),
            scale: {
                x: parseFloat(worldTransform.scale[0].toFixed(2)),
                y: parseFloat(worldTransform.scale[1].toFixed(2))
            },
            attachedToBone: graphic.attachedToBone || null,
            zIndex: graphic.zIndex
        });
    }

    const debugDisplay = document.getElementById('debug-json-display');
    if (debugDisplay) {
        debugDisplay.textContent = JSON.stringify(debugData, null, 2);
    }
}

/**
 * Copy debug JSON to clipboard
 */
function copyDebugToClipboard() {
    const debugDisplay = document.getElementById('debug-json-display');
    if (!debugDisplay) return;

    const text = debugDisplay.textContent;

    navigator.clipboard.writeText(text).then(() => {
        // Temporarily change button text to show success
        const debugCopyBtn = document.getElementById('debug-copy-btn');
        if (debugCopyBtn) {
            const originalText = debugCopyBtn.textContent;
            debugCopyBtn.textContent = 'Copied!';
            debugCopyBtn.style.background = '#16a34a';

            setTimeout(() => {
                debugCopyBtn.textContent = originalText;
                debugCopyBtn.style.background = '';
            }, 1500);
        }
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        alert('Failed to copy to clipboard');
    });
}

/**
 * Combine SVG elements from debug data into a single SVG
 */
function combineSVGFromDebugData() {
    if (!isDebugPanelVisible || !graphicsManager || !skeleton || !renderer) {
        console.log('Missing requirements:', { isDebugPanelVisible, hasGraphicsManager: !!graphicsManager, hasSkeleton: !!skeleton, hasRenderer: !!renderer });
        return null;
    }

    const debugDisplay = document.getElementById('debug-json-display');
    if (!debugDisplay || debugDisplay.textContent === 'Animation is running. Pause to see debug info.') {
        console.log('Debug display not available or animation running');
        return null;
    }

    // Parse the debug data
    let debugData;
    try {
        debugData = JSON.parse(debugDisplay.textContent);
    } catch (e) {
        console.error('Failed to parse debug data:', e);
        console.error('Debug display content:', debugDisplay.textContent);
        return null;
    }

    if (!debugData.elements || debugData.elements.length === 0) {
        console.log('No elements in debug data:', debugData);
        return null;
    }

    console.log('Processing', debugData.elements.length, 'elements');

    // Calculate bounding box for all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const transformedElements = [];

    // Process each SVG element
    for (const element of debugData.elements) {
        console.log('Processing element:', element.id, 'SVG data length:', element.svgData?.length);

        // Decode SVG data if it's a data URL
        let svgString = element.svgData;
        if (svgString.startsWith('data:image/svg+xml;base64,')) {
            // Extract base64 part and decode
            const base64Data = svgString.substring('data:image/svg+xml;base64,'.length);
            svgString = atob(base64Data);
            console.log('Decoded base64 SVG, new length:', svgString.length);
        }

        // Parse SVG data to get dimensions
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        // Check if SVG parsing failed
        const parseError = svgDoc.querySelector('parsererror');
        if (parseError) {
            console.error('Failed to parse SVG for element:', element.id);
            console.error('SVG data was:', svgString.substring(0, 200));
            continue;
        }

        // Get viewBox or fallback to width/height
        let svgWidth = 100, svgHeight = 100;
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
            const [, , w, h] = viewBox.split(/\s+/).map(parseFloat);
            svgWidth = w;
            svgHeight = h;
        } else {
            svgWidth = parseFloat(svgElement.getAttribute('width')) || 100;
            svgHeight = parseFloat(svgElement.getAttribute('height')) || 100;
        }

        // Apply scale to dimensions
        const scaledWidth = svgWidth * element.scale.x;
        const scaledHeight = svgHeight * element.scale.y;

        // Calculate the corners of the SVG after rotation
        const corners = [
            { x: -scaledWidth / 2, y: -scaledHeight / 2 },
            { x: scaledWidth / 2, y: -scaledHeight / 2 },
            { x: scaledWidth / 2, y: scaledHeight / 2 },
            { x: -scaledWidth / 2, y: scaledHeight / 2 }
        ];

        // Rotate corners and translate
        // Note: rotation is negated to match canvas coordinate system
        const rotRad = (-element.rotation * Math.PI) / 180;
        const cosRot = Math.cos(rotRad);
        const sinRot = Math.sin(rotRad);

        for (const corner of corners) {
            const rotX = corner.x * cosRot - corner.y * sinRot;
            const rotY = corner.x * sinRot + corner.y * cosRot;
            const finalX = rotX + element.position.x;
            // Flip Y coordinate to match canvas coordinate system (Y increases downward in canvas)
            const finalY = rotY - element.position.y;

            minX = Math.min(minX, finalX);
            minY = Math.min(minY, finalY);
            maxX = Math.max(maxX, finalX);
            maxY = Math.max(maxY, finalY);
        }

        transformedElements.push({
            svgData: svgString,  // Use decoded SVG string
            position: element.position,
            rotation: element.rotation,
            scale: element.scale,
            svgWidth,
            svgHeight,
            zIndex: element.zIndex
        });
    }

    // Check if we have any valid elements
    if (transformedElements.length === 0) {
        console.error('No valid SVG elements were processed');
        return null;
    }

    // Add padding
    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;

    console.log('Bounding box:', { minX, minY, maxX, maxY, width, height });

    // Create combined SVG
    let combinedSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">\n`;
    combinedSVG += `  <!-- Combined SVG generated from frame ${debugData.frame} -->\n`;
    combinedSVG += `  <!-- Contains ${transformedElements.length} graphic element(s) -->\n\n`;

    // Sort elements by z-index
    transformedElements.sort((a, b) => a.zIndex - b.zIndex);

    // Add each transformed SVG element
    for (let i = 0; i < transformedElements.length; i++) {
        const elem = transformedElements[i];

        // Create a group with transformation
        // Note: Y is flipped (negated) and rotation is negated to match canvas coordinate system
        const svgY = -elem.position.y;
        const svgRotation = -elem.rotation;
        combinedSVG += `  <g transform="translate(${elem.position.x}, ${svgY}) rotate(${svgRotation}) scale(${elem.scale.x}, ${elem.scale.y})">\n`;

        // Parse and extract inner content of the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(elem.svgData, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        // Calculate offset for proper centering
        let offsetX = -elem.svgWidth / 2;
        let offsetY = -elem.svgHeight / 2;

        // Add another group for centering
        combinedSVG += `    <g transform="translate(${offsetX}, ${offsetY})">\n`;

        // Add inner content - serialize all child elements
        const serializer = new XMLSerializer();
        if (svgElement.children.length > 0) {
            Array.from(svgElement.children).forEach(child => {
                const childStr = serializer.serializeToString(child);
                combinedSVG += `      ${childStr}\n`;
            });
        } else {
            // If no children, the SVG might be malformed or empty
            console.warn('SVG element has no children:', elem.svgData);
        }

        combinedSVG += `    </g>\n`;
        combinedSVG += `  </g>\n\n`;
    }

    combinedSVG += `</svg>`;

    console.log('Generated SVG (first 200 chars):', combinedSVG.substring(0, 200));
    console.log('SVG length:', combinedSVG.length);

    return combinedSVG;
}

/**
 * Toggle between JSON and SVG view in debug panel
 */
function toggleDebugView() {
    const jsonDisplay = document.getElementById('debug-json-display');
    const svgDisplay = document.getElementById('debug-svg-display');
    const toggleBtn = document.getElementById('debug-toggle-view-btn');

    if (!jsonDisplay || !svgDisplay || !toggleBtn) return;

    // Check current state
    const isShowingSVG = svgDisplay.style.display !== 'none';

    if (isShowingSVG) {
        // Switch to JSON view
        svgDisplay.style.display = 'none';
        jsonDisplay.style.display = 'block';
        toggleBtn.textContent = 'Show SVG';
    } else {
        // Switch to SVG view
        const combinedSVG = combineSVGFromDebugData();

        if (!combinedSVG) {
            alert('No SVG data available to combine. Make sure graphics are loaded and debug panel is showing data.');
            return;
        }

        console.log('About to parse SVG. Type:', typeof combinedSVG, 'First char:', combinedSVG.charCodeAt(0));

        // Parse and insert SVG properly using DOMParser
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(combinedSVG, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        console.log('Parsed SVG element:', svgElement.tagName);

        // Check for parsing errors
        const parserError = svgDoc.querySelector('parsererror');
        if (parserError) {
            console.error('SVG parsing error:', parserError.textContent);
            console.error('Combined SVG was:', combinedSVG.substring(0, 500));
            alert('Error generating SVG. Check console for details.');
            return;
        }

        // Clear and append the SVG element
        svgDisplay.innerHTML = '';
        svgDisplay.appendChild(svgElement);

        console.log('SVG appended successfully');

        // Show SVG, hide JSON
        jsonDisplay.style.display = 'none';
        svgDisplay.style.display = 'flex';
        toggleBtn.textContent = 'Show JSON';
    }
}

/**
 * Download combined SVG as a file
 */
function downloadCombinedSVG() {
    const combinedSVG = combineSVGFromDebugData();

    if (!combinedSVG) {
        alert('No SVG data available to combine. Make sure graphics are loaded and debug panel is showing data.');
        return;
    }

    // Get frame time for filename
    const debugDisplay = document.getElementById('debug-json-display');
    let frameTime = '0.00s';
    try {
        const debugData = JSON.parse(debugDisplay.textContent);
        frameTime = debugData.frame || '0.00s';
    } catch {
        // Use default if parsing fails
    }

    // Create filename
    const safeName = skeleton ? skeleton.name : 'skeleton';
    const filename = `${safeName}-frame-${frameTime.replace('.', '_')}.svg`;

    // Create blob and download
    const blob = new Blob([combinedSVG], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Success feedback
    const downloadBtn = document.getElementById('debug-download-svg-btn');
    if (downloadBtn) {
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = 'Downloaded!';
        downloadBtn.style.background = '#16a34a';

        setTimeout(() => {
            downloadBtn.textContent = originalText;
            downloadBtn.style.background = '';
        }, 1500);
    }

    console.log('Combined SVG downloaded:', filename);
}

/**
 * Update the keyframes list in the Keyframes tab
 */
function updateKeyframesList() {
    if (!animation) return;

    const keyframeList = document.getElementById('keyframe-list');
    const emptyState = document.getElementById('keyframes-empty');

    if (!keyframeList || !emptyState) return;

    // Clear the list
    keyframeList.innerHTML = '';

    if (animation.keyframes.length === 0) {
        emptyState.style.display = 'block';
        keyframeList.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    keyframeList.style.display = 'block';

    // Add each keyframe to the list
    animation.keyframes.forEach(kf => {
        const li = document.createElement('li');
        li.className = 'keyframe-item';

        // Check if this is the selected keyframe
        const isSelected = animation.selectedKeyframeTime !== null &&
                          Math.abs(kf.time - animation.selectedKeyframeTime) < 0.01;

        if (isSelected) {
            li.classList.add('selected');
        }

        // Create time display container
        const timeContainer = document.createElement('div');

        const timeSpan = document.createElement('span');
        timeSpan.className = 'keyframe-time';
        timeSpan.textContent = `${kf.time.toFixed(2)}s`;
        timeSpan.title = 'Click to edit time';

        // Add click handler to make time editable
        timeSpan.addEventListener('click', (e) => {
            e.stopPropagation();

            // Create input element
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'keyframe-time-input';
            input.value = kf.time.toFixed(2);
            input.step = '0.01';
            input.min = '0';
            input.max = animation.duration.toFixed(2);

            // Handle input completion
            const completeEdit = () => {
                const newTime = parseFloat(input.value);

                // Validate the new time
                if (!isNaN(newTime) && newTime >= 0 && newTime <= animation.duration) {
                    // Check if time actually changed
                    if (Math.abs(newTime - kf.time) > 0.001) {
                        const success = animation.moveKeyframe(kf.time, newTime);
                        if (!success) {
                            // Revert if move failed (e.g., another keyframe exists at that time)
                            alert(`Cannot move keyframe to ${newTime.toFixed(2)}s - another keyframe already exists there.`);
                        }
                    }
                }

                // Replace input with span
                timeSpan.textContent = `${kf.time.toFixed(2)}s`;
                timeContainer.replaceChild(timeSpan, input);
            };

            // Handle blur (clicking away)
            input.addEventListener('blur', completeEdit);

            // Handle Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    completeEdit();
                } else if (e.key === 'Escape') {
                    // Cancel editing
                    timeSpan.textContent = `${kf.time.toFixed(2)}s`;
                    timeContainer.replaceChild(timeSpan, input);
                }
            });

            // Replace span with input
            timeContainer.replaceChild(input, timeSpan);
            input.focus();
            input.select();
        });

        timeContainer.appendChild(timeSpan);

        // Create actions container
        const actions = document.createElement('div');
        actions.className = 'keyframe-actions';

        // Create jump button
        const jumpBtn = document.createElement('button');
        jumpBtn.className = 'keyframe-btn';
        jumpBtn.textContent = 'Jump';
        jumpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            animation.setTime(kf.time);
        });

        // Create duplicate button
        const duplicateBtn = document.createElement('button');
        duplicateBtn.className = 'keyframe-btn duplicate';
        duplicateBtn.textContent = 'Copy';
        duplicateBtn.title = 'Duplicate keyframe to current playhead position';
        duplicateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetTime = animation.currentTime;
            const success = animation.duplicateKeyframe(kf.time, targetTime);
            if (success) {
                console.log(`Duplicated keyframe from ${kf.time.toFixed(2)}s to ${targetTime.toFixed(2)}s`);
                // Jump to the duplicated keyframe and select it
                animation.setTime(targetTime);
                animation.selectKeyframe(targetTime);
            } else {
                console.log('Failed to duplicate keyframe');
            }
        });

        // Create edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'keyframe-btn';
        editBtn.textContent = isSelected ? 'Editing' : 'Edit';
        if (isSelected) {
            editBtn.disabled = true;
            editBtn.style.opacity = '0.5';
        }
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            animation.selectKeyframe(kf.time);
            animation.setTime(kf.time);
        });

        // Create delete button (only if not the last keyframe)
        if (animation.keyframes.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'keyframe-btn delete';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                animation.deleteKeyframe(kf.time);
            });
            actions.appendChild(deleteBtn);
        }

        actions.appendChild(jumpBtn);
        actions.appendChild(duplicateBtn);
        actions.appendChild(editBtn);

        li.appendChild(timeContainer);
        li.appendChild(actions);

        // Click on item to select and jump
        li.addEventListener('click', () => {
            animation.selectKeyframe(kf.time);
            animation.setTime(kf.time);
        });

        keyframeList.appendChild(li);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Handle window resize
window.addEventListener('resize', handleResize);
