/**
 * Animation - Manages keyframes, timeline, and playback
 */
class Animation {
    constructor(skeleton) {
        this.skeleton = skeleton;
        this.duration = 5.0; // Total animation duration in seconds
        this.currentTime = 0.0;
        this.keyframes = []; // Array of { time, boneStates }
        this.isPlaying = false;
        this.fps = 60;
        this.playbackSpeed = 1.0;
        this.lastFrameTime = 0;
        this.onTimeUpdate = null; // Callback when time changes
        this.onKeyframesUpdate = null; // Callback when keyframes change
        this.selectedKeyframeTime = null; // Time of currently selected keyframe for editing

        // Create initial keyframe at time 0
        this.addKeyframe(0);
    }

    /**
     * Capture current skeleton state (rotation only)
     */
    captureBoneStates() {
        return this.skeleton.bones.map(bone => ({
            id: bone.id,
            rotation: bone.rotation
        }));
    }

    /**
     * Add a keyframe at the specified time
     */
    addKeyframe(time) {
        // Check if keyframe already exists at this time
        const existingIndex = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);

        const boneStates = this.captureBoneStates();

        if (existingIndex >= 0) {
            // Update existing keyframe
            this.keyframes[existingIndex].boneStates = boneStates;
        } else {
            // Add new keyframe
            this.keyframes.push({
                time: time,
                boneStates: boneStates
            });

            // Sort keyframes by time
            this.keyframes.sort((a, b) => a.time - b.time);
        }

