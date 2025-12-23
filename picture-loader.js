/**
 * PictureLoader - Loads and saves Picture JSON files
 */
class PictureLoader {
    /**
     * Load picture from a JSON file
     * @param {File} file - Picture JSON file
     * @param {string} currentSkeletonName - Name of currently loaded skeleton
     * @returns {Promise<Object>} Parsed picture data
     */
    static async loadFromFile(file, currentSkeletonName) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            return this.parse(data, currentSkeletonName);
        } catch (error) {
            console.error('Error loading picture:', error);
            throw error;
        }
    }

    /**
     * Parse and validate picture data
     * @param {Object} data - Raw picture JSON data
     * @param {string} currentSkeletonName - Name of currently loaded skeleton
     * @returns {Object} Validated picture data
     */
    static parse(data, currentSkeletonName) {
        if (!data.version || !data.graphics) {
            throw new Error('Invalid picture format: missing required fields');
        }

        // Validate that picture references the current skeleton
        if (data.skeletonRef && currentSkeletonName) {
            const pictureSkeletonBase = data.skeletonRef.replace('.json', '');
            const currentSkeletonBase = currentSkeletonName.replace('.json', '');

            if (pictureSkeletonBase !== currentSkeletonBase) {
                console.warn(
                    `Picture references skeleton "${data.skeletonRef}" ` +
                    `but current skeleton is "${currentSkeletonName}". ` +
                    `Graphics may not align correctly.`
                );
            }
        }

        return {
            version: data.version,
            name: data.name,
            skeletonRef: data.skeletonRef,
            graphics: data.graphics.map(g => ({
                id: g.id,
                fileName: g.fileName,
                svgData: g.svgData,
                attachedToBone: g.attachedToBone,
                transform: {
                    position: [...g.transform.position],
                    rotation: g.transform.rotation,
                    scale: [...g.transform.scale]
                },
                zIndex: g.zIndex
            }))
        };
    }

    /**
     * Export picture to JSON format
     * @param {string} name - Picture name
     * @param {string} skeletonRef - Reference to skeleton file
     * @param {Array} graphics - Array of graphic objects
     * @returns {Object} Picture data in JSON format
     */
    static export(name, skeletonRef, graphics) {
        return {
            version: "1.0",
            name: name,
            skeletonRef: skeletonRef,
            graphics: graphics.map(g => ({
                id: g.id,
                svgData: g.svgData,
                fileName: g.fileName,
                attachedToBone: g.attachedToBone,
                transform: {
                    position: g.transform.position,
                    rotation: g.transform.rotation,
                    scale: g.transform.scale
                },
                zIndex: g.zIndex
            }))
        };
    }

    /**
     * Download picture as JSON file
     * @param {string} name - Picture name
     * @param {string} skeletonRef - Reference to skeleton file
     * @param {Array} graphics - Array of graphic objects
     */
    static download(name, skeletonRef, graphics) {
        const pictureData = this.export(name, skeletonRef, graphics);
        const jsonString = JSON.stringify(pictureData, null, 2);

        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name || 'picture'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Picture downloaded');
    }
}
