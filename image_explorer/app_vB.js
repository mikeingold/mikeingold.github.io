/* ============================================
    JAVASCRIPT - Ready to move to map-viewer.js
    ============================================ */

// ========================================
// DATA INITIALIZATION
// ========================================

const sampleImageURL = 'assets/map_upper.png';

// Example polygon features - coordinates are in pixel space relative to image
const sampleFeatures = [
    {
        "id": "1000",
        "name": "Power Connector",
        "description": "Connects to power cable.",
        "coordinates": [[84,23],[85,256],[132,256],[130,238],[220,237],[221,24]]
    },
    {
        "id": "1001",
        "name": "USB Connector",
        "description": "Connects to USB cable.",
        "coordinates": [[538,54],[533,162],[693,161],[690,52]]
    },
    {
        "id": "1002",
        "name": "Reset Button",
        "description": "Button to reset device.",
        "coordinates": [[704,229],[838,231],[840,105],[701,112]]
    },
    {
        "id": "1003",
        "name": "CPU",
        "description": "Main processor.",
        "coordinates": [[354,886],[461,997],[566,879],[455,780]]
    }
];

// Application state variables
let features = [...sampleFeatures]; // Current features array (cloned to avoid mutation)
let userGeneratedPolygons = []; // Polygons created by user in dev mode (session only)
let currentImage = sampleImageURL; // Currently loaded image URL
let devMode = false; // Whether developer mode is active
let tracing = false; // Whether user is currently tracing a polygon
let tracingPoints = []; // Array of [x, y] coordinates for polygon being traced

// ========================================
// D3.JS SETUP
// ========================================

// Viewport dimensions - will be updated on resize
let width = window.innerWidth;
let height = window.innerHeight;

// D3 references - will be initialized after DOM loads
let svg, g, zoom, tooltip;

// ========================================
// IMAGE LOADING AND RENDERING
// ========================================

/**
 * Loads an image and sets up the initial view
 * Calculates appropriate zoom level to fit image in viewport
 * @param {string} url - Image URL or data URL to load
 */
function loadImage(url) {
    // Clear any existing content (image and polygons)
    g.selectAll('*').remove();
    
    // Use native Image object to get dimensions before rendering
    const img = new Image();
    img.onload = function() {
        const imgWidth = this.width;
        const imgHeight = this.height;
        
        // Calculate scale to fit image in viewport with 90% coverage
        // This leaves some margin around the edges
        const scale = Math.min(width / imgWidth, height / imgHeight) * 0.9;
        
        // Center the image in the viewport
        const offsetX = (width - imgWidth * scale) / 2;
        const offsetY = (height - imgHeight * scale) / 2;

        // Add image element to SVG at native resolution
        // D3 zoom will handle the scaling
        g.append('image')
            .attr('href', url)
            .attr('width', imgWidth)
            .attr('height', imgHeight);

        // Apply initial transform to center and scale the image
        svg.call(zoom.transform, d3.zoomIdentity
            .translate(offsetX, offsetY)
            .scale(scale));

        // Render polygon overlays on top of image after a short delay
        // This ensures the transform is applied before rendering polygons
        setTimeout(() => {
            renderFeatures();
        }, 10);
    };
    img.onerror = function() {
        console.error('Failed to load image:', url);
    };
    img.src = url;
}

/**
 * Renders all polygon features on the map
 * Includes both sample features and user-generated polygons
 * Attaches hover events for tooltip display
 */