        if (this.onKeyframesUpdate) {
            this.onKeyframesUpdate();
        }
    }

    /**
     * Delete keyframe at current time
     */
    deleteKeyframe(time) {
        const index = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);

        if (index >= 0 && this.keyframes.length > 1) {
            this.keyframes.splice(index, 1);

            if (this.onKeyframesUpdate) {
                this.onKeyframesUpdate();
            }
            return true;
        }

        return false;
    }

    /**
     * Duplicate a keyframe from sourceTime to targetTime
     */
    duplicateKeyframe(sourceTime, targetTime) {
        // Get the source keyframe
        const sourceKeyframe = this.getKeyframeAtTime(sourceTime);
        if (!sourceKeyframe) {
            return false;
        }

        // Check if target time is valid
        if (targetTime < 0 || targetTime > this.duration) {
            return false;
        }

        // Check if a keyframe already exists at target time
        const existingKeyframe = this.getKeyframeAtTime(targetTime);
        if (existingKeyframe) {
            // Update existing keyframe with source data
            existingKeyframe.boneStates = sourceKeyframe.boneStates.map(bone => ({
                id: bone.id,
                rotation: bone.rotation
            }));
        } else {
            // Create new keyframe with duplicated bone states
            this.keyframes.push({
                time: targetTime,
                boneStates: sourceKeyframe.boneStates.map(bone => ({
                    id: bone.id,
                    rotation: bone.rotation
                }))
            });

            // Sort keyframes by time
            this.keyframes.sort((a, b) => a.time - b.time);
        }

        if (this.onKeyframesUpdate) {
            this.onKeyframesUpdate();
        }

        return true;
    }

    /**
     * Get keyframe at specific time (if exists)
     */
    getKeyframeAtTime(time) {
        return this.keyframes.find(kf => Math.abs(kf.time - time) < 0.01);
    }

    /**
     * Select a keyframe for editing
     */
    selectKeyframe(time) {
        const keyframe = this.getKeyframeAtTime(time);
        if (keyframe) {
            this.selectedKeyframeTime = keyframe.time;
            if (this.onKeyframesUpdate) {
                this.onKeyframesUpdate();
            }
            return true;
        }
        return false;
    }

    /**
     * Deselect the currently selected keyframe
     */
    deselectKeyframe() {
        if (this.selectedKeyframeTime !== null) {
            this.selectedKeyframeTime = null;
            if (this.onKeyframesUpdate) {
                this.onKeyframesUpdate();
            }
        }
    }

    /**
     * Update the selected keyframe with current skeleton state
     */
    updateSelectedKeyframe() {
        if (this.selectedKeyframeTime !== null) {
            const keyframe = this.getKeyframeAtTime(this.selectedKeyframeTime);
            if (keyframe) {
                keyframe.boneStates = this.captureBoneStates();
                if (this.onKeyframesUpdate) {
                    this.onKeyframesUpdate();
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Move a keyframe to a new time
     */
    moveKeyframe(oldTime, newTime) {
        // Clamp new time to valid range
        newTime = Math.max(0, Math.min(newTime, this.duration));

        const keyframe = this.getKeyframeAtTime(oldTime);
        if (!keyframe) return false;

        // Don't allow moving if another keyframe exists at target time
        const existingAtNewTime = this.getKeyframeAtTime(newTime);
        if (existingAtNewTime && Math.abs(existingAtNewTime.time - oldTime) > 0.01) {
            return false;
        }

        // Update the keyframe time
        keyframe.time = newTime;

        // Re-sort keyframes by time
        this.keyframes.sort((a, b) => a.time - b.time);

        // Update selected keyframe time if this was the selected one
        if (this.selectedKeyframeTime !== null && Math.abs(this.selectedKeyframeTime - oldTime) < 0.01) {
            this.selectedKeyframeTime = newTime;
        }

        if (this.onKeyframesUpdate) {
            this.onKeyframesUpdate();
        }

        return true;
    }

    /**
     * Linear interpolation between two values
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Angle interpolation with proper wrapping (shortest path)
     * Handles angle wrapping to ensure rotation takes the shortest arc
     */
    lerpAngle(a, b, t) {
        // Normalize angles to [0, 360) range
        a = ((a % 360) + 360) % 360;
        b = ((b % 360) + 360) % 360;

        // Calculate the difference
        let diff = b - a;

        // Choose the shortest path
        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }

        // Interpolate and normalize result
        let result = a + diff * t;
        return ((result % 360) + 360) % 360;
    }

    /**
     * Interpolate between two keyframes (rotation only)
     */
    interpolateBoneStates(kf1, kf2, t) {
        const interpolated = [];

        kf1.boneStates.forEach((bone1, index) => {
            const bone2 = kf2.boneStates[index];

            interpolated.push({
                id: bone1.id,
                rotation: this.lerpAngle(bone1.rotation, bone2.rotation, t)
            });
        });

        return interpolated;
    }

    /**
     * Get interpolated bone states for current time
     */
    getBoneStatesAtTime(time) {
        if (this.keyframes.length === 0) return null;
        if (this.keyframes.length === 1) return this.keyframes[0].boneStates;

        // Find surrounding keyframes
        let prevKeyframe = this.keyframes[0];
        let nextKeyframe = this.keyframes[this.keyframes.length - 1];

        for (let i = 0; i < this.keyframes.length - 1; i++) {
            if (this.keyframes[i].time <= time && this.keyframes[i + 1].time >= time) {
                prevKeyframe = this.keyframes[i];
                nextKeyframe = this.keyframes[i + 1];
                break;
            }
        }

        // If time is before first keyframe
        if (time < prevKeyframe.time) {
            return prevKeyframe.boneStates;
        }

        // If time is after last keyframe
        if (time > nextKeyframe.time) {
            return nextKeyframe.boneStates;
        }

        // Interpolate between keyframes
        const duration = nextKeyframe.time - prevKeyframe.time;
        const t = duration > 0 ? (time - prevKeyframe.time) / duration : 0;

        return this.interpolateBoneStates(prevKeyframe, nextKeyframe, t);
    }

    /**
     * Apply bone states to skeleton (rotation only)
     * Position and length are inherited from the skeleton structure
     */
    applyBoneStates(boneStates) {
        boneStates.forEach(state => {
            const bone = this.skeleton.bones.find(b => b.id === state.id);
            if (bone) {
                bone.rotation = state.rotation;
            }
        });
    }

    /**
     * Set current time and update skeleton
     */
    setTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        const boneStates = this.getBoneStatesAtTime(this.currentTime);

        if (boneStates) {
            this.applyBoneStates(boneStates);
        }

        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime);
        }
    }

    /**
     * Play animation
     */
    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.playbackLoop();
    }

    /**
     * Pause animation
     */
    pause() {
        this.isPlaying = false;
    }

    /**
     * Rewind to start
     */
    rewind() {
        this.pause();
        this.setTime(0);
    }

    /**
     * Playback loop
     */
    playbackLoop() {
        if (!this.isPlaying) return;

        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = now;

        // Update time
        this.currentTime += deltaTime * this.playbackSpeed;

        // Loop back to start if reached end
        if (this.currentTime >= this.duration) {
            this.currentTime = 0;
        }

        this.setTime(this.currentTime);

        requestAnimationFrame(() => this.playbackLoop());
    }

    /**
     * Export animation as motion JSON (rotation only)
     */
    exportMotion(skeletonName) {
        const tracks = [];
        const boneIds = new Set();

        // Collect all bone IDs
        this.keyframes.forEach(kf => {
            kf.boneStates.forEach(state => boneIds.add(state.id));
        });

        // Create track for each bone
        boneIds.forEach(boneId => {
            const keyframes = [];

            this.keyframes.forEach(kf => {
                const boneState = kf.boneStates.find(s => s.id === boneId);
                if (boneState) {
                    keyframes.push({
                        time: kf.time,
                        rotation: boneState.rotation,
                        easing: "linear"
                    });
                }
            });

            if (keyframes.length > 0) {
                tracks.push({
                    boneId: boneId,
                    keyframes: keyframes
                });
            }
        });

        return {
            version: "1.0",
            skeletonRef: skeletonName || "skeleton.json",
            duration: this.duration,
            fps: this.fps,
            tracks: tracks
        };
    }
}

