/**
 * SkeletonRenderer - Renders skeleton on canvas
 */
class SkeletonRenderer {
    /**
     * @param {HTMLCanvasElement} canvas - Canvas element to render on
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.skeleton = null;
        this.scale = 1.5;
        this.offsetX = canvas.width / 2;
        this.offsetY = canvas.height / 2 + 100; // Offset to center character better
        this.hoveredBone = null;
        this.hoveredEndpoint = null; // 'start' or 'end'
        this.hoveredBoneBody = null; // Bone ID when hovering over bone body
        this.draggedBone = null;
        this.draggedEndpoint = null; // 'start' or 'end'
        this.draggedBoneBody = null; // Bone ID when dragging bone body
        this.isDragging = false;
        this.isAnimationMode = false; // When true, only rotation is allowed (no length changes)
        this.onSkeletonModified = null; // Callback when skeleton is modified
        this.onViewportChanged = null; // Callback when viewport changes
        this.skeletonVisible = true; // Control skeleton visibility

        // Pan/zoom state
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.minScale = 0.1;
        this.maxScale = 10;

        // Graphics support
        this.graphicsManager = null;
        this.svgImageCache = new Map(); // Cache for loaded SVG images
        this.hoveredGraphic = null;
        this.hoveredHandle = null; // 'move', 'rotate', 'scale-nw', 'scale-ne', 'scale-se', 'scale-sw'
        this.draggedGraphic = null;
        this.graphicDragType = null; // 'move', 'rotate', 'scale-nw', 'scale-ne', etc.
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartWorldX = 0;
        this.dragStartWorldY = 0;
        this.dragStartTransform = null;
        this.graphicImageCache = new Map(); // Cache for loaded graphic images with dimensions

        // Mouse position tracking
        this.mouseWorldPos = null; // Store mouse position in world coordinates
    }

    /**
     * Set the skeleton to render
     * @param {Object} skeleton - Parsed skeleton data
     */
    setSkeleton(skeleton) {
        this.skeleton = skeleton;
    }

    /**
     * Set animation mode
     * @param {boolean} isAnimationMode - If true, only rotation is allowed (length is locked)
     */
    setAnimationMode(isAnimationMode) {
        this.isAnimationMode = isAnimationMode;
    }

    /**
     * Set skeleton visibility
     * @param {boolean} visible - If true, skeleton is visible
     */
    setSkeletonVisible(visible) {
        this.skeletonVisible = visible;
        this.render();
    }

    /**
     * Set the graphics manager
     * @param {GraphicsManager} graphicsManager - Graphics manager instance
     */
    setGraphicsManager(graphicsManager) {
        this.graphicsManager = graphicsManager;
    }

    /**
     * Clear the canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Render the skeleton
     */
    async render() {
        if (!this.skeleton) return;

        this.clear();

        // Draw grid for reference
        this.drawGrid();

        // Draw origin point
        this.drawOrigin();

        // Draw all graphics first (regardless of z-index)
        if (this.graphicsManager) {
            const graphics = this.graphicsManager.getGraphicsForRendering();
            // Wait for all graphics to be drawn before drawing skeleton
            await Promise.all(graphics.map(graphic => this.drawGraphic(graphic)));
        }

        // Draw skeleton on top of all graphics (if visible)
        if (this.skeletonVisible) {
            // Draw all bones
            this.skeleton.bones.forEach(bone => {
                if (bone.length > 0) {
                    this.drawBone(bone);
                }
            });

            // Draw joints on top
            this.skeleton.bones.forEach(bone => {
                this.drawJoint(bone);
            });

            // Draw bone endpoints
            this.skeleton.bones.forEach(bone => {
                this.drawBoneEndpoint(bone);
            });

            // Draw bone labels
            this.skeleton.bones.forEach(bone => {
                this.drawBoneLabel(bone);
            });

            // Draw attachment indicator for selected graphic
            if (this.graphicsManager) {
                const selectedGraphic = this.graphicsManager.getSelectedGraphic();
                if (selectedGraphic && selectedGraphic.attachedToBone) {
                    this.drawGraphicAttachmentIndicator(selectedGraphic);
                }
            }
        }

        // Draw graphic transform handles for selected graphic (in edit mode only)
        if (!this.isAnimationMode && this.graphicsManager) {
            const selectedGraphic = this.graphicsManager.getSelectedGraphic();
            if (selectedGraphic) {
                this.drawGraphicTransformHandles(selectedGraphic);
            }
        }

        // Draw mouse position relative to root
        this.drawMousePosition();
    }

