/**
 * KeyframeExporter - Exports animation keyframes with absolute coordinates
 *
 * This module exports keyframe data with all body parts (bones and graphics)
 * in absolute world coordinates, including position, rotation, scale, and time.
 */
class KeyframeExporter {
    constructor(skeleton, animation, graphicsManager) {
        this.skeleton = skeleton;
        this.animation = animation;
        this.graphicsManager = graphicsManager;
    }

    /**
     * Compute absolute world transform for a bone
     * @param {Object} bone - Bone object with local transform
     * @param {Map} boneMap - Map of bone id to bone object
     * @returns {Object} World transform with position, rotation
     */
    computeBoneWorldTransform(bone, boneMap) {
        if (bone.worldTransform) {
            return bone.worldTransform;
        }

        const localPos = bone.position || [0, 0];
        const localRot = bone.rotation || 0;

        if (!bone.parent) {
            // Root bone - local transform is world transform
            bone.worldTransform = {
                position: [...localPos],
                rotation: localRot
            };
        } else {
            // Child bone - apply parent rotation to local position
            const parent = boneMap.get(bone.parent);
            if (!parent) return null;

            const parentWorld = this.computeBoneWorldTransform(parent, boneMap);
            const parentRotRad = (parentWorld.rotation * Math.PI) / 180;

            // Rotate local position by parent's world rotation
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
    }

    /**
     * Compute absolute world transform for a graphic
     * @param {Object} graphic - Graphic object
     * @param {Object} bone - Bone the graphic is attached to (if any)
     * @returns {Object} World transform with position, rotation, scale
     */
    computeGraphicWorldTransform(graphic, bone) {
        if (!graphic.attachedToBone || !bone || !bone.worldTransform) {
            // Not attached - transform is already in world space
            return {
                position: [...graphic.transform.position],
                rotation: graphic.transform.rotation,
                scale: [...graphic.transform.scale]
            };
        }

        // Attached to bone - compute world transform
        const boneRotRad = (bone.worldTransform.rotation * Math.PI) / 180;
        const rotatedX = graphic.transform.position[0] * Math.cos(boneRotRad) -
                        graphic.transform.position[1] * Math.sin(boneRotRad);
        const rotatedY = graphic.transform.position[0] * Math.sin(boneRotRad) +
                        graphic.transform.position[1] * Math.cos(boneRotRad);

        return {
            position: [
                bone.worldTransform.position[0] + rotatedX,
                bone.worldTransform.position[1] + rotatedY
            ],
            rotation: bone.worldTransform.rotation + graphic.transform.rotation,
            scale: [...graphic.transform.scale]
        };
    }

    /**
     * Get interpolation method for a bone at a specific keyframe time
     * @param {string} boneId - Bone ID
     * @param {number} time - Keyframe time
     * @returns {string} Interpolation method (default: "linear")
     */
    getInterpolationMethod(boneId, time) {
        // Check if animation has track-based data with easing info
        if (this.animation.tracks) {
            const track = this.animation.tracks.find(t => t.boneId === boneId);
            if (track) {
                const keyframe = track.keyframes.find(kf => Math.abs(kf.time - time) < 0.01);
                if (keyframe && keyframe.easing) {
                    return keyframe.easing;
                }
            }
        }
        return "linear"; // Default interpolation
    }

    /**
     * Export all keyframes with absolute coordinates
     * @returns {Object} Export data structure
     */
    exportKeyframes() {
        const keyframes = [];

        // Build graphics library with SVG source data
        const graphicsLibrary = {};
        if (this.graphicsManager && this.graphicsManager.graphics) {
            for (const graphic of this.graphicsManager.graphics) {
                graphicsLibrary[graphic.id] = {
                    id: graphic.id,
                    fileName: graphic.fileName,
                    svgData: graphic.svgData
                };
            }
        }

        // Process each keyframe in the animation
        for (const keyframe of this.animation.keyframes) {
            const time = keyframe.time;
            const boneStates = keyframe.boneStates;

            // Create temporary skeleton state with the keyframe's bone rotations
            const tempSkeleton = JSON.parse(JSON.stringify(this.skeleton));

            // Apply bone states from keyframe
            for (const boneState of boneStates) {
                const bone = tempSkeleton.bones.find(b => b.id === boneState.id);
                if (bone) {
                    bone.rotation = boneState.rotation;
                }
            }

            // Build bone map and compute world transforms
            const boneMap = new Map();
            tempSkeleton.bones.forEach(bone => {
                boneMap.set(bone.id, bone);
                bone.worldTransform = null; // Clear existing transforms
            });

            // Compute world transforms for all bones
            tempSkeleton.bones.forEach(bone => {
                this.computeBoneWorldTransform(bone, boneMap);
            });

            // Export graphics data with absolute coordinates
            const graphics = [];
            if (this.graphicsManager && this.graphicsManager.graphics) {
                for (const graphic of this.graphicsManager.graphics) {
                    const attachedBone = graphic.attachedToBone ?
                        tempSkeleton.bones.find(b => b.id === graphic.attachedToBone) : null;

                    const worldTransform = this.computeGraphicWorldTransform(graphic, attachedBone);

                    graphics.push({
                        id: graphic.id,
                        position: worldTransform.position,
                        rotation: worldTransform.rotation,
                        scale: worldTransform.scale,
                        zIndex: graphic.zIndex || 0
                    });
                }
            }

            // Add keyframe to export
            keyframes.push({
                time: time,
                graphics: graphics
            });
        }

        // Adjust rotation values for shortest-path interpolation
        // This ensures animations take the shortest arc when interpolating between keyframes
        this.adjustRotationsForShortestPath(keyframes);

        // Build final export structure
        return {
            version: "1.0",
            metadata: {
                skeletonName: this.skeleton.name || "unknown",
                duration: this.animation.duration,
                fps: this.animation.fps || 60,
                totalKeyframes: keyframes.length,
                exportedAt: new Date().toISOString()
            },
            graphics: graphicsLibrary,
            keyframes: keyframes
        };
    }

    /**
     * Adjust rotation values to ensure shortest-path interpolation in animations
     * Modifies rotation values so that linear interpolation takes the shortest arc
     * Also applies Y-axis flip (negation) for SVG coordinate system
     * @param {Array} keyframes - Array of keyframe objects with graphics
     */
    adjustRotationsForShortestPath(keyframes) {
        if (keyframes.length < 2) {
            // Even with a single keyframe, we need to negate for SVG coordinate system
            if (keyframes.length === 1) {
                keyframes[0].graphics.forEach(graphic => {
                    graphic.rotation = -graphic.rotation;
                });
            }
            return;
        }

        // Get all unique graphic IDs
        const graphicIds = new Set();
        keyframes.forEach(kf => {
            kf.graphics.forEach(g => graphicIds.add(g.id));
        });

        // For each graphic, adjust its rotation values across keyframes
        graphicIds.forEach(graphicId => {
            // Collect rotation values for this graphic across all keyframes
            const rotations = [];
            keyframes.forEach(kf => {
                const graphic = kf.graphics.find(g => g.id === graphicId);
                if (graphic) {
                    // IMPORTANT: Negate rotation here for SVG coordinate system (Y-axis flip)
                    // This must be done BEFORE shortest-path adjustment
                    graphic.rotation = -graphic.rotation;
                    rotations.push(graphic);
                }
            });

            // Adjust consecutive rotations to use shortest path
            // Start from index 1 to compare with previous
            for (let i = 1; i < rotations.length; i++) {
                let prev = rotations[i - 1].rotation;
                let curr = rotations[i].rotation;

                // Normalize both values to a common range to compare them properly
                // This handles cases where values might be 0.96 vs 360.96
                const normalizedPrev = ((prev % 360) + 360) % 360;
                const normalizedCurr = ((curr % 360) + 360) % 360;

                // Calculate differences for both directions
                const diffDirect = normalizedCurr - normalizedPrev;
                let diff = diffDirect;

                // Choose shortest path
                if (diffDirect > 180) {
                    diff = diffDirect - 360;
                } else if (diffDirect < -180) {
                    diff = diffDirect + 360;
                }

                // Apply the adjustment relative to the previous (possibly adjusted) value
                rotations[i].rotation = prev + diff;
            }
        });
    }

    /**
     * Export keyframes and return as JSON string
     * @param {boolean} pretty - Whether to format JSON with indentation
     * @returns {string} JSON string
     */
    exportToJSON(pretty = true) {
        const data = this.exportKeyframes();
        return JSON.stringify(data, null, pretty ? 2 : 0);
    }
}