function renderFeatures() {
    // Remove any existing polygons to avoid duplicates
    g.selectAll('.polygon-area').remove();
    
    // Mark user-generated polygons with a flag for styling
    const allFeatures = [
        ...features.map(f => ({...f, isUserGenerated: false})),
        ...userGeneratedPolygons.map(f => ({...f, isUserGenerated: true}))
    ];
    
    // Create polygon elements from features data using D3 data binding
    g.selectAll('.polygon-area')
        .data(allFeatures)
        .enter()
        .append('polygon')
        .attr('class', d => d.isUserGenerated ? 'polygon-area user-generated' : 'polygon-area')
        // Convert coordinate arrays to SVG points format: "x1,y1 x2,y2 x3,y3"
        .attr('points', d => d.coordinates.map(c => c.join(',')).join(' '))
        .on('mouseenter', function(event, d) {
            // Don't show tooltips while tracing to avoid interference with polygon drawing
            if (!tracing) {
                d3.select('#tooltip-title').text(d.name);
                d3.select('#tooltip-description').text(d.description);
                tooltip.classed('visible', true);
            }
        })
        .on('mousemove', function(event) {
            // Update tooltip position to follow cursor with slight offset
            if (!tracing) {
                tooltip
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY + 15) + 'px');
            }
        })
        .on('mouseleave', function() {
            // Hide tooltip when mouse leaves polygon
            tooltip.classed('visible', false);
        });
}

// ========================================
// VIEW CONTROLS
// ========================================

/**
 * Resets zoom/pan to original fitted view
 * If user-generated polygons exist, shows confirmation modal first
 */
function resetZoom() {
    // Check if there are user-generated polygons to warn about
    if (userGeneratedPolygons.length > 0) {
        document.getElementById('reset-modal').classList.add('visible');
    } else {
        // No user polygons, just reset
        performReset();
    }
}

/**
 * Performs the actual reset operation
 * Clears user polygons and reloads the image
 */
function performReset() {
    userGeneratedPolygons = [];
    loadImage(currentImage);
    closeResetModal();
}

/**
 * Closes the reset confirmation modal
 */
function closeResetModal() {
    document.getElementById('reset-modal').classList.remove('visible');
}

/**
 * Handles keyboard shortcuts during tracing mode
 * Enter: Complete polygon and open metadata modal
 * Escape: Cancel tracing and discard current polygon
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyPress(event) {
    if (event.key === 'Enter' && tracing) {
        finishPolygon();
    } else if (event.key === 'Escape' && tracing) {
        cancelTracing();
    }
}

// ========================================
// DEVELOPER MODE CONTROLS
// ========================================

/**
 * Toggles developer mode on/off
 * Shows/hides dev controls panel and updates toggle button appearance
 */
function toggleDevMode() {
    devMode = !devMode;
    const toggleBtn = document.getElementById('dev-mode-toggle');
    const devControls = document.getElementById('dev-controls');
    
    if (devMode) {
        // Enable dev mode - show controls panel and change button color
        toggleBtn.classList.add('active');
        devControls.classList.add('visible');
    } else {
        // Disable dev mode - hide controls and clean up
        toggleBtn.classList.remove('active');
        devControls.classList.remove('visible');
        cancelTracing(); // Clean up if tracing was in progress
    }
}

/**
 * Begins polygon tracing mode
 * Changes cursor to crosshair and enables click handler for vertex placement
 */
function startTracing() {
    tracing = true;
    tracingPoints = [];
    
    // Update UI state - change cursor and button visibility
    document.getElementById('container').classList.add('tracing');
    document.getElementById('trace-btn').style.display = 'none';
    document.getElementById('finish-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'block';
    
    // Clear any previous drawing artifacts from abandoned tracings
    g.selectAll('.drawing-polygon, .drawing-point').remove();
    
    // Enable click handling for placing vertices
    svg.on('click', handleClick);
    // Enable keyboard shortcuts for finishing/canceling
    document.addEventListener('keydown', handleKeyPress);
    // Hide any visible tooltips to avoid confusion
    tooltip.classed('visible', false);
}

/**
 * Handles clicks during tracing to add polygon vertices
 * Updates visual feedback by drawing points and connecting lines
 * @param {MouseEvent} event - The click event
 */
function handleClick(event) {
    if (!tracing) return;
    
    // Get click coordinates in image space (accounts for current zoom/pan transform)
    const [x, y] = d3.pointer(event, g.node());
    // Round coordinates to avoid sub-pixel precision issues
    tracingPoints.push([Math.round(x), Math.round(y)]);
    
    // Draw a circle at the clicked point to mark the vertex
    g.append('circle')
        .attr('class', 'drawing-point')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5);
    
    // After 2+ points, show the polygon shape preview
    if (tracingPoints.length > 1) {
        // Remove old polygon preview and redraw with new point
        g.selectAll('.drawing-polygon').remove();
        g.append('polygon')
            .attr('class', 'drawing-polygon')
            .attr('points', tracingPoints.map(c => c.join(',')).join(' '));
    }
}

