/**
 * SVGExporter - Exports animated SVG files from keyframe data
 *
 * This module generates a single SVG file with SMIL animations based on
 * the keyframe data exported by the KeyframeExporter.
 */
class SVGExporter {
    constructor(keyframeData) {
        this.data = keyframeData;
    }

    /**
     * Calculate the viewBox bounds based on all graphic positions
     * @returns {Object} ViewBox dimensions {minX, minY, width, height}
     */
    calculateViewBox() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        // Sample all keyframes to find bounds
        for (const keyframe of this.data.keyframes) {
            for (const graphic of keyframe.graphics) {
                const pos = graphic.position;
                // Add padding based on scale (assume max 100px graphic size)
                const padding = 100 * Math.max(graphic.scale[0], graphic.scale[1]);

                minX = Math.min(minX, pos[0] - padding);
                minY = Math.min(minY, pos[1] - padding);
                maxX = Math.max(maxX, pos[0] + padding);
                maxY = Math.max(maxY, pos[1] + padding);
            }
        }

        // Add extra padding
        const extraPadding = 50;
        minX -= extraPadding;
        minY -= extraPadding;
        maxX += extraPadding;
        maxY += extraPadding;

        return {
            minX: Math.floor(minX),
            minY: Math.floor(minY),
            width: Math.ceil(maxX - minX),
            height: Math.ceil(maxY - minY)
        };
    }

    /**
     * Convert SVG data URI to embedded SVG element and get its dimensions
     * @param {string} svgDataUri - SVG data URI
     * @returns {Object} Object with content, width, and height
     */
    extractSVGContent(svgDataUri) {
        // Decode the data URI
        const base64Data = svgDataUri.replace(/^data:image\/svg\+xml;base64,/, '');
        const svgString = atob(base64Data);

        // Parse to extract the inner content
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = doc.documentElement;

        // Get dimensions from viewBox or width/height attributes
        let width = 100, height = 100;
        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
            const [, , w, h] = viewBox.split(/\s+/).map(parseFloat);
            width = w;
            height = h;
        } else {
            width = parseFloat(svgElement.getAttribute('width')) || 100;
            height = parseFloat(svgElement.getAttribute('height')) || 100;
        }

        // Return the inner content and dimensions
        return {
            content: svgElement.innerHTML,
            width: width,
            height: height
        };
    }

    /**
     * Generate animation values for a property across keyframes
     * @param {string} graphicId - Graphic ID
     * @param {string} property - Property name (position, rotation, scale)
     * @param {number} index - Array index for position/scale (0 for x, 1 for y)
     * @returns {Object} Animation values and timing
     */
    generateAnimationValues(graphicId, property, index = null) {
        const values = [];
        const keyTimes = [];
        const duration = this.data.metadata.duration;

        for (const keyframe of this.data.keyframes) {
            const graphic = keyframe.graphics.find(g => g.id === graphicId);
            if (!graphic) continue;

            let value;
            if (property === 'position') {
                value = graphic.position[index];
                // Flip Y coordinate to match SVG coordinate system
                if (index === 1) {
                    value = -value;
                }
            } else if (property === 'rotation') {
                // Rotation is already negated and adjusted in KeyframeExporter
                value = graphic.rotation;
            } else if (property === 'scale') {
                value = graphic.scale[index];
            }

            values.push(value);
            keyTimes.push(keyframe.time / duration);
        }

        // Ensure the animation loops back to the first value
        // For rotation, apply shortest path logic for the loop
        if (property === 'rotation' && values.length > 0) {
            const lastValue = values[values.length - 1];
            const firstValue = values[0];
            const diff = firstValue - lastValue;

            let loopValue = firstValue;
            if (diff > 180) {
                loopValue = firstValue - 360;
            } else if (diff < -180) {
                loopValue = firstValue + 360;
            }
            values.push(loopValue);
        } else {
            values.push(values[0]);
        }
        keyTimes.push(1);

        return { values, keyTimes };
    }

    /**
     * Generate SVG animation elements for a graphic
     * @param {string} graphicId - Graphic ID
     * @returns {string} SVG animation markup
     */
    generateAnimations(graphicId) {
        const duration = this.data.metadata.duration;
        const animations = [];

        // Get position, rotation, and scale data
        const posXData = this.generateAnimationValues(graphicId, 'position', 0);
        const posYData = this.generateAnimationValues(graphicId, 'position', 1);
        const rotData = this.generateAnimationValues(graphicId, 'rotation');
        const scaleXData = this.generateAnimationValues(graphicId, 'scale', 0);
        const scaleYData = this.generateAnimationValues(graphicId, 'scale', 1);

        // Translate animation (must come first to be applied in correct order)
        const translateValues = posXData.values.map((posX, i) => `${posX} ${posYData.values[i]}`).join('; ');
        animations.push(`
    <animateTransform
      attributeName="transform"
      attributeType="XML"
      type="translate"
      values="${translateValues}"
      keyTimes="${posXData.keyTimes.join('; ')}"
      dur="${duration}s"
      repeatCount="indefinite"
    />`);

        // Rotate animation
        const rotateValues = rotData.values.map(rot => `${rot}`).join('; ');
        animations.push(`
    <animateTransform
      attributeName="transform"
      attributeType="XML"
      type="rotate"
      additive="sum"
      values="${rotateValues}"
      keyTimes="${rotData.keyTimes.join('; ')}"
      dur="${duration}s"
      repeatCount="indefinite"
    />`);

        // Scale animation
        const scaleValues = scaleXData.values.map((scaleX, i) => `${scaleX} ${scaleYData.values[i]}`).join('; ');
        animations.push(`
    <animateTransform
      attributeName="transform"
      attributeType="XML"
      type="scale"
      additive="sum"
      values="${scaleValues}"
      keyTimes="${scaleXData.keyTimes.join('; ')}"
      dur="${duration}s"
      repeatCount="indefinite"
    />`);

        return animations.join('');
    }

    /**
     * Generate the complete animated SVG
     * @returns {string} Complete SVG markup
     */
    generateSVG() {
        const viewBox = this.calculateViewBox();
        const graphics = this.data.graphics;

        // Sort graphics by zIndex for proper layering
        const firstKeyframe = this.data.keyframes[0];
        const sortedGraphics = [...firstKeyframe.graphics].sort((a, b) => a.zIndex - b.zIndex);

        // Extract SVG content and dimensions for all graphics
        const graphicData = {};
        for (const graphicId in graphics) {
            const graphic = graphics[graphicId];
            graphicData[graphicId] = this.extractSVGContent(graphic.svgData);
        }

        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}"
     width="${viewBox.width}"
     height="${viewBox.height}">
  <title>${this.data.metadata.skeletonName} - Animated</title>
  <desc>Generated from ${this.data.metadata.skeletonName} skeleton with ${this.data.metadata.totalKeyframes} keyframes, duration: ${this.data.metadata.duration}s</desc>

  <!-- Define graphics as symbols -->
  <defs>`;

        // Add each graphic as a symbol with proper centering
        for (const graphicId in graphics) {
            const data = graphicData[graphicId];
            const offsetX = -data.width / 2;
            const offsetY = -data.height / 2;
            svgContent += `
    <symbol id="symbol-${graphicId}" overflow="visible">
      <g transform="translate(${offsetX}, ${offsetY})">
        ${data.content}
      </g>
    </symbol>`;
        }

        svgContent += `
  </defs>

  <!-- Animated graphic instances -->`;

        // Create an animated instance for each graphic
        for (const graphicState of sortedGraphics) {
            const graphicId = graphicState.id;

            svgContent += `
  <g id="${graphicId}">
    <use href="#symbol-${graphicId}" />
    ${this.generateAnimations(graphicId)}
  </g>`;
        }

        svgContent += `
</svg>`;

        return svgContent;
    }

    /**
     * Export SVG as string
     * @returns {string} SVG markup
     */
    export() {
        return this.generateSVG();
    }

    /**
     * Trigger browser download of the SVG file
     * @param {string} filename - Filename for download (without extension)
     */
    download(filename = 'animation') {
        const svgContent = this.export();
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