/**
 * TimelineRenderer - Renders the animation timeline
 */
class TimelineRenderer {
    constructor(canvas, animation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animation = animation;
        this.isDragging = false;
        this.dragSource = null; // 'playhead', 'bar', or 'keyframe'
        this.draggedKeyframeTime = null; // Time of keyframe being dragged

        // Resize canvas to fit container
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    /**
     * Convert time to x position
     */
    timeToX(time) {
        const padding = 40;
        const width = this.canvas.width - padding * 2;
        return padding + (time / this.animation.duration) * width;
    }

    /**
     * Convert x position to time
     */
    xToTime(x) {
        const padding = 40;
        const width = this.canvas.width - padding * 2;
        return ((x - padding) / width) * this.animation.duration;
    }

    /**
     * Render the timeline
     */
    render() {
        if (!this.canvas || !this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const padding = 40;
        const height = this.canvas.height;
        const width = this.canvas.width - padding * 2;
        const barY = 15; // Position bar at the top
        const barHeight = 12; // Make bar wider/taller

        // Draw timeline track at the top (more visible color)
        this.ctx.fillStyle = '#4a5568';
        this.ctx.fillRect(padding, barY, width, barHeight);

        // Draw time markers in the middle
        this.ctx.fillStyle = '#858585';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';

        const numMarkers = 11;
        for (let i = 0; i < numMarkers; i++) {
            const time = (i / (numMarkers - 1)) * this.animation.duration;
            const x = this.timeToX(time);

            // Draw tick marks in the middle
            this.ctx.fillRect(x - 1, height / 2 - 10, 2, 20);
            this.ctx.fillText(time.toFixed(1) + 's', x, height - 10);
        }

        // Draw keyframes below the bar
        this.animation.keyframes.forEach(kf => {
            const x = this.timeToX(kf.time);
            const isSelected = this.animation.selectedKeyframeTime !== null &&
                             Math.abs(kf.time - this.animation.selectedKeyframeTime) < 0.01;

            const kfY = barY + barHeight + 2; // Position below the bar

            // Use brighter colors for selected keyframe
            if (isSelected) {
                this.ctx.fillStyle = '#fbbf24'; // Amber for selected triangle pointing down
                this.ctx.beginPath();
                this.ctx.moveTo(x - 6, kfY);
                this.ctx.lineTo(x + 6, kfY);
                this.ctx.lineTo(x, kfY + 10);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.fillStyle = '#f59e0b'; // Darker amber for rectangle
                this.ctx.fillRect(x - 4, kfY + 10, 8, 30);

                // Add a glow effect
                this.ctx.strokeStyle = '#fbbf24';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x - 7, kfY - 1, 14, 42);
            } else {
                this.ctx.fillStyle = '#0e639c';
                this.ctx.beginPath();
                this.ctx.moveTo(x - 6, kfY);
                this.ctx.lineTo(x + 6, kfY);
                this.ctx.lineTo(x, kfY + 10);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.fillStyle = '#1177bb';
                this.ctx.fillRect(x - 4, kfY + 10, 8, 30);
            }
        });

        // Draw current time marker line
        const currentX = this.timeToX(this.animation.currentTime);
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(currentX, barY + barHeight / 2);
        this.ctx.lineTo(currentX, height - 20);
        this.ctx.stroke();

        // Draw playhead at the top on the bar
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(currentX, barY + barHeight / 2, 6, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Check if point is over the playhead (red dot)
     */
    isOverPlayhead(x, y) {
        const currentX = this.timeToX(this.animation.currentTime);
        const barY = 15;
        const barHeight = 12;
        const playheadY = barY + barHeight / 2;
        const playheadRadius = 6;

        const dx = x - currentX;
        const dy = y - playheadY;
        return Math.sqrt(dx * dx + dy * dy) <= playheadRadius + 3; // Add 3px tolerance
    }

    /**
     * Check if point is over the timeline bar
     */
    isOverBar(x, y) {
        const padding = 40;
        const width = this.canvas.width - padding * 2;
        const barY = 15;
        const barHeight = 12;

        return x >= padding && x <= padding + width &&
               y >= barY && y <= barY + barHeight;
    }

    /**
     * Check if point is over a keyframe marker
     * Returns the keyframe time if found, null otherwise
     */
    getKeyframeAtPosition(x, y) {
        const barY = 15;
        const barHeight = 12;
        const kfY = barY + barHeight + 2;
        const clickTolerance = 8; // Pixels of tolerance for clicking

        for (const kf of this.animation.keyframes) {
            const kfX = this.timeToX(kf.time);

            // Check if click is within the keyframe marker area
            // The marker is a downward triangle + rectangle starting at kfY
            const dx = Math.abs(x - kfX);
            const dy = y - kfY;

            // Check if within clickable area (triangle + rectangle)
            if (dx <= clickTolerance && dy >= 0 && dy <= 40) {
                return kf.time;
            }
        }

        return null;
    }

    /**
     * Check if point is over a keyframe triangle handle (downward triangle)
     * Returns the keyframe time if found, null otherwise
     */
    getKeyframeHandleAtPosition(x, y) {
        const barY = 15;
        const barHeight = 12;
        const kfY = barY + barHeight + 2;

        for (const kf of this.animation.keyframes) {
            const kfX = this.timeToX(kf.time);

            // Triangle is at: top-left (kfX - 6, kfY), top-right (kfX + 6, kfY), bottom (kfX, kfY + 10)
            // Check if point is within triangle area
            const triangleTop = kfY;
            const triangleBottom = kfY + 10;
            const dx = Math.abs(x - kfX);

            // Simple box check for the triangle area with some tolerance
            if (y >= triangleTop && y <= triangleBottom + 3 && dx <= 8) {
                return kf.time;
            }
        }

        return null;
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if clicking on a keyframe triangle handle first (highest priority for dragging)
        const handleKeyframeTime = this.getKeyframeHandleAtPosition(x, y);
        if (handleKeyframeTime !== null) {
            // Start dragging this keyframe
            this.isDragging = true;
            this.dragSource = 'keyframe';
            this.draggedKeyframeTime = handleKeyframeTime;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Check if clicking on a keyframe body (but not handle)
        const keyframeTime = this.getKeyframeAtPosition(x, y);
        if (keyframeTime !== null) {
            // Select this keyframe for editing
            this.animation.selectKeyframe(keyframeTime);
            // Also move playhead to this keyframe
            this.animation.setTime(keyframeTime);
            return;
        }

        // Deselect keyframe if clicking elsewhere
        this.animation.deselectKeyframe();

        // Only allow dragging if clicking on playhead or bar
        if (this.isOverPlayhead(x, y)) {
            this.isDragging = true;
            this.dragSource = 'playhead';
            this.canvas.style.cursor = 'grabbing';
        } else if (this.isOverBar(x, y)) {
            this.isDragging = true;
            this.dragSource = 'bar';
            this.canvas.style.cursor = 'pointer';

            // Set time when clicking on bar
            const time = this.xToTime(x);
            this.animation.setTime(time);
        }
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Update cursor based on hover
        if (!this.isDragging) {
            // Check keyframe handle first
            const handleKeyframeTime = this.getKeyframeHandleAtPosition(x, y);
            if (handleKeyframeTime !== null) {
                this.canvas.style.cursor = 'grab';
            } else if (this.isOverPlayhead(x, y)) {
                this.canvas.style.cursor = 'grab';
            } else if (this.isOverBar(x, y)) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }

        // Handle dragging
        if (this.isDragging) {
            if (this.dragSource === 'keyframe') {
                // Dragging a keyframe - move it to new time
                const newTime = this.xToTime(x);
                if (this.draggedKeyframeTime !== null) {
                    this.animation.moveKeyframe(this.draggedKeyframeTime, newTime);
                    // Update the dragged keyframe time to the new time for continuous dragging
                    this.draggedKeyframeTime = newTime;
                }
            } else {
                // Dragging playhead or bar
                const time = this.xToTime(x);
                this.animation.setTime(time);
            }
        }
    }

    /**
     * Handle mouse up
     */
    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragSource = null;
            this.draggedKeyframeTime = null;
            this.canvas.style.cursor = 'default';
        }
    }
}
