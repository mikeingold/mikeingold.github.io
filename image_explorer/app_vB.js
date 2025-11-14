// ========================================
//   UTILITIES
// ========================================

/**
 * For a textbox with a defined placeholder, if there is currently-entered text
 * then return that. Otherwise, return the placeholder.
 */
function textbox_value_or_placeholder(el) {
    return el.value || el.placeholder;
}

// ========================================
// DATA INITIALIZATION
// ========================================

class MapState {
    constructor(image_url, polygons = []) {
        this.image_url = image_url;
        this.polygons = polygons;
        this.user_polygons = [];
    }
}

// Default Upper and Lower Views
let MAP_UPPER = new MapState('assets/map_upper.png', MAP_POLYGONS.filter(f => f.side == "upper"))
let MAP_LOWER = new MapState('assets/map_lower.png', MAP_POLYGONS.filter(f => f.side == "lower"))

// Application state variables
let current_map_state = MAP_UPPER;
let dev_tools_enabled = false; // Whether developer mode is active
let tracing = false; // Whether user is currently tracing a polygon
let current_tracing_points = []; // Array of [x, y] coordinates for polygon being traced

// ========================================
// D3.JS SETUP
// ========================================

// Viewport dimensions - will be updated on resize
let width = window.innerWidth;
let height = window.innerHeight;

// D3 references - will be initialized after DOM loads
let container, svg, g, zoom, tooltip, info;

// ========================================
// IMAGE LOADING AND RENDERING
// ========================================

/**
 * Loads an image and sets up the initial view
 * Calculates appropriate zoom level to fit image in viewport
 */
function load_image(map_state) {
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
            .attr('href', map_state.image_url)
            .attr('width', imgWidth)
            .attr('height', imgHeight);

        // Apply initial transform to center and scale the image
        svg.call(zoom.transform, d3.zoomIdentity
            .translate(offsetX, offsetY)
            .scale(scale));

        // Render polygon overlays on top of image after a short delay
        // This ensures the transform is applied before rendering polygons
        setTimeout(() => {
            render_polygons();
        }, 10);
    };
    img.onerror = function() {
        console.error('Failed to load image:', map_state.image_url);
    };
    img.src = map_state.image_url;
}

/**
 * Renders all polygon features on the map
 * Includes both sample features and user-generated polygons
 * Attaches hover events for tooltip display
 */