    /**
     * Draw a reference grid
     */
    drawGrid() {
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 0.5;

        // Grid spacing in world units (not pixels)
        const worldGridSize = 50;

        // Grid spacing in screen pixels (scaled)
        const gridSize = worldGridSize * this.scale;

        const startX = 0;
        const endX = this.canvas.width;
        const startY = 0;
        const endY = this.canvas.height;

        // Vertical lines
        for (let x = this.offsetX % gridSize; x < endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = this.offsetY % gridSize; y < endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }

    /**
     * Draw the origin point
     */
    drawOrigin() {
        const x = this.offsetX;
        const y = this.offsetY;

        // Draw crosshair
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        this.ctx.moveTo(x - 10, y);
        this.ctx.lineTo(x + 10, y);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(x, y - 10);
        this.ctx.lineTo(x, y + 10);
        this.ctx.stroke();

        // Draw circle
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldPos) {
        return {
            x: this.offsetX + worldPos[0] * this.scale,
            y: this.offsetY - worldPos[1] * this.scale // Flip Y axis for canvas
        };
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        return [
            (screenX - this.offsetX) / this.scale,
            -(screenY - this.offsetY) / this.scale // Flip Y axis back
        ];
    }

    /**
     * Draw a bone
     * @param {Object} bone - Bone data
     */
    drawBone(bone) {
        if (!bone.worldTransform || bone.length === 0) return;

        const start = this.worldToScreen(bone.worldTransform.position);

        // Calculate end position based on rotation and length
        const rotRad = (bone.worldTransform.rotation * Math.PI) / 180;
        const endX = bone.worldTransform.position[0] + Math.cos(rotRad) * bone.length;
        const endY = bone.worldTransform.position[1] + Math.sin(rotRad) * bone.length;
        const end = this.worldToScreen([endX, endY]);

        const isHovered = this.hoveredBoneBody === bone.id;
        const isDragged = this.draggedBoneBody === bone.id;

        // In animation mode, bone body cannot be moved - make it gray
        const isGrayed = this.isAnimationMode;

        // Draw bone as a thick line with gradient
        const gradient = this.ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        if (isGrayed) {
            // Gray gradient for non-movable bone in animation mode
            gradient.addColorStop(0, '#6b7280');
            gradient.addColorStop(1, '#4b5563');
        } else if (isHovered || isDragged) {
            gradient.addColorStop(0, '#fbbf24');
            gradient.addColorStop(1, '#f59e0b');
        } else {
            gradient.addColorStop(0, '#4a9eff');
            gradient.addColorStop(1, '#2563eb');
        }

        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = isHovered || isDragged ? 8 : 6;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        // Draw bone outline for depth
        if (isGrayed) {
            this.ctx.strokeStyle = '#374151';
        } else {
            this.ctx.strokeStyle = isHovered || isDragged ? '#92400e' : '#1e3a8a';
        }
        this.ctx.lineWidth = isHovered || isDragged ? 10 : 8;
        this.ctx.globalAlpha = 0.3;

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Draw a joint (bone connection point)
     * @param {Object} bone - Bone data
     */
    drawJoint(bone) {
        if (!bone.worldTransform) return;

        const pos = this.worldToScreen(bone.worldTransform.position);
        const isHoveredStart = this.hoveredBone === bone.id && this.hoveredEndpoint === 'start';
        const isDraggedStart = this.draggedBone === bone.id && this.draggedEndpoint === 'start';
        const isRoot = !bone.parent;

        // In animation mode, start point cannot be moved - make it gray
        const isGrayed = this.isAnimationMode;

        // Draw outer circle (glow)
        if (isGrayed) {
            this.ctx.fillStyle = '#6b7280';
        } else {
            this.ctx.fillStyle = isRoot ? '#ef4444' : (isHoveredStart || isDraggedStart ? '#fbbf24' : '#60a5fa');
        }
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, isHoveredStart || isDraggedStart ? 12 : 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;

        // Draw inner circle
        if (isGrayed) {
            this.ctx.fillStyle = '#4b5563';
        } else {
            this.ctx.fillStyle = isRoot ? '#dc2626' : (isHoveredStart || isDraggedStart ? '#f59e0b' : '#3b82f6');
        }
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, isHoveredStart || isDraggedStart ? 7 : 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw border
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    /**
     * Draw bone endpoint (end of bone)
     * @param {Object} bone - Bone data
     */
    drawBoneEndpoint(bone) {
        if (!bone.worldTransform || bone.length === 0) return;

        // Calculate end position
        const rotRad = (bone.worldTransform.rotation * Math.PI) / 180;
        const endX = bone.worldTransform.position[0] + Math.cos(rotRad) * bone.length;
        const endY = bone.worldTransform.position[1] + Math.sin(rotRad) * bone.length;
        const pos = this.worldToScreen([endX, endY]);

        const isHoveredEnd = this.hoveredBone === bone.id && this.hoveredEndpoint === 'end';
        const isDraggedEnd = this.draggedBone === bone.id && this.draggedEndpoint === 'end';

        // Draw outer circle (glow)
        this.ctx.fillStyle = isHoveredEnd || isDraggedEnd ? '#fbbf24' : '#22d3ee';
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, isHoveredEnd || isDraggedEnd ? 12 : 8, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;

        // Draw inner circle
        this.ctx.fillStyle = isHoveredEnd || isDraggedEnd ? '#f59e0b' : '#06b6d4';
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, isHoveredEnd || isDraggedEnd ? 7 : 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw border
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    /**
     * Draw bone label
     * @param {Object} bone - Bone data
     */
    drawBoneLabel(bone) {
        if (!bone.worldTransform) return;

        const pos = this.worldToScreen(bone.worldTransform.position);

        // Only draw labels for hovered or root bones
        if (bone.parent && this.hoveredBone !== bone.id) return;

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '11px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';

        // Draw text background
        const textWidth = this.ctx.measureText(bone.id).width;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(pos.x - textWidth / 2 - 3, pos.y - 20, textWidth + 6, 14);

        // Draw text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(bone.id, pos.x, pos.y - 8);
    }

    /**
     * Set hovered bone for highlight
     * @param {string|null} boneId - ID of the hovered bone
     * @param {string|null} endpoint - 'start' or 'end'
     */
    setHoveredBone(boneId, endpoint = null) {
        this.hoveredBone = boneId;
        this.hoveredEndpoint = endpoint;
        if (!this.isDragging) {
            this.render();
        }
    }

    /**
     * Get bone at screen position (line body, not endpoints)
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object|null} Bone at position or null
     */
    getBoneBodyAtPosition(screenX, screenY) {
        if (!this.skeleton) return null;

        const hitRadius = 8; // Distance from bone line

        // Check bones in reverse order (top bones first)
        for (let i = this.skeleton.bones.length - 1; i >= 0; i--) {
            const bone = this.skeleton.bones[i];
            if (!bone.worldTransform || bone.length === 0) continue;

            const startPos = this.worldToScreen(bone.worldTransform.position);
            const rotRad = (bone.worldTransform.rotation * Math.PI) / 180;
            const endX = bone.worldTransform.position[0] + Math.cos(rotRad) * bone.length;
            const endY = bone.worldTransform.position[1] + Math.sin(rotRad) * bone.length;
            const endPos = this.worldToScreen([endX, endY]);

            // Calculate distance from point to line segment
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
            const lengthSquared = dx * dx + dy * dy;

            if (lengthSquared === 0) continue;

            // Calculate projection of point onto line
            const t = Math.max(0, Math.min(1,
                ((screenX - startPos.x) * dx + (screenY - startPos.y) * dy) / lengthSquared
            ));

            const projX = startPos.x + t * dx;
            const projY = startPos.y + t * dy;

            const distX = screenX - projX;
            const distY = screenY - projY;
            const distance = Math.sqrt(distX * distX + distY * distY);

            if (distance <= hitRadius) {
                return bone;
            }
        }

        return null;
    }

    /**
     * Get bone endpoint at screen position
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object|null} { bone, endpoint: 'start'|'end' } or null
     */
    getBoneEndpointAtPosition(screenX, screenY) {
        if (!this.skeleton) return null;

        const hitRadius = 12;

        // Check bones in reverse order (top bones first)
        for (let i = this.skeleton.bones.length - 1; i >= 0; i--) {
            const bone = this.skeleton.bones[i];
            if (!bone.worldTransform) continue;

            // Check end point first (if bone has length)
            if (bone.length > 0) {
                const rotRad = (bone.worldTransform.rotation * Math.PI) / 180;
                const endX = bone.worldTransform.position[0] + Math.cos(rotRad) * bone.length;
                const endY = bone.worldTransform.position[1] + Math.sin(rotRad) * bone.length;
                const endPos = this.worldToScreen([endX, endY]);

                const dxEnd = screenX - endPos.x;
                const dyEnd = screenY - endPos.y;
                const distanceEnd = Math.sqrt(dxEnd * dxEnd + dyEnd * dyEnd);

                if (distanceEnd <= hitRadius) {
                    return { bone, endpoint: 'end' };
                }
            }

            // Check start point
            const startPos = this.worldToScreen(bone.worldTransform.position);
            const dxStart = screenX - startPos.x;
            const dyStart = screenY - startPos.y;
            const distanceStart = Math.sqrt(dxStart * dxStart + dyStart * dyStart);

            if (distanceStart <= hitRadius) {
                return { bone, endpoint: 'start' };
            }
        }

        return null;
    }

    /**
     * Start dragging a bone body (move entire bone)
     * @param {string} boneId - ID of the bone
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    startBoneBodyDrag(boneId, screenX, screenY) {
        // In animation mode, don't allow dragging entire bones
        // Only allow rotating bones by dragging their end points
        if (this.isAnimationMode) {
            return;
        }

        this.isDragging = true;
        this.draggedBoneBody = boneId;
        const worldPos = this.screenToWorld(screenX, screenY);
        this.dragStartWorldX = worldPos[0];
        this.dragStartWorldY = worldPos[1];
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Start dragging a bone endpoint
     * @param {string} boneId - ID of the bone
     * @param {string} endpoint - 'start' or 'end'
     */
    startDrag(boneId, endpoint) {
        // In animation mode, don't allow dragging the start point (attachment point)
        // Only allow dragging the end point to rotate the bone
        if (this.isAnimationMode && endpoint === 'start') {
            return;
        }

        this.isDragging = true;
        this.draggedBone = boneId;
        this.draggedEndpoint = endpoint;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Update dragged bone endpoint position
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    updateDrag(screenX, screenY) {
        if (!this.isDragging) return;

        // Handle bone body dragging (move entire bone)
        if (this.draggedBoneBody) {
            const bone = this.skeleton.bones.find(b => b.id === this.draggedBoneBody);
            if (!bone) return;

            const worldPos = this.screenToWorld(screenX, screenY);
            const worldDx = worldPos[0] - this.dragStartWorldX;
            const worldDy = worldPos[1] - this.dragStartWorldY;

            // Move the bone position
            if (bone.parent) {
                // For child bones, convert world delta to parent-local delta
                const parent = this.skeleton.bones.find(b => b.id === bone.parent);
                if (parent && parent.worldTransform) {
                    const parentRotRad = (parent.worldTransform.rotation * Math.PI) / 180;
                    const localDx = worldDx * Math.cos(-parentRotRad) - worldDy * Math.sin(-parentRotRad);
                    const localDy = worldDx * Math.sin(-parentRotRad) + worldDy * Math.cos(-parentRotRad);

                    bone.position[0] += localDx;
                    bone.position[1] += localDy;
                }
            } else {
                // Root bone - move in world space
                bone.position[0] += worldDx;
                bone.position[1] += worldDy;
            }

            // Update drag start position for next frame
            this.dragStartWorldX = worldPos[0];
            this.dragStartWorldY = worldPos[1];

            // Recompute transforms
            this.recomputeTransforms();

            // Trigger callback
            if (this.onSkeletonModified) {
                this.onSkeletonModified();
            }

            this.render();
            return;
        }

        // Handle bone endpoint dragging
        if (!this.draggedBone) return;

        const bone = this.skeleton.bones.find(b => b.id === this.draggedBone);
        if (!bone) return;

        let worldPos = this.screenToWorld(screenX, screenY);

        if (this.draggedEndpoint === 'start') {
            // Moving the start point - update position and adjust rotation/length
            const oldStart = bone.worldTransform.position;
            const rotRad = (bone.worldTransform.rotation * Math.PI) / 180;
            const oldEndX = oldStart[0] + Math.cos(rotRad) * bone.length;
            const oldEndY = oldStart[1] + Math.sin(rotRad) * bone.length;

            // In animation mode, constrain position to maintain bone length
            if (this.isAnimationMode) {
                const dx = oldEndX - worldPos[0];
                const dy = oldEndY - worldPos[1];
                const currentDist = Math.sqrt(dx * dx + dy * dy);

                if (currentDist > 0.001) {
                    // Constrain worldPos to be exactly bone.length away from end point
                    worldPos[0] = oldEndX - (dx / currentDist) * bone.length;
                    worldPos[1] = oldEndY - (dy / currentDist) * bone.length;
                }
            }

            // Calculate new rotation and length to keep end point fixed
            const dx = oldEndX - worldPos[0];
            const dy = oldEndY - worldPos[1];
            const newLength = Math.sqrt(dx * dx + dy * dy);
            const newRotation = Math.atan2(dy, dx) * (180 / Math.PI);

            // Update bone data
            if (bone.parent) {
                // For child bones, position is relative to parent
                const parent = this.skeleton.bones.find(b => b.id === bone.parent);
                if (parent && parent.worldTransform) {
                    const parentRotRad = (parent.worldTransform.rotation * Math.PI) / 180;
                    const dx = worldPos[0] - parent.worldTransform.position[0];
                    const dy = worldPos[1] - parent.worldTransform.position[1];

                    // Rotate by negative parent rotation to get local position
                    bone.position[0] = dx * Math.cos(-parentRotRad) - dy * Math.sin(-parentRotRad);
                    bone.position[1] = dx * Math.sin(-parentRotRad) + dy * Math.cos(-parentRotRad);
                    bone.rotation = newRotation - parent.worldTransform.rotation;
                }
            } else {
                // Root bone - position is world position
                bone.position = [...worldPos];
                bone.rotation = newRotation;
            }

            // Only update length if not in animation mode
            if (!this.isAnimationMode) {
                bone.length = newLength;
            }
        } else {
            // Moving the end point - keep start fixed, adjust rotation and length
            const startPos = bone.worldTransform.position;
            let dx = worldPos[0] - startPos[0];
            let dy = worldPos[1] - startPos[1];

            // In animation mode, constrain end point to maintain bone length
            if (this.isAnimationMode) {
                const currentDist = Math.sqrt(dx * dx + dy * dy);
                if (currentDist > 0.001) {
                    // Normalize and scale to bone length
                    dx = (dx / currentDist) * bone.length;
                    dy = (dy / currentDist) * bone.length;
                }
            }

            const newLength = Math.sqrt(dx * dx + dy * dy);
            const newRotation = Math.atan2(dy, dx) * (180 / Math.PI);

            // Update bone data - only update length if not in animation mode
            if (!this.isAnimationMode) {
                bone.length = newLength;
            }

            if (bone.parent) {
                const parent = this.skeleton.bones.find(b => b.id === bone.parent);
                if (parent && parent.worldTransform) {
                    bone.rotation = newRotation - parent.worldTransform.rotation;
                }
            } else {
                bone.rotation = newRotation;
            }
        }

        // Recompute transforms
        this.recomputeTransforms();

        // Trigger callback
        if (this.onSkeletonModified) {
            this.onSkeletonModified();
        }

        this.render();
    }

    /**
     * Stop dragging
     */
    stopDrag() {
        this.isDragging = false;
        this.draggedBone = null;
        this.draggedEndpoint = null;
        this.draggedBoneBody = null;
        this.canvas.style.cursor = 'default';
    }

    /**
     * Handle zoom (mouse wheel)
     * @param {number} delta - Wheel delta (positive = zoom in, negative = zoom out)
     * @param {number} mouseX - Mouse X position on canvas
     * @param {number} mouseY - Mouse Y position on canvas
     */
    handleZoom(delta, mouseX, mouseY) {
        // Calculate zoom factor
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newScale = this.scale * zoomFactor;

        // Clamp scale
        if (newScale < this.minScale || newScale > this.maxScale) {
            return;
        }

        // Zoom towards mouse position
        // Get world position before zoom
        const worldPosBefore = this.screenToWorld(mouseX, mouseY);

        // Update scale
        this.scale = newScale;

        // Get world position after zoom (with old offset)
        const worldPosAfter = this.screenToWorld(mouseX, mouseY);

        // Adjust offset to keep mouse position fixed
        const worldDx = worldPosAfter[0] - worldPosBefore[0];
        const worldDy = worldPosAfter[1] - worldPosBefore[1];

        this.offsetX -= worldDx * this.scale;
        this.offsetY += worldDy * this.scale; // Note: Y is flipped

        this.render();

        if (this.onViewportChanged) {
            this.onViewportChanged();
        }
    }

    /**
     * Start panning
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    startPan(screenX, screenY) {
        this.isPanning = true;
        this.panStartX = screenX;
        this.panStartY = screenY;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Update panning
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    updatePan(screenX, screenY) {
        if (!this.isPanning) return;

        const dx = screenX - this.panStartX;
        const dy = screenY - this.panStartY;

        this.offsetX += dx;
        this.offsetY += dy;

        this.panStartX = screenX;
        this.panStartY = screenY;

        this.render();

        if (this.onViewportChanged) {
            this.onViewportChanged();
        }
    }

    /**
     * Stop panning
     */
    stopPan() {
        this.isPanning = false;
        this.canvas.style.cursor = 'default';
    }

    /**
     * Set viewport position
     * @param {number} x - X offset
     * @param {number} y - Y offset
     * @param {boolean} silent - If true, don't trigger callback
     */
    setViewportPosition(x, y, silent = false) {
        this.offsetX = x;
        this.offsetY = y;
        this.render();

        if (!silent && this.onViewportChanged) {
            this.onViewportChanged();
        }
    }

    /**
     * Set viewport zoom
     * @param {number} zoom - Zoom level (scale)
     * @param {boolean} silent - If true, don't trigger callback
     */
    setViewportZoom(zoom, silent = false) {
        const clampedZoom = Math.max(this.minScale, Math.min(this.maxScale, zoom));
        this.scale = clampedZoom;
        this.render();

        if (!silent && this.onViewportChanged) {
            this.onViewportChanged();
        }
    }

    /**
     * Get viewport state
     * @returns {Object} { offsetX, offsetY, scale }
     */
    getViewportState() {
        return {
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            scale: this.scale
        };
    }

    /**
     * Reset viewport to default
     */
    resetViewport() {
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2 + 100;
        this.scale = 1.5;
        this.render();

        if (this.onViewportChanged) {
            this.onViewportChanged();
        }
    }

    /**
     * Recompute world transforms for all bones
     */
    recomputeTransforms() {
        if (!this.skeleton) return;

        const boneMap = new Map();
        this.skeleton.bones.forEach(bone => {
            boneMap.set(bone.id, bone);
            bone.worldTransform = null; // Clear existing transforms
        });

        const computeWorldTransform = (bone) => {
            if (bone.worldTransform) return bone.worldTransform;

            const localPos = bone.position || [0, 0];
            const localRot = bone.rotation || 0;

            if (!bone.parent) {
                bone.worldTransform = {
                    position: [...localPos],
                    rotation: localRot
                };
            } else {
                const parent = boneMap.get(bone.parent);
                if (!parent) return null;

                const parentWorld = computeWorldTransform(parent);
                const parentRotRad = (parentWorld.rotation * Math.PI) / 180;

                const rotatedX = localPos[0] * Math.cos(parentRotRad) - localPos[1] * Math.sin(parentRotRad);
                const rotatedY = localPos[0] * Math.sin(parentRotRad) + localPos[1] * Math.cos(parentRotRad);

                bone.worldTransform = {
                    position: [
                        parentWorld.position[0] + rotatedX,
                        parentWorld.position[1] + rotatedY
                    ],
                    rotation: parentWorld.rotation + localRot
                };
            }

            return bone.worldTransform;
        };

        this.skeleton.bones.forEach(bone => computeWorldTransform(bone));
    }

    /**
     * Get bone at screen position (for backwards compatibility)
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object|null} Bone at position or null
     */
    getBoneAtPosition(screenX, screenY) {
        const result = this.getBoneEndpointAtPosition(screenX, screenY);
        return result ? result.bone : null;
    }

    /**
     * Load SVG as Image element
     * @param {string} svgData - SVG data URL
     * @returns {Promise<Image>} Loaded image
     */
    async loadSVGImage(svgData) {
        if (this.svgImageCache.has(svgData)) {
            return this.svgImageCache.get(svgData);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.svgImageCache.set(svgData, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error('Failed to load SVG image'));
            img.src = svgData;
        });
    }

    /**
     * Draw a graphic
     * @param {Object} graphic - Graphic object
     */
    async drawGraphic(graphic) {
        if (!this.skeleton) return;

        try {
            const img = await this.loadSVGImage(graphic.svgData);
            const worldTransform = this.graphicsManager.getWorldTransform(graphic, this.skeleton);
            const screenPos = this.worldToScreen(worldTransform.position);

            this.ctx.save();

            // Translate to graphic position
            this.ctx.translate(screenPos.x, screenPos.y);

            // Rotate (flip Y because canvas Y is inverted)
            this.ctx.rotate((-worldTransform.rotation * Math.PI) / 180);

            // Scale
            const scaleX = worldTransform.scale[0] * this.scale;
            const scaleY = worldTransform.scale[1] * this.scale;
            this.ctx.scale(scaleX, scaleY);

            // Draw image centered at origin
            const width = img.width;
            const height = img.height;
            this.ctx.drawImage(img, -width / 2, -height / 2, width, height);

            this.ctx.restore();
        } catch (error) {
            console.error('Failed to draw graphic:', error);
        }
    }

    /**
     * Get graphic dimensions from loaded image
     * @param {Object} graphic - Graphic object
     * @returns {Object} { width, height } in pixels
     */
    async getGraphicDimensions(graphic) {
        if (this.graphicImageCache.has(graphic.svgData)) {
            return this.graphicImageCache.get(graphic.svgData);
        }

        try {
            const img = await this.loadSVGImage(graphic.svgData);
            const dimensions = { width: img.width, height: img.height };
            this.graphicImageCache.set(graphic.svgData, dimensions);
            return dimensions;
        } catch (error) {
            // Return default dimensions if image fails to load
            return { width: 100, height: 100 };
        }
    }

    /**
     * Get graphic at screen position (for selection)
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object|null} Graphic object or null
     */
    async getGraphicAtPosition(screenX, screenY) {
        if (!this.graphicsManager || !this.skeleton) return null;

        const graphics = this.graphicsManager.getGraphicsForRendering();

        // Check graphics in reverse order (top to bottom in z-index)
        for (let i = graphics.length - 1; i >= 0; i--) {
            const graphic = graphics[i];
            const worldTransform = this.graphicsManager.getWorldTransform(graphic, this.skeleton);
            const screenPos = this.worldToScreen(worldTransform.position);

            // Get graphic dimensions
            const dimensions = await this.getGraphicDimensions(graphic);
            const width = dimensions.width * worldTransform.scale[0] * this.scale;
            const height = dimensions.height * worldTransform.scale[1] * this.scale;

            // Transform mouse position to graphic's local space
            const dx = screenX - screenPos.x;
            const dy = screenY - screenPos.y;
            const rotRad = (-worldTransform.rotation * Math.PI) / 180;
            const localX = dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad);
            const localY = dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad);

            // Check if inside bounding box
            if (Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2) {
                return graphic;
            }
        }

        return null;
    }

    /**
     * Get graphic handle at screen position
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {Object|null} { graphic, handle: 'move'|'rotate'|'scale-nw'|'scale-ne'|'scale-se'|'scale-sw' } or null
     */
    async getGraphicHandleAtPosition(screenX, screenY) {
        if (!this.graphicsManager || !this.skeleton) return null;

        const selectedGraphic = this.graphicsManager.getSelectedGraphic();
        if (!selectedGraphic) return null;

        const worldTransform = this.graphicsManager.getWorldTransform(selectedGraphic, this.skeleton);
        const screenPos = this.worldToScreen(worldTransform.position);

        // Get graphic dimensions
        const dimensions = await this.getGraphicDimensions(selectedGraphic);
        const width = dimensions.width * worldTransform.scale[0] * this.scale;
        const height = dimensions.height * worldTransform.scale[1] * this.scale;

        // Transform mouse position to graphic's local space
        const dx = screenX - screenPos.x;
        const dy = screenY - screenPos.y;
        const rotRad = (-worldTransform.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(-rotRad) - dy * Math.sin(-rotRad);
        const localY = dx * Math.sin(-rotRad) + dy * Math.cos(-rotRad);

        const handleSize = 8;
        const handleRadius = 6;
        const rotHandleY = -height / 2 - 20;

        // Check rotation handle
        const rotDist = Math.sqrt(localX * localX + (localY - rotHandleY) * (localY - rotHandleY));
        if (rotDist <= handleRadius + 3) {
            return { graphic: selectedGraphic, handle: 'rotate' };
        }

        // Check corner handles for scaling
        const corners = {
            'scale-nw': [-width / 2, -height / 2],
            'scale-ne': [width / 2, -height / 2],
            'scale-se': [width / 2, height / 2],
            'scale-sw': [-width / 2, height / 2]
        };

        for (const [handleType, [cx, cy]] of Object.entries(corners)) {
            const dist = Math.sqrt((localX - cx) * (localX - cx) + (localY - cy) * (localY - cy));
            if (dist <= handleSize) {
                return { graphic: selectedGraphic, handle: handleType };
            }
        }

        // Check if inside bounding box for move
        if (Math.abs(localX) <= width / 2 && Math.abs(localY) <= height / 2) {
            return { graphic: selectedGraphic, handle: 'move' };
        }

        return null;
    }

    /**
     * Start dragging a graphic
     * @param {Object} graphic - Graphic object
     * @param {string} handleType - Type of handle being dragged
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    startGraphicDrag(graphic, handleType, screenX, screenY) {
        this.draggedGraphic = graphic;
        this.graphicDragType = handleType;
        this.dragStartX = screenX;
        this.dragStartY = screenY;

        const worldPos = this.screenToWorld(screenX, screenY);
        this.dragStartWorldX = worldPos[0];
        this.dragStartWorldY = worldPos[1];

        // Store initial transform
        this.dragStartTransform = {
            position: [...graphic.transform.position],
            rotation: graphic.transform.rotation,
            scale: [...graphic.transform.scale]
        };
    }

    /**
     * Update graphic drag
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    updateGraphicDrag(screenX, screenY) {
        if (!this.draggedGraphic || !this.graphicsManager || !this.skeleton) return;

        const graphic = this.draggedGraphic;

        if (this.graphicDragType === 'move') {
            // Move the graphic - calculate screen space delta
            const screenDx = screenX - this.dragStartX;
            const screenDy = screenY - this.dragStartY;

            // Convert screen delta to world delta
            const worldDx = screenDx / this.scale;
            const worldDy = -screenDy / this.scale; // Flip Y because canvas Y is inverted

            if (graphic.attachedToBone) {
                // For attached graphics, convert world delta to bone-local delta
                const bone = this.skeleton.bones.find(b => b.id === graphic.attachedToBone);
                if (bone && bone.worldTransform) {
                    // Rotate world delta by negative bone rotation to get local delta
                    const boneRotRad = (bone.worldTransform.rotation * Math.PI) / 180;
                    const localDx = worldDx * Math.cos(-boneRotRad) - worldDy * Math.sin(-boneRotRad);
                    const localDy = worldDx * Math.sin(-boneRotRad) + worldDy * Math.cos(-boneRotRad);

                    const newPos = [
                        this.dragStartTransform.position[0] + localDx,
                        this.dragStartTransform.position[1] + localDy
                    ];

                    this.graphicsManager.updateTransform(graphic.id, {
                        position: newPos
                    });
                }
            } else {
                // For detached graphics, directly apply world delta
                const newPos = [
                    this.dragStartTransform.position[0] + worldDx,
                    this.dragStartTransform.position[1] + worldDy
                ];

                this.graphicsManager.updateTransform(graphic.id, {
                    position: newPos
                });
            }

        } else if (this.graphicDragType === 'rotate') {
            // Rotate the graphic
            const worldTransform = this.graphicsManager.getWorldTransform(graphic, this.skeleton);
            const centerScreen = this.worldToScreen(worldTransform.position);

            const startAngle = Math.atan2(
                this.dragStartY - centerScreen.y,
                this.dragStartX - centerScreen.x
            );
            const currentAngle = Math.atan2(
                screenY - centerScreen.y,
                screenX - centerScreen.x
            );

            const angleDelta = (currentAngle - startAngle) * (180 / Math.PI);
            const newRotation = this.dragStartTransform.rotation - angleDelta;

            this.graphicsManager.updateTransform(graphic.id, {
                rotation: newRotation
            });

        } else if (this.graphicDragType.startsWith('scale-')) {
            // Scale the graphic
            const worldTransform = this.graphicsManager.getWorldTransform(graphic, this.skeleton);
            const centerScreen = this.worldToScreen(worldTransform.position);

            // Calculate initial and current distances from center
            const startDx = this.dragStartX - centerScreen.x;
            const startDy = this.dragStartY - centerScreen.y;
            const startDist = Math.sqrt(startDx * startDx + startDy * startDy);

            const currentDx = screenX - centerScreen.x;
            const currentDy = screenY - centerScreen.y;
            const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);

            if (startDist > 0) {
                const scaleFactor = currentDist / startDist;
                const newScale = [
                    this.dragStartTransform.scale[0] * scaleFactor,
                    this.dragStartTransform.scale[1] * scaleFactor
                ];

                // Clamp scale to reasonable values
                newScale[0] = Math.max(0.1, Math.min(10, newScale[0]));
                newScale[1] = Math.max(0.1, Math.min(10, newScale[1]));

                this.graphicsManager.updateTransform(graphic.id, {
                    scale: newScale
                });
            }
        }

        this.render();
    }

    /**
     * Stop graphic drag
     */
    stopGraphicDrag() {
        this.draggedGraphic = null;
        this.graphicDragType = null;
        this.dragStartTransform = null;
    }

    /**
     * Draw transform handles for a graphic
     * @param {Object} graphic - Graphic object
     */
    async drawGraphicTransformHandles(graphic) {
        if (!this.skeleton) return;

        const worldTransform = this.graphicsManager.getWorldTransform(graphic, this.skeleton);
        const screenPos = this.worldToScreen(worldTransform.position);

        // Get actual graphic dimensions
        const dimensions = await this.getGraphicDimensions(graphic);
        const width = dimensions.width * worldTransform.scale[0] * this.scale;
        const height = dimensions.height * worldTransform.scale[1] * this.scale;

        this.ctx.save();
        this.ctx.translate(screenPos.x, screenPos.y);
        this.ctx.rotate((-worldTransform.rotation * Math.PI) / 180);

        // Draw bounding box
        const isHovered = this.hoveredHandle === 'move';
        this.ctx.strokeStyle = isHovered ? '#fbbf24' : '#22d3ee';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            -width / 2,
            -height / 2,
            width,
            height
        );
        this.ctx.setLineDash([]);

        // Draw corner handles
        const handleSize = 8;
        const corners = {
            'scale-nw': [-width / 2, -height / 2],
            'scale-ne': [width / 2, -height / 2],
            'scale-se': [width / 2, height / 2],
            'scale-sw': [-width / 2, height / 2]
        };

        Object.entries(corners).forEach(([handleType, [x, y]]) => {
            const isHandleHovered = this.hoveredHandle === handleType;
            this.ctx.fillStyle = isHandleHovered ? '#fbbf24' : '#22d3ee';
            this.ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);

            // Draw white border for better visibility
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        });

        // Draw rotation handle
        const rotHandleY = -height / 2 - 20;
        const isRotateHovered = this.hoveredHandle === 'rotate';
        this.ctx.fillStyle = isRotateHovered ? '#fbbf24' : '#22d3ee';
        this.ctx.beginPath();
        this.ctx.arc(0, rotHandleY, 6, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw white border for rotation handle
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw line to rotation handle
        this.ctx.strokeStyle = isRotateHovered ? '#fbbf24' : '#22d3ee';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -height / 2);
        this.ctx.lineTo(0, rotHandleY);
        this.ctx.stroke();

        this.ctx.restore();

        // Draw center pivot point
        this.ctx.fillStyle = '#22d3ee';
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw white border for pivot
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }

    /**
     * Draw attachment indicator (dashed line from bone to graphic)
     * @param {Object} graphic - Graphic object
     */
    drawGraphicAttachmentIndicator(graphic) {
        if (!this.skeleton || !graphic.attachedToBone) return;

        const bone = this.skeleton.bones.find(b => b.id === graphic.attachedToBone);
        if (!bone || !bone.worldTransform) return;

        const bonePos = this.worldToScreen(bone.worldTransform.position);
        const worldTransform = this.graphicsManager.getWorldTransform(graphic, this.skeleton);
        const graphicPos = this.worldToScreen(worldTransform.position);

        this.ctx.save();
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(bonePos.x, bonePos.y);
        this.ctx.lineTo(graphicPos.x, graphicPos.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.restore();

        // Draw bone label near graphic
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '11px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';

        const labelText = `→ ${bone.id}`;
        const textWidth = this.ctx.measureText(labelText).width;
        this.ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
        this.ctx.fillRect(graphicPos.x - textWidth / 2 - 3, graphicPos.y + 10, textWidth + 6, 14);

        this.ctx.fillStyle = '#000000';
        this.ctx.fillText(labelText, graphicPos.x, graphicPos.y + 12);
    }

    /**
     * Update mouse position relative to root
     * @param {number} screenX - Mouse X position in screen coordinates
     * @param {number} screenY - Mouse Y position in screen coordinates
     */
    updateMousePosition(screenX, screenY) {
        this.mouseWorldPos = this.screenToWorld(screenX, screenY);
        this.render();
    }

    /**
     * Clear mouse position display
     */
    clearMousePosition() {
        this.mouseWorldPos = null;
        this.render();
    }

    /**
     * Draw mouse position relative to root point
     */
    drawMousePosition() {
        if (!this.mouseWorldPos) return;

        const [worldX, worldY] = this.mouseWorldPos;

        // Format coordinates to 1 decimal place
        const xText = worldX.toFixed(1);
        const yText = worldY.toFixed(1);
        const posText = `(${xText}, ${yText})`;

        // Set text style
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        // Measure text for background
        const textWidth = this.ctx.measureText(posText).width;
        const padding = 6;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 18;

        // Position in top-left corner (with some margin)
        const boxX = 10;
        const boxY = 10;

        // Draw background
        this.ctx.fillStyle = 'rgba(37, 37, 38, 0.95)';
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Draw border
        this.ctx.strokeStyle = '#3e3e42';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Draw text
        this.ctx.fillStyle = '#d4d4d4';
        this.ctx.fillText(posText, boxX + padding, boxY + padding - 2);
    }
}