/**
 * Completes the current polygon and shows metadata input modal
 * Validates that polygon has at least 3 points
 */
function finishPolygon() {
    // Polygons need at least 3 vertices to be valid
    if (tracingPoints.length < 3) {
        alert('Please trace at least 3 points to create a polygon');
        return;
    }
    
    // Exit tracing mode but keep visual artifacts for reference
    tracing = false;
    svg.on('click', null);
    
    // Show modal for metadata input
    const modal = document.getElementById('dev-modal');
    modal.classList.add('visible');
    
    // Reset form fields to defaults
    document.getElementById('polygon-id').value = '';
    document.getElementById('polygon-name').value = '';
    document.getElementById('polygon-desc').value = '';
    // Generate initial JSON with default values
    updateJSON();
}

/**
 * Cancels tracing and cleans up visual artifacts
 * Returns UI to dev mode ready state
 */
function cancelTracing() {
    tracing = false;
    tracingPoints = [];
    // Remove click handler
    svg.on('click', null);
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleKeyPress);
    
    // Restore normal grab cursor
    document.getElementById('container').classList.remove('tracing');
    
    // Remove all drawing artifacts (points and polygon preview)
    g.selectAll('.drawing-polygon, .drawing-point').remove();
    
    // Reset button visibility to initial dev mode state
    document.getElementById('trace-btn').style.display = 'block';
    document.getElementById('finish-btn').style.display = 'none';
    document.getElementById('cancel-btn').style.display = 'none';
}

// ========================================
// JSON GENERATION AND MODAL
// ========================================

/**
 * Generates JSON output from form inputs and traced coordinates
 * Formats with coordinates on single line to match example format
 */
function updateJSON() {
    // Get form values with fallback defaults
    const id = document.getElementById('polygon-id').value || 'new-polygon';
    const name = document.getElementById('polygon-name').value || 'New Feature';
    const desc = document.getElementById('polygon-desc').value || 'Feature description';
    
    // Stringify coordinates array on single line (compact format)
    const coordsString = JSON.stringify(tracingPoints);
    
    // Build formatted JSON string manually for precise formatting control
    // Note: Template literal is NOT indented because whitespace is preserved in the output
    // Starting at column 0 ensures clean JSON without extra leading spaces
    const jsonString = 
`{
"id": "${id}",
"name": "${name}",
"description": "${desc}",
"coordinates": ${coordsString}
}`;
    
    document.getElementById('json-output').value = jsonString;
}

/**
 * Copies JSON output to clipboard
 * Shows confirmation alert on success
 */
function copyJSON() {
    const textarea = document.getElementById('json-output');
    textarea.select();
    document.execCommand('copy');
    
    // Visual feedback
    const copyIcon = document.getElementById('copy-icon');
    const originalText = copyIcon.textContent;
    copyIcon.textContent = '✓';
    setTimeout(() => {
        copyIcon.textContent = originalText;
    }, 1000);
}

/**
 * Keeps the current polygon, adds it to user-generated polygons
 * Closes modal and cleans up tracing state
 */
function keepPolygon() {
    // Get form values
    const id = document.getElementById('polygon-id').value || 'new-polygon';
    const name = document.getElementById('polygon-name').value || 'New Feature';
    const desc = document.getElementById('polygon-desc').value || 'Feature description';
    
    // Create polygon object
    const newPolygon = {
        id: id,
        name: name,
        description: desc,
        coordinates: [...tracingPoints]
    };
    
    // Add to user-generated polygons
    userGeneratedPolygons.push(newPolygon);
    
    // Re-render to show the new polygon
    renderFeatures();
    
    // Close modal and clean up
    closeModal();
}

