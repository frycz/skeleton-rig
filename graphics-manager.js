/**
 * GraphicsManager - Manages SVG graphics for the skeleton
 */
class GraphicsManager {
    constructor() {
        this.graphics = []; // Array of graphic objects
        this.selectedGraphicId = null;
        this.nextGraphicId = 1;
        this.onGraphicsUpdate = null; // Callback when graphics change
    }

    /**
     * Load an SVG file and add it to the graphics list
     * @param {File} file - SVG file to load
     * @returns {Promise<Object>} The created graphic object
     */
    async loadSVG(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const svgData = e.target.result;

                    // Create graphic object
                    const graphic = {
                        id: `graphic-${this.nextGraphicId++}`,
                        fileName: file.name,
                        svgData: svgData,
                        attachedToBone: null,
                        transform: {
                            position: [0, 0], // Relative to bone if attached, absolute if not
                            rotation: 0, // In degrees
                            scale: [1.0, 1.0]
                        },
                        zIndex: this.graphics.length
                    };

                    this.graphics.push(graphic);

                    if (this.onGraphicsUpdate) {
                        this.onGraphicsUpdate();
                    }

                    resolve(graphic);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read SVG file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Remove a graphic by ID
     * @param {string} graphicId - ID of the graphic to remove
     */
    removeGraphic(graphicId) {
        const index = this.graphics.findIndex(g => g.id === graphicId);
        if (index >= 0) {
            this.graphics.splice(index, 1);

            if (this.selectedGraphicId === graphicId) {
                this.selectedGraphicId = null;
            }

            if (this.onGraphicsUpdate) {
                this.onGraphicsUpdate();
            }
        }
    }

    /**
     * Select a graphic for editing
     * @param {string|null} graphicId - ID of the graphic to select, or null to deselect
     */
    selectGraphic(graphicId) {
        this.selectedGraphicId = graphicId;

        if (this.onGraphicsUpdate) {
            this.onGraphicsUpdate();
        }
    }

    /**
     * Get the currently selected graphic
     * @returns {Object|null} The selected graphic object, or null
     */
    getSelectedGraphic() {
        if (!this.selectedGraphicId) return null;
        return this.graphics.find(g => g.id === this.selectedGraphicId);
    }

    /**
     * Update a graphic's transform
     * @param {string} graphicId - ID of the graphic
     * @param {Object} transform - New transform properties
     */
    updateTransform(graphicId, transform) {
        const graphic = this.graphics.find(g => g.id === graphicId);
        if (graphic) {
            graphic.transform = { ...graphic.transform, ...transform };

            if (this.onGraphicsUpdate) {
                this.onGraphicsUpdate();
            }
        }
    }

    /**
     * Attach a graphic to a bone
     * @param {string} graphicId - ID of the graphic
     * @param {string} boneId - ID of the bone to attach to
     * @param {Object} skeleton - Skeleton object (to compute relative transform)
     */
    attachToBone(graphicId, boneId, skeleton) {
        const graphic = this.graphics.find(g => g.id === graphicId);
        if (!graphic) return;

        const bone = skeleton.bones.find(b => b.id === boneId);
        if (!bone || !bone.worldTransform) return;

        // If graphic is already in world space, convert to bone-relative space
        if (!graphic.attachedToBone) {
            const worldPos = graphic.transform.position;
            const worldRot = graphic.transform.rotation;

            // Convert world position to bone-relative position
            const boneRotRad = (bone.worldTransform.rotation * Math.PI) / 180;
            const dx = worldPos[0] - bone.worldTransform.position[0];
            const dy = worldPos[1] - bone.worldTransform.position[1];

            // Rotate by negative bone rotation to get local position
            graphic.transform.position = [
                dx * Math.cos(-boneRotRad) - dy * Math.sin(-boneRotRad),
                dx * Math.sin(-boneRotRad) + dy * Math.cos(-boneRotRad)
            ];
            graphic.transform.rotation = worldRot - bone.worldTransform.rotation;
        } else if (graphic.attachedToBone !== boneId) {
            // Moving from one bone to another - convert through world space
            const oldBone = skeleton.bones.find(b => b.id === graphic.attachedToBone);
            if (oldBone && oldBone.worldTransform) {
                // Get world position from old bone
                const oldBoneRotRad = (oldBone.worldTransform.rotation * Math.PI) / 180;
                const rotatedX = graphic.transform.position[0] * Math.cos(oldBoneRotRad) -
                                graphic.transform.position[1] * Math.sin(oldBoneRotRad);
                const rotatedY = graphic.transform.position[0] * Math.sin(oldBoneRotRad) +
                                graphic.transform.position[1] * Math.cos(oldBoneRotRad);

                const worldPos = [
                    oldBone.worldTransform.position[0] + rotatedX,
                    oldBone.worldTransform.position[1] + rotatedY
                ];
                const worldRot = oldBone.worldTransform.rotation + graphic.transform.rotation;

                // Convert to new bone-relative space
                const newBoneRotRad = (bone.worldTransform.rotation * Math.PI) / 180;
                const dx = worldPos[0] - bone.worldTransform.position[0];
                const dy = worldPos[1] - bone.worldTransform.position[1];

                graphic.transform.position = [
                    dx * Math.cos(-newBoneRotRad) - dy * Math.sin(-newBoneRotRad),
                    dx * Math.sin(-newBoneRotRad) + dy * Math.cos(-newBoneRotRad)
                ];
                graphic.transform.rotation = worldRot - bone.worldTransform.rotation;
            }
        }

        graphic.attachedToBone = boneId;

        if (this.onGraphicsUpdate) {
            this.onGraphicsUpdate();
        }
    }

    /**
     * Detach a graphic from its bone
     * @param {string} graphicId - ID of the graphic
     * @param {Object} skeleton - Skeleton object (to compute world transform)
     */
    detachFromBone(graphicId, skeleton) {
        const graphic = this.graphics.find(g => g.id === graphicId);
        if (!graphic || !graphic.attachedToBone) return;

        const bone = skeleton.bones.find(b => b.id === graphic.attachedToBone);
        if (bone && bone.worldTransform) {
            // Convert bone-relative position to world position
            const boneRotRad = (bone.worldTransform.rotation * Math.PI) / 180;
            const rotatedX = graphic.transform.position[0] * Math.cos(boneRotRad) -
                            graphic.transform.position[1] * Math.sin(boneRotRad);
            const rotatedY = graphic.transform.position[0] * Math.sin(boneRotRad) +
                            graphic.transform.position[1] * Math.cos(boneRotRad);

            graphic.transform.position = [
                bone.worldTransform.position[0] + rotatedX,
                bone.worldTransform.position[1] + rotatedY
            ];
            graphic.transform.rotation = bone.worldTransform.rotation + graphic.transform.rotation;
        }

        graphic.attachedToBone = null;

        if (this.onGraphicsUpdate) {
            this.onGraphicsUpdate();
        }
    }

    /**
     * Get world transform for a graphic (considering bone attachment)
     * @param {Object} graphic - The graphic object
     * @param {Object} skeleton - Skeleton object
     * @returns {Object} World transform { position, rotation, scale }
     */
    getWorldTransform(graphic, skeleton) {
        if (!graphic.attachedToBone) {
            // Not attached - transform is already in world space
            return {
                position: [...graphic.transform.position],
                rotation: graphic.transform.rotation,
                scale: [...graphic.transform.scale]
            };
        }

        // Attached to bone - compute world transform
        const bone = skeleton.bones.find(b => b.id === graphic.attachedToBone);
        if (!bone || !bone.worldTransform) {
            return {
                position: [...graphic.transform.position],
                rotation: graphic.transform.rotation,
                scale: [...graphic.transform.scale]
            };
        }

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
     * Move a graphic's z-index up
     * @param {string} graphicId - ID of the graphic
     */
    moveUp(graphicId) {
        const index = this.graphics.findIndex(g => g.id === graphicId);
        if (index < this.graphics.length - 1) {
            [this.graphics[index], this.graphics[index + 1]] =
            [this.graphics[index + 1], this.graphics[index]];

            this.updateZIndices();
        }
    }

    /**
     * Move a graphic's z-index down
     * @param {string} graphicId - ID of the graphic
     */
    moveDown(graphicId) {
        const index = this.graphics.findIndex(g => g.id === graphicId);
        if (index > 0) {
            [this.graphics[index], this.graphics[index - 1]] =
            [this.graphics[index - 1], this.graphics[index]];

            this.updateZIndices();
        }
    }

    /**
     * Update z-indices based on array order
     */
    updateZIndices() {
        this.graphics.forEach((graphic, index) => {
            graphic.zIndex = index;
        });

        if (this.onGraphicsUpdate) {
            this.onGraphicsUpdate();
        }
    }

    /**
     * Clear all graphics
     */
    clear() {
        this.graphics = [];
        this.selectedGraphicId = null;
        this.nextGraphicId = 1;

        if (this.onGraphicsUpdate) {
            this.onGraphicsUpdate();
        }
    }

    /**
     * Get graphics sorted by z-index for rendering
     * @returns {Array} Graphics sorted by z-index
     */
    getGraphicsForRendering() {
        return [...this.graphics].sort((a, b) => a.zIndex - b.zIndex);
    }
}
