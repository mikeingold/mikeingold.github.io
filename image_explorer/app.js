// ========================================
//   STATE
// ========================================

// Default Upper and Lower Views
let MAP_UPPER = new MapState("upper", 'assets/map_upper.png', MAP_POLYGONS.filter(f => f.side == "upper"))
let MAP_LOWER = new MapState("lower", 'assets/map_lower.png', MAP_POLYGONS.filter(f => f.side == "lower"))

// Application state
let current_map_state = MAP_UPPER;
let dev_tools_enabled = false; // Whether developer mode is active
let tracing = false;                // whether user is currently tracing a polygon

// User-generated polygons
let current_tracing_points = [];    // array of [x, y] coordinates for polygon being traced
let target_polygon = null;          // the currently-selected user-generated polygon

// D3 references - will be initialized after DOM loads
let container, svg, g, zoom, tooltip, info;


// ========================================
//   MODAL: ICON SPLASH
// ========================================

function hide_splash_modal() {
    document.getElementById('app-splash-modal').classList.remove("visible");
}


// ========================================
//   BASIC MAP FUNCTIONS
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
        // Determine heights & widths of window and image
        const image_height = this.height;
        const image_width = this.width;
        const window_height = window.innerHeight;
        const window_width = window.innerWidth;
        const ratio_height = window_height / image_height
        const ratio_width = window_width / image_width
        // Fit image in viewport, leaving some margin around the edges
        const scale = 0.9 * Math.min(ratio_width, ratio_height);
        // Center the image in the viewport
        const offsetX = (window_width - image_width * scale) / 2;
        const offsetY = (window_height - image_height * scale) / 2;

        // Add image element to SVG at native resolution
        g.append('image')
            .attr('href', map_state.image_url)
            .attr('width', image_width)
            .attr('height', image_height);
        // Apply initial transform to center and scale the image
        svg.call(zoom.transform, d3.zoomIdentity
            .translate(offsetX, offsetY)
            .scale(scale)
        );
        // Render polygon overlays on top of image after a short delay
        // This ensures the transform is applied before rendering polygons
        setTimeout(() => { render_polygons() }, 10);
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

    // Event handlers to be assigned later in this function
    const g_mouseenter = (event, d) => {
        if (tracing) return; // no tooltips while tracing
        d3.select('#tooltip-title').text(d.name);
        d3.select('#tooltip-description').text(d.description);
        tooltip.classed('visible', true);
    };
    const g_mousemove = (event) => {
        if (tracing) return; // no tooltips while tracing
        position_x = String(event.pageX + 15) + 'px'
        position_y = String(event.pageY + 15) + 'px'
        tooltip
            .style('left', position_x)
            .style('top', position_y);
    };
    const g_mouseleave = () => {
        // Hide tooltip when mouse leaves polygon
        tooltip.classed('visible', false);
    }
    const g_click = (event, d) => {
        event.stopPropagation(); // stop event from propagating to map features behind this one
        if (tracing) return; // no tooltips while tracing
        if (d.isUserGenerated) {
            target_polygon = get_user_polygon(d.uuid)
            open_user_polygon_info_panel(target_polygon)
        } else {
            open_polygon_info_panel(get_polygon(d.id))
        }
    }

    // Mark user-generated polygons with a flag for styling
    const allFeatures = [
        ...current_map_state.polygons.map(f => ({...f, isUserGenerated: false})),
        ...current_map_state.user_polygons.map(f => ({...f, isUserGenerated: true}))
    ];

    // Draw SVG polygonsCreate polygon elements from features data using D3 data binding
    g.selectAll('.polygon-area')
        .data(allFeatures)
        .enter()
        .append('polygon')
        .attr('class', d => d.isUserGenerated ? 'polygon-area user-generated' : 'polygon-area')  // sets css class based on type flag
        .attr('points', d => coordinate_string(d.coordinates))
        .on('mouseenter', g_mouseenter)
        .on('mousemove', g_mousemove)
        .on('mouseleave', g_mouseleave)
        .on('click', g_click);

    // TODO consider splitting this to draw user-generated separately?
}

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
//   RESET MAP
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

function handle_click_normal() {
    close_polygon_info_panel();
    close_user_polygon_info_panel();
}

// ========================================
//   UPPER/LOWER VIEWS
// ========================================

function switch_to_lower_view() {
    // Set button states
    document.getElementById('upper-view-btn').classList.remove('active');
    document.getElementById('lower-view-btn').classList.add('active');

    // Close polygon info panels if needed
    close_polygon_info_panel();
    close_user_polygon_info_panel();

    current_map_state = MAP_LOWER;
    load_image(current_map_state);
}

function switch_to_upper_view() {
    // Set button states
    document.getElementById('upper-view-btn').classList.add('active');
    document.getElementById('lower-view-btn').classList.remove('active');

    // Close polygon info panels if needed
    close_polygon_info_panel();
    close_user_polygon_info_panel();
    
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
        exit_tracing(); // Clean up if tracing was in progress
    }
}

// ========================================
//   POLYGON TRACING
// ========================================