/**
 * Discards the current polygon
 * Closes modal and cleans up tracing state without saving
 */
function discardPolygon() {
    closeModal();
}

/**
 * Closes the metadata modal and cleans up tracing state
 * Returns to dev mode ready state
 */
function closeModal() {
    document.getElementById('dev-modal').classList.remove('visible');
    cancelTracing();
}

/**
 * Handles custom image upload from file input
 * Clears all polygons (features and user-generated) since coordinates are image-specific
 */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Store data URL for future resets
            currentImage = event.target.result;
            // Clear all polygons since they won't match new image dimensions/content
            features = [];
            userGeneratedPolygons = [];
            loadImage(currentImage);
        };
        // Convert file to data URL
        reader.readAsDataURL(file);
    }
}

/**
 * Triggers the hidden file input when the styled button is clicked
 */
function triggerFileInput() {
    document.getElementById('image-upload').click();
}

/**
 * Handles window resize events
 * Updates SVG dimensions and maintains current view
 */
function handleResize() {
    // Update viewport dimensions
    width = window.innerWidth;
    height = window.innerHeight;
    
    // Update SVG size
    svg.attr('width', width)
        .attr('height', height);
}

/**
 * Zooms in by a fixed factor
 */
function zoomIn() {
    svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 1.5);
}

/**
 * Zooms out by a fixed factor
 */
function zoomOut() {
    svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 0.67);
}

// ========================================
// EVENT LISTENER SETUP
// ========================================

/**
 * Initializes the application after DOM is fully loaded
 * Sets up all event listeners and loads the initial image
 */
function initializeApp() {
    // Initialize D3 references
    svg = d3.select('#container')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Create a group element for zoom/pan transformations
    // This allows us to transform the entire image and polygons together
    g = svg.append('g');

    // Configure zoom behavior with scale limits
    zoom = d3.zoom()
        .scaleExtent([0.5, 10]) // Min 50% zoom out, max 10x zoom in
        .on('zoom', (event) => {
            // Apply zoom/pan transformation to the group containing image and polygons
            g.attr('transform', event.transform);
        });

    // Apply zoom behavior to SVG element
    svg.call(zoom);

    // Reference to tooltip element for showing polygon metadata
    tooltip = d3.select('#tooltip');

    // Attach event listeners to buttons using addEventListener (modern approach)
    document.getElementById('reset-btn').addEventListener('click', resetZoom);
    document.getElementById('zoom-in-btn').addEventListener('click', zoomIn);
    document.getElementById('zoom-out-btn').addEventListener('click', zoomOut);
    document.getElementById('dev-mode-toggle').addEventListener('click', toggleDevMode);
    document.getElementById('trace-btn').addEventListener('click', startTracing);
    document.getElementById('finish-btn').addEventListener('click', finishPolygon);
    document.getElementById('cancel-btn').addEventListener('click', cancelTracing);
    document.getElementById('copy-icon').addEventListener('click', copyJSON);
    document.getElementById('keep-polygon-btn').addEventListener('click', keepPolygon);
    document.getElementById('discard-polygon-btn').addEventListener('click', discardPolygon);
    document.getElementById('confirm-reset-btn').addEventListener('click', performReset);
    document.getElementById('cancel-reset-btn').addEventListener('click', closeResetModal);
    document.getElementById('load-image-btn').addEventListener('click', triggerFileInput);
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);

    // Attach input event listeners to update JSON in real-time as user types
    document.getElementById('polygon-id').addEventListener('input', updateJSON);
    document.getElementById('polygon-name').addEventListener('input', updateJSON);
    document.getElementById('polygon-desc').addEventListener('input', updateJSON);

    // Handle window resize to keep SVG properly sized
    window.addEventListener('resize', handleResize);

    // Load sample image and features on initialization
    loadImage(currentImage);
}

// ========================================
// INITIALIZATION
// ========================================

// Wait for DOM to be fully loaded before initializing
// This ensures all elements are available when we try to access them
document.addEventListener('DOMContentLoaded', initializeApp);
