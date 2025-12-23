/**
 * SkeletonLoader - Loads and parses skeleton JSON files
 */
class SkeletonLoader {
    /**
     * Load skeleton from a JSON file
     * @param {string} path - Path to the skeleton JSON file
     * @returns {Promise<Object>} Parsed skeleton data
     */
    static async loadFromFile(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load skeleton: ${response.statusText}`);
            }
            const data = await response.json();
            return this.parse(data);
        } catch (error) {
            console.error('Error loading skeleton:', error);
            throw error;
        }
    }

    /**
     * Parse and validate skeleton data
     * @param {Object} data - Raw skeleton JSON data
     * @returns {Object} Validated skeleton data with computed transforms
     */
    static parse(data) {
        if (!data.version || !data.bones) {
            throw new Error('Invalid skeleton format: missing required fields');
        }

        // Create a map of bones by ID for quick lookup
        const boneMap = new Map();
        data.bones.forEach(bone => {
            boneMap.set(bone.id, { ...bone });
        });

        // Compute world transforms for each bone
        const computeWorldTransform = (bone) => {
            if (bone.worldTransform) {
                return bone.worldTransform; // Already computed
            }

            // Start with local transform
            const localPos = bone.position || [0, 0];
            const localRot = bone.rotation || 0;

            if (!bone.parent) {
                // Root bone - world transform is same as local
                bone.worldTransform = {
                    position: [...localPos],
                    rotation: localRot
                };
            } else {
                // Get parent's world transform
                const parent = boneMap.get(bone.parent);
                if (!parent) {
                    throw new Error(`Parent bone '${bone.parent}' not found for bone '${bone.id}'`);
                }

                const parentWorld = computeWorldTransform(parent);

                // Convert parent rotation to radians
                const parentRotRad = (parentWorld.rotation * Math.PI) / 180;

                // Rotate local position by parent's world rotation
                const rotatedX = localPos[0] * Math.cos(parentRotRad) - localPos[1] * Math.sin(parentRotRad);
                const rotatedY = localPos[0] * Math.sin(parentRotRad) + localPos[1] * Math.cos(parentRotRad);

                // Add to parent's world position
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

        // Compute transforms for all bones
        data.bones.forEach(bone => {
            const boneData = boneMap.get(bone.id);
            computeWorldTransform(boneData);
        });

        return {
            version: data.version,
            name: data.name,
            metadata: data.metadata || {},
            bones: Array.from(boneMap.values())
        };
    }

    /**
     * Get bone hierarchy as a tree structure
     * @param {Object} skeleton - Parsed skeleton data
     * @returns {Array} Root bones with nested children
     */
    static buildHierarchy(skeleton) {
        const boneMap = new Map();
        skeleton.bones.forEach(bone => {
            boneMap.set(bone.id, { ...bone, children: [] });
        });

        const roots = [];
        boneMap.forEach(bone => {
            if (!bone.parent) {
                roots.push(bone);
            } else {
                const parent = boneMap.get(bone.parent);
                if (parent) {
                    parent.children.push(bone);
                }
            }
        });

        return roots;
    }
}