/**
 * Handles keyboard shortcuts during tracing mode
 * Enter: Complete polygon and open metadata modal
 * Escape: Cancel tracing and discard current polygon
 * @param {KeyboardEvent} event - The keyboard event
 */
function handle_keypress_while_tracing(event) {
    if (event.key === 'Enter' && tracing) {
        complete_polygon();
    } else if (event.key === 'Escape' && tracing) {
        exit_tracing();
    }
}

/**
 * Handles clicks during tracing to add polygon vertices
 * Updates visual feedback by drawing points and connecting lines
 * @param {MouseEvent} event - The click event
 */
function handle_click_while_tracing(event) {
    if (!tracing) return;
    
    // Get click coordinates (in the mapped space), save them to traced polygon
    const [x, y] = d3.pointer(event, g.node());
    current_tracing_points.push([Math.round(x), Math.round(y)]); // avoid sub-pixel issues
    
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
            .attr('points', coordinate_string(current_tracing_points));
    }
}

/**
 * Begins polygon tracing mode
 * Changes cursor to crosshair and enables click handler for vertex placement
 */
function begin_tracing() {
    tracing = true;
    current_tracing_points = [];

    // Close any open info panels
    close_polygon_info_panel();
    close_user_polygon_info_panel();
    
    // Change cursor to crosshairs
    document.getElementById('container').classList.add('tracing');
    document.querySelectorAll('.polygon-area').forEach(p => p.classList.add("tracing"))
    // Temporarily disable/gray the "Trace a Feature" button
    document.getElementById('trace-btn').disabled = true;
    // Make the tracing action buttons visible
    document.getElementById('tracing-controls').classList.add("active")
    
    // Clear any previous drawing artifacts from abandoned tracings
    g.selectAll('.drawing-polygon, .drawing-point').remove();
    
    // Enable click handling for placing vertices
    svg.on('click', handle_click_while_tracing);
    // Enable keyboard shortcuts for finishing/canceling
    document.addEventListener('keydown', handle_keypress_while_tracing);
    // Hide any visible tooltips to avoid confusion
    tooltip.classed('visible', false);
}

/**
 * Completes the current polygon and shows polygon info panel
 * Validates that polygon has at least 3 points
 */
function complete_polygon() {
    // Polygons need at least 3 vertices to be valid
    if (current_tracing_points.length < 3) {
        alert('Please trace at least 3 points to create a polygon');
        return;
    }
    
    // Generate polygon and add it to the current user_polygon array
    const new_polygon = {
        "uuid": globalThis.crypto.randomUUID(), // used internally to locate entries for deletion
        "id": "new-id",
        "side": current_map_state.name,
        "name": "New Feature Name",
        "description": "New feature description",
        "coordinates": current_tracing_points
    }
    current_map_state.user_polygons.push(new_polygon);
    target_polygon = new_polygon;

    // Update UI: exit tracing, open polygon info panel, re-render all polygons
    exit_tracing()
    open_user_polygon_info_panel(new_polygon);
    render_polygons()
}

/**
 * Exits tracing mode and cleans up visual artifacts
 */
function exit_tracing() {
    tracing = false;
    current_tracing_points = [];

    // Revert handlers
    svg.on('click', handle_click_normal);
    document.removeEventListener('keydown', handle_keypress_while_tracing);
    
    // Restore normal grab cursor
    document.getElementById('container').classList.remove('tracing');
    document.querySelectorAll('.polygon-area').forEach(p => p.classList.remove("tracing"))
    
    // Remove any drawing artifacts (points and polygon preview)
    g.selectAll('.drawing-polygon, .drawing-point').remove();
    
    // Reset button visibility to initial dev mode state
    document.getElementById('trace-btn').disabled = false;
    document.getElementById('tracing-controls').classList.remove("active")
}

// ========================================
//   POLYGON INFO PANEL (STANDARD)
// ========================================

function open_polygon_info_panel(polygon) {
    // Make panel visible
    document.getElementById('polygon-std-info-panel').classList.add('visible');

    // Set text fields
    document.getElementById('polygon-id').value = polygon.id;
    document.getElementById('polygon-name').value = polygon.name;
    document.getElementById('polygon-description').value = polygon.description;
}

function close_polygon_info_panel() {
    // Make panel invisible
    document.getElementById('polygon-std-info-panel').classList.remove('visible');

    // Blank the text fields
    document.getElementById('polygon-id').value = '';
    document.getElementById('polygon-name').value = '';
    document.getElementById('polygon-description').value = '';
}

// ========================================
//   POLYGON INFO PANEL (USER-GENERATED)
// ========================================

function open_user_polygon_info_panel(polygon) {
    // Make panel visible
    document.getElementById('polygon-user-info-panel').classList.add('visible');

    // Set text fields
    document.getElementById('user-polygon-id').value = polygon.id;
    document.getElementById('user-polygon-name').value = polygon.name;
    document.getElementById('user-polygon-description').value = polygon.description;

    // Initialize JSON textbox contents
    update_user_polygon_info()
}