function render_polygons() {
    // Remove any existing polygons to avoid duplicates
    g.selectAll('.polygon-area').remove();
    
    // Mark user-generated polygons with a flag for styling
    const allFeatures = [
        ...current_map_state.polygons.map(f => ({...f, isUserGenerated: false})),
        ...current_map_state.user_polygons.map(f => ({...f, isUserGenerated: true}))
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
 * Closes the reset confirmation modal
 */
function open_reset_confirmation_modal() {
    document.getElementById('reset-modal').classList.add('visible');
}

/**
 * Closes the reset confirmation modal
 */
function close_reset_confirmation_modal() {
    document.getElementById('reset-modal').classList.remove('visible');
}

/**
 * Resets zoom/pan to original fitted view
 * If user-generated polygons exist, shows confirmation modal first
 */
function request_reset_view() {
    if (current_map_state.user_polygons.length == 0) {
        // No user polygons, skip ahead to reset
        perform_reset_view();
    } else {
        // Trigger pop-up requiring confirmation to proceed
        open_reset_confirmation_modal();
        // User must select Reset or Cancel, which will trigger actions separately
    }
}

/**
 * Performs the actual reset operation: clears user polygons and reloads the image
 */
function perform_reset_view() {
    current_map_state.user_polygons = [];
    close_reset_confirmation_modal();
    load_image(current_map_state);
}

/**
 * Handles keyboard shortcuts during tracing mode
 * Enter: Complete polygon and open metadata modal
 * Escape: Cancel tracing and discard current polygon
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleKeyPress(event) {
    if (event.key === 'Enter' && tracing) {
        complete_polygon();
    } else if (event.key === 'Escape' && tracing) {
        cancel_tracing();
    }
}

// ========================================
//   UPPER/LOWER VIEWS
// ========================================

function switch_to_lower_view() {
    // Set button states
    document.getElementById('upper-view-btn').classList.remove('active');
    document.getElementById('lower-view-btn').classList.add('active');

    current_map_state = MAP_LOWER;
    load_image(current_map_state);
}

function switch_to_upper_view() {
    // Set button states
    document.getElementById('upper-view-btn').classList.add('active');
    document.getElementById('lower-view-btn').classList.remove('active');
    
    current_map_state = MAP_UPPER;
    load_image(current_map_state);
}

// ========================================
//   DEVELOPER TOOLS
// ========================================

/**
 * Toggles developer mode on/off
 * Shows/hides dev controls panel and updates toggle button appearance
 */
function toggle_dev_tools() {
    dev_tools_enabled = !dev_tools_enabled;
    const toggle_button = document.getElementById('dev-mode-toggle');
    const dev_controls = document.getElementById('dev-controls');
    
    if (dev_tools_enabled) {
        // Enable dev mode - show controls panel and change button color
        toggle_button.classList.add('active');
        dev_controls.classList.add('visible');
    } else {
        // Disable dev mode - hide controls and clean up
        toggle_button.classList.remove('active');
        dev_controls.classList.remove('visible');
        cancel_tracing(); // Clean up if tracing was in progress
    }
}

// ========================================
//   POLYGON TRACING: ACTIONS
// ========================================

/**
 * Begins polygon tracing mode
 * Changes cursor to crosshair and enables click handler for vertex placement
 */
function begin_tracing() {
    tracing = true;
    current_tracing_points = [];
    
    // Update UI state - change cursor and button visibility
    document.getElementById('container').classList.add('tracing');
    document.getElementById('trace-btn').style.display = 'none';
    document.getElementById('finish-btn').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'block';
    
    // Clear any previous drawing artifacts from abandoned tracings
    g.selectAll('.drawing-polygon, .drawing-point').remove();
    
    // Enable click handling for placing vertices
    svg.on('click', handle_tracing_click);
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
function handle_tracing_click(event) {
    if (!tracing) return;
    
    // Get click coordinates in image space (accounts for current zoom/pan transform)
    const [x, y] = d3.pointer(event, g.node());
    // Round coordinates to avoid sub-pixel precision issues
    current_tracing_points.push([Math.round(x), Math.round(y)]);
    
    // Draw a circle at the clicked point to mark the vertex
    g.append('circle')
        .attr('class', 'drawing-point')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 5);
    
    // After 2+ points, show the polygon shape preview
    if (current_tracing_points.length > 1) {
        // Remove old polygon preview and redraw with new point
        g.selectAll('.drawing-polygon').remove();
        g.append('polygon')
            .attr('class', 'drawing-polygon')
            .attr('points', current_tracing_points.map(c => c.join(',')).join(' '));
    }
}

/**
 * Completes the current polygon and shows metadata input modal
 * Validates that polygon has at least 3 points
 */
function complete_polygon() {
    // Polygons need at least 3 vertices to be valid
    if (current_tracing_points.length < 3) {
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
    update_json_modal_textbox();
}

/**
 * Cancels tracing and cleans up visual artifacts
 * Returns UI to dev mode ready state
 */
function cancel_tracing() {
    tracing = false;
    current_tracing_points = [];
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
//   POLYGON TRACING: KEEP/DISCARD MODAL
// ========================================

/**
 * Opens the user-generated-polygon keep-replace modal
 */
function open_polygon_keepreplace_modal() {
    document.getElementById('dev-modal').classList.add('visible');
}

/**
 * Closes the user-generated-polygon keep-replace modal
 */
function close_polygon_keepreplace_modal() {
    document.getElementById('dev-modal').classList.remove('visible');
}

function json_string(id, name, description, coordinates) {
    // Pack inputs into a JS object using a placeholder for coordinates and then
    // convert to JSON string with 4-space indentation. Without using a placeholder
    // placeholder the coordinates will inherit this indentation and occupy many lines.
    const object = {
        "id": id,
        "name": name,
        "description": description,
        "coordinates": "COORDINATES"
    }
    const object_string = JSON.stringify(object, null, 4)

    // Convert coordinates to a one-liner string with whitespace
    const coordinate_string = JSON.stringify(coordinates).replace(/,/g, ', ')

    // Replace the placeholder with actual coordinates and return
    return object_string.replace(/"COORDINATES"/, coordinate_string)
}

/**
 * Generates JSON output from form inputs and traced coordinates
 * Formats with coordinates on single line to match example format
 */
function update_json_modal_textbox() {
    // Get form values with fallback defaults
    const id = textbox_value_or_placeholder(document.getElementById('polygon-id'));
    const name = textbox_value_or_placeholder(document.getElementById('polygon-name'));
    const description = textbox_value_or_placeholder(document.getElementById('polygon-desc'));
    // Get coordinates from currently-traced polygon
    const coordinates = current_tracing_points;

    // Convert this data to JSON and write it into the textbox
    document.getElementById('json-output').value = json_string(id, name, description, coordinates);
}

/**
 * Performs a brief animation on the polygon JSON modal to indicate successful copy to clipboard
 */
function animate_json_modal_clipboard_success() {
    // Locate icon and copy contents
    const copy_icon = document.getElementById('copy-icon');
    const original_content = copy_icon.textContent;
    // Change contents to checkmark
    copy_icon.textContent = '✓';
    // Schedule this to revert 1 second later
    delay_ms = 1000
    setTimeout(() => { copy_icon.textContent = original_content; }, delay_ms);
}

/**
 * Copies polygon JSON output to the user's clipboard. Shows animated visual when
 * successful, or prints a console error on failure.
 */
async function copy_json_to_clipboard() {
    // Select all text in the "JSON Output" textbox and copy to clipboard
    const json_textbox = document.getElementById('json-output');
    
    // Use Clipboard API to attempt copy-to-clipboard
    try {
        await navigator.clipboard.writeText(json_textbox.value)
        animate_json_modal_clipboard_success()
    } catch (err) {
        console.error("Copying to user clipboard failed: ", err)
    }
}

/**
 * Keeps the current polygon, adds it to user-generated polygons
 * Closes modal and cleans up tracing state
 */
function keep_traced_polygon() {
    // Create polygon object from current data
    const newPolygon = {
        id: textbox_value_or_placeholder(document.getElementById('polygon-id')),
        name: textbox_value_or_placeholder(document.getElementById('polygon-name')),
        description: textbox_value_or_placeholder(document.getElementById('polygon-desc')),
        coordinates: [...current_tracing_points]
    };
    
    // Add to user-generated polygons
    current_map_state.user_polygons.push(newPolygon);
    
    // Re-render the map browser to show the new polygon
    render_polygons();
    
    // Close modal and clean up
    close_polygon_keepreplace_modal();
    cancel_tracing();
}

/**
 * Discards the current polygon
 * Closes modal and cleans up tracing state without saving
 */
function discard_traced_polygon() {
    close_polygon_keepreplace_modal();
    cancel_tracing();
}

// ========================================
//   DEV TOOLS: IMAGE UPLOAD
// ========================================

/**
 * Handles custom image upload from file input
 * Clears all polygons (features and user-generated) since coordinates are image-specific
 */
function handle_user_image_upload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Set view button states to inactive
            document.getElementById('upper-view-btn').classList.remove('active');
            document.getElementById('lower-view-btn').classList.remove('active');

            // Generate new MapState with this uploaded image
            current_map_state = new MapState(event.target.result)
            load_image(current_map_state);
        };
        // Convert file to data URL
        reader.readAsDataURL(file);
    }
}

/**
 * Triggers the hidden file input when the styled button is clicked
 */
function trigger_image_upload() {
    document.getElementById('image-upload').click();
}

// ========================================
//   MAP NAVIGATION
// ========================================

function handle_window_resize() {
    svg.attr('width', window.innerWidth)
        .attr('height', window.innerHeight);
}

function zoom_in() {
    svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 5/4);
}

