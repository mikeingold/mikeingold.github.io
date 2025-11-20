// ========================================
//   Functions
// ========================================

/**
 * Convert an array of coordinate pairs into a single string.
 *
 * @param {Array<Array<number>>} coords - An array like `[[x1, y1], [x2, y2]]`.
 * @returns {string} A space‑separated list of "x,y" strings (e.g., `"x1,y1 x2,y2"`).
 */
function coordinate_string(coords) {
    // [ [x1, y1], [x2, y2] ] -> [ "x1,y1", "x2,y2" ] -> "x1,y1 x2,y2"
    return coords.map(c => c.join(',')).join(' ')
}

/**
 * Convert a polygon object to a compact JSON string.
 *
 * @param {Object} polygon - Polygon data with properties:
 *   `id`, `side`, `name`, `description`, and `coordinates`.
 * @returns {string} A pretty‑printed JSON string where the `coordinates`
 *   field is rendered as a single‑line array.
 */
function polygon_json_string(polygon) {
    // Generate a simplified version of the polygon with only the desired fields
    // using a placeholder for coordinates to prevent nested indentation.
    const simplified_polygon = {
        "id": polygon.id,
        "side": polygon.side,
        "name": polygon.name,
        "description": polygon.description,
        "coordinates": "COORDINATES"
    }

    // Convert to JSON string with 4-space indents
    const json_string = JSON.stringify(simplified_polygon, null, 4)

    // Replace the COORDINATES placeholder with a one-liner JSON string
    const coordinate_string = JSON.stringify(polygon.coordinates).replace(/,/g, ', ')
    return json_string.replace(/"COORDINATES"/, coordinate_string)
}

/**
 * For a textbox with a defined placeholder, if there is currently-entered text
 * then return that. Otherwise, return the placeholder.
 */
function textbox_value_or_placeholder(el) {
    return el.value || el.placeholder;
}

function get_polygon(id) {
    // Find index of this polygon
    const idx = current_map_state.polygons.findIndex(p => (p.id === id));
    if (idx == -1) {
        // Not found - generate warning
        console.warn('Polygon not found');
        return;
    } else {
        // Found - remove it
        return current_map_state.polygons[idx]
    }
}

function get_user_polygon(uuid) {
    // Find index of this polygon
    const idx = current_map_state.user_polygons.findIndex(p => (p.uuid === uuid));
    if (idx == -1) {
        // Not found - generate warning
        console.warn('Polygon not found');
        return;
    } else {
        // Found - remove it
        return current_map_state.user_polygons[idx]
    }
}

// ========================================
//   Types
// ========================================

class MapState {
    constructor(name, image_url, polygons = []) {
        this.name = name;
        this.image_url = image_url;
        this.polygons = polygons;
        this.user_polygons = [];
    }
}