function close_user_polygon_info_panel() {
    // Make panel invisible
    document.getElementById('polygon-user-info-panel').classList.remove('visible');

    // Blank the text fields
    document.getElementById('user-polygon-id').value = '';
    document.getElementById('user-polygon-name').value = '';
    document.getElementById('user-polygon-description').value = '';
    document.getElementById('user-polygon-json').value = '';
}

/**
 * Uses User Polygon Info Panel information to update target_polygon and JSON textarea
 */
function update_user_polygon_info() {
    // Update targeted polygon
    target_polygon.id = textbox_value_or_placeholder(document.getElementById('user-polygon-id'));
    target_polygon.name = textbox_value_or_placeholder(document.getElementById('user-polygon-name'));
    target_polygon.description = textbox_value_or_placeholder(document.getElementById('user-polygon-description'));

    // Convert data to JSON string and write it into the textbox
    document.getElementById('user-polygon-json').value = polygon_json_string(target_polygon);
}

/**
 * Remove one polygon from the current map state.
 *
 * @param {Object} polygon - The polygon object to remove.
 */
function discard_user_polygon(polygon) {
    // Find index of this polygon in the currently-pointed-to user_polygons array
    const idx = current_map_state.user_polygons.findIndex(p => (p.uuid === polygon.uuid));
    if (idx == -1) {
        // Not found - generate warning
        console.warn('Polygon not found in user_polygons');
    } else {
        // Found - remove it
        current_map_state.user_polygons.splice(idx, 1);
    }
}

function discard_action() {
    discard_user_polygon(target_polygon)
    close_user_polygon_info_panel()
    render_polygons()
}

/**
 * Acknowledge successful clipboard action by briefly replacing the copy icon with a checkmark icon.
 */
function animate_json_clipboard_success() {
    // Acknowledge action by changing icon from copy symbol to checkmark
    const img = document.getElementById('img-copy-icon');
    img.src = "assets/icon_check.svg";

    // Schedule change back to copy symbol after a slight delay
    const delay_ms = 800;
    setTimeout(() => { img.src = "assets/icon_copy.svg"; }, delay_ms);
}

/**
 * Copies polygon JSON output to the user's clipboard. Shows animated visual when
 * successful, or prints a console error on failure.
 */
async function copy_json_to_clipboard() {
    // Select all text in the "JSON Output" textbox and copy to clipboard
    const json_textbox = document.getElementById('user-polygon-json');
    
    // Use Clipboard API to attempt copy-to-clipboard
    try {
        await navigator.clipboard.writeText(json_textbox.value)
        animate_json_clipboard_success()
    } catch (err) {
        console.error("Copying to user clipboard failed: ", err)
    }
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
            // Mark Upper/Lower view buttons as inactive
            document.getElementById('upper-view-btn').classList.remove('active');
            document.getElementById('lower-view-btn').classList.remove('active');

            // Generate new MapState with this uploaded image
            current_map_state = new MapState("user", event.target.result)
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
    g = svg.append('g');  // group element inside SVG
    zoom = d3.zoom();

    // Set initial SVG size to initial window size
    svg.attr('width', window.innerWidth).attr('height', window.innerHeight);

    // Configure zoom behavior
    zoom.scaleExtent([0.5, 10]) // Min-max zoom levels
        .on('start', () => container.classed('grabbing', true))
        .on('zoom', (event) => g.attr('transform', event.transform))  // Apply transform to SVG group while panning
        .on('end',   () => container.classed('grabbing', false))

    // Apply zoom behavior to SVG element
    svg.call(zoom);

    // Close Info Panel when bare map is clicked
    svg.on('click', handle_click_normal);

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
    document.getElementById('finish-tracing-btn').addEventListener('click', complete_polygon);
    document.getElementById('cancel-tracing-btn').addEventListener('click', exit_tracing);
    //   Panel: Polygon Info (User-Generated)
    document.getElementById('json-copy-icon').addEventListener('click', copy_json_to_clipboard);
    document.getElementById('user-polygon-id').addEventListener('input', update_user_polygon_info);
    document.getElementById('user-polygon-name').addEventListener('input', update_user_polygon_info);
    document.getElementById('user-polygon-description').addEventListener('input', update_user_polygon_info);
    document.getElementById('discard-polygon-btn').addEventListener('click', discard_action);
    //   Modal: Splash
    document.getElementById('app-splash-modal').addEventListener('click', hide_splash_modal);
    
    //   Modal: Confirm Reset
    document.getElementById('confirm-reset-btn').addEventListener('click', perform_reset_view);
    document.getElementById('cancel-reset-btn').addEventListener('click', close_reset_confirmation_modal);
    //   Background workers
    document.getElementById('image-upload').addEventListener('change', handle_user_image_upload);
    //   Window resizes - keep SVG full-window
    window.addEventListener('resize', handle_window_resize);

    // Load sample image and features on initialization
    load_image(current_map_state);
}

// Wait for DOM to be fully loaded before initializing
// This ensures all elements are available when we try to access them
document.addEventListener('DOMContentLoaded', initialize);