function zoom_out() {
    svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 4/5);
}

// ========================================
//             INITIALIZATION
// ========================================

/**
 * Initializes the application after DOM is fully loaded
 * Sets up all event listeners and loads the initial image
 */
function initialize() {
    // Initialize D3 references
    container = d3.select('#container');
    svg = d3.select('#map-viewer'); // the SVG block inside the div#container
    g = svg.append('g');  // SVG group element
    zoom = d3.zoom();
    info_panel = document.getElementById('info-panel');

    // Set initial SVG size to initial window size
    svg.attr('width', width).attr('height', height);

    // Configure zoom behavior
    zoom.scaleExtent([0.5, 10]) // Min-max zoom levels
        .on('start', () => container.classed('grabbing', true))
        .on('zoom', (event) => g.attr('transform', event.transform))  // Apply transform to SVG group while panning
        .on('end',   () => container.classed('grabbing', false))

    // Apply zoom behavior to SVG element
    svg.call(zoom);

    // Close Info Panel when bare map is clicked
    //svg.on('click', close_info_panel); TODO

    // Reference to tooltip element for showing polygon metadata
    tooltip = d3.select('#tooltip');

    // Attach event listeners to interactive elements
    //   Always displayed
    document.getElementById('dev-mode-toggle').addEventListener('click', toggle_dev_tools);
    document.getElementById('reset-btn').addEventListener('click', request_reset_view);
    document.getElementById('zoom-in-btn').addEventListener('click', zoom_in);
    document.getElementById('zoom-out-btn').addEventListener('click', zoom_out);
    document.getElementById('upper-view-btn').addEventListener('click', switch_to_upper_view);
    document.getElementById('lower-view-btn').addEventListener('click', switch_to_lower_view);
    //   Developer Tools
    document.getElementById('load-image-btn').addEventListener('click', trigger_image_upload);
    document.getElementById('trace-btn').addEventListener('click', begin_tracing);
    document.getElementById('finish-btn').addEventListener('click', complete_polygon);
    document.getElementById('cancel-btn').addEventListener('click', cancel_tracing);
    //   Modal: Polygon Keep/Replace
    document.getElementById('copy-icon').addEventListener('click', copy_json_to_clipboard);
    document.getElementById('polygon-id').addEventListener('input', update_json_modal_textbox);
    document.getElementById('polygon-name').addEventListener('input', update_json_modal_textbox);
    document.getElementById('polygon-desc').addEventListener('input', update_json_modal_textbox);
    document.getElementById('keep-polygon-btn').addEventListener('click', keep_traced_polygon);
    document.getElementById('discard-polygon-btn').addEventListener('click', discard_traced_polygon);
    //   Modal: Confirm Reset
    document.getElementById('confirm-reset-btn').addEventListener('click', perform_reset_view);
    document.getElementById('cancel-reset-btn').addEventListener('click', close_reset_confirmation_modal);
    //   Background workers
    document.getElementById('image-upload').addEventListener('change', handle_user_image_upload);

    // Handle window resize to keep SVG properly sized
    window.addEventListener('resize', handle_window_resize);

    // Load sample image and features on initialization
    load_image(current_map_state);
}

// Wait for DOM to be fully loaded before initializing
// This ensures all elements are available when we try to access them
document.addEventListener('DOMContentLoaded', initialize);
