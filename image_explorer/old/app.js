// Configuration - Two modes with different images and areas
const modes = {
    upper: {
        image_url: 'assets/map_upper.png',
        image_width: 1123,
        image_height: 794,
        areas: [
            {
                name: 'NE555 Timer IC',
                description: 'The main 555 timer integrated circuit',
                coordinates: [[400, 250], [650, 250], [650, 550], [400, 550]],
                z_order: 1,
                details: {
                    component: 'NE555',
                    function: 'Astable Multivibrator',
                    pins: '8-pin DIP'
                }
            },
            {
                name: 'Timing Resistors',
                description: 'R1 and R2 resistors that set the frequency',
                coordinates: [[250, 150], [380, 150], [380, 350], [250, 350]],
                z_order: 2,
                details: {
                    r1: '1kΩ',
                    r2: '10kΩ',
                    function: 'Frequency control'
                }
            },
            {
                name: 'Timing Capacitor',
                description: 'Capacitor that sets the timing period',
                coordinates: [[250, 400], [380, 400], [380, 520], [250, 520]],
                z_order: 3,
                details: {
                    value: '10µF',
                    type: 'Electrolytic',
                    function: 'Timing period'
                }
            },
            {
                name: 'Output Load',
                description: 'LED and current limiting resistor',
                coordinates: [[680, 300], [850, 300], [850, 450], [680, 450]],
                z_order: 1,
                details: {
                    led: 'Red LED',
                    resistor: '330Ω',
                    current: '~15mA'
                }
            },
            {
                name: 'Power Supply',
                description: 'VCC connection and decoupling',
                coordinates: [[450, 100], [600, 100], [600, 220], [450, 220]],
                z_order: 2,
                details: {
                    voltage: '5-15V DC',
                    decoupling: '0.01µF',
                    pin: 'Pin 8 (VCC)'
                }
            }
        ]
    },
    lower: {
        image_url: 'assets/map_lower.png',
        image_width: 1123,
        image_height: 794,
        areas: [
            {
                name: 'Ground Connection',
                description: 'Circuit ground reference point',
                coordinates: [[400, 580], [650, 580], [650, 720], [400, 720]],
                z_order: 1,
                details: {
                    pin: 'Pin 1 (GND)',
                    connection: 'Common ground'
                }
            },
            {
                name: 'Discharge Pin',
                description: 'Capacitor discharge control',
                coordinates: [[200, 500], [350, 500], [350, 650], [200, 650]],
                z_order: 2,
                details: {
                    pin: 'Pin 7',
                    function: 'Discharge path'
                }
            }
        ]
    }
};

let current_mode = 'upper';
const get_current_config = () => modes[current_mode];

// State
const create_initial_state = () => ({
    width: 0,
    height: 0,
    transform: d3.zoomIdentity,
    rotation: 0,
    initial_touches: null,
    initial_rotation: 0,
    initial_distance: 0,
    initial_scale: 1
});

let state = create_initial_state();

// DOM elements
const container = document.getElementById('container');
const svg = d3.select('#circuit-viewer');
const tooltip = document.getElementById('tooltip');
const info_panel = document.getElementById('info-panel');

// Initialize dimensions
state.width = container.clientWidth;
state.height = container.clientHeight;
svg.attr('width', state.width).attr('height', state.height);

// Create main group
const g = svg.append('g');

// Image element (will be updated on mode switch)
let image_element = null;

// Transform functions
const get_rotation_center = () => {
    const config = get_current_config();
    return {
        x: config.image_width / 2,
        y: config.image_height / 2
    };
};

const apply_transform = () => {
    const center = get_rotation_center();
    g.attr('transform', 
        `${state.transform} rotate(${state.rotation}, ${center.x}, ${center.y})`
    );
};

// Zoom behavior (desktop only)
const zoom = d3.zoom()
    .scaleExtent([0.5, 10])
    .filter((event) => {
        return event.type !== 'touchstart' && 
                event.type !== 'touchmove' && 
                event.type !== 'touchend';
    })
    .on('zoom', (event) => {
        state.transform = event.transform;
        apply_transform();
    });

svg.call(zoom);

// Image setup
g.append('image')
    .attr('href', config.image_url)
    .attr('width', config.image_width)
    .attr('height', config.image_height);

// Tooltip functions
const show_tooltip = (area, event) => {
    tooltip.querySelector('.tooltip-title').textContent = area.name;
    tooltip.querySelector('.tooltip-description').textContent = area.description;
    tooltip.classList.add('visible');
    update_tooltip_position(event);
};

const update_tooltip_position = (event) => {
    const x = event.clientX + 15;
    const y = event.clientY + 15;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
};

const hide_tooltip = () => {
    tooltip.classList.remove('visible');
};

// Info panel functions
const format_label = (key) => {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
};

const create_info_section = (label, value) => {
    return `
        <div class="info-section">
            <div class="info-label">${format_label(label)}</div>
            <div class="info-value">${value}</div>
        </div>
    `;
};

const show_info_panel = (area) => {
    info_panel.querySelector('.info-title').textContent = area.name;
    
    let content = create_info_section('description', area.description);
    
    if (area.details) {
        Object.entries(area.details).forEach(([key, value]) => {
            content += create_info_section(key, value);
        });
    }
    
    info_panel.querySelector('.info-content').innerHTML = content;
    info_panel.classList.add('visible');
};

const close_info_panel = () => {
    info_panel.classList.remove('visible');
    d3.selectAll('.area-polygon').classed('selected', false);
};

// Area rendering - sort by z_order and render in order
const sorted_areas = [...config.areas].sort((a, b) => {
    const z_a = a.z_order ?? 0;
    const z_b = b.z_order ?? 0;
    return z_a - z_b;
});

const area_elements = [];

const create_area_polygon = (area, index) => {
    const points_string = area.coordinates
        .map(p => p.join(','))
        .join(' ');

    const polygon = g.append('g')
        .attr('class', 'areas')
        .append('polygon')
        .attr('class', 'area-polygon')
        .attr('points', points_string)
        .attr('data-index', index)
        .attr('data-z-order', area.z_order ?? 0)
        .on('mouseenter', function(event) {
            // Only highlight if this is the topmost polygon at this position
            const topmost = get_topmost_polygon_at_point(event);
            if (topmost === this) {
                show_tooltip(area, event);
                d3.select(this).classed('hovered', true);
            }
        })
        .on('mousemove', function(event) {
            const topmost = get_topmost_polygon_at_point(event);
            if (topmost === this) {
                update_tooltip_position(event);
            } else {
                hide_tooltip();
                d3.select(this).classed('hovered', false);
            }
        })
        .on('mouseleave', function() {
            hide_tooltip();
            d3.select(this).classed('hovered', false);
        })
        .on('click', function(event) {
            event.stopPropagation();
            const topmost = get_topmost_polygon_at_point(event);
            if (topmost === this) {
                show_info_panel(area);
                d3.selectAll('.area-polygon').classed('selected', false);
                d3.select(this).classed('selected', true);
            }
        });
    
    return polygon.node();
};

// Helper function to find topmost polygon at mouse position
const get_topmost_polygon_at_point = (event) => {
    const svg_node = svg.node();
    const pt = svg_node.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    
    // Get all polygons under the cursor
    const elements_at_point = [];
    area_elements.forEach(el => {
        if (el.isPointInFill && el.isPointInFill(pt)) {
            elements_at_point.push(el);
        }
    });
    
    // Return the one with highest z-order
    if (elements_at_point.length === 0) return null;
    
    return elements_at_point.reduce((top, current) => {
        const top_z = parseInt(top.getAttribute('data-z-order')) || 0;
        const current_z = parseInt(current.getAttribute('data-z-order')) || 0;
        return current_z > top_z ? current : top;
    });
};

sorted_areas.forEach((area, index) => {
    const polygon = create_area_polygon(area, index);
    area_elements.push(polygon);
});

// Touch gesture handling
const get_touch_distance = (touches) => {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

const get_touch_angle = (touches) => {
    return Math.atan2(
        touches[1].clientY - touches[0].clientY,
        touches[1].clientX - touches[0].clientX
    );
};

const handle_touch_start = (event) => {
    if (event.touches.length === 2) {
        event.preventDefault();
        event.stopPropagation();
        
        state.initial_touches = Array.from(event.touches).map(t => ({
            x: t.clientX,
            y: t.clientY
        }));
        
        state.initial_rotation = state.rotation;
        state.initial_distance = get_touch_distance(event.touches);
        state.initial_scale = state.transform.k;
    }
};

const handle_touch_move = (event) => {
    if (event.touches.length === 2 && state.initial_touches) {
        event.preventDefault();
        event.stopPropagation();
        
        // Calculate rotation
        const initial_angle = Math.atan2(
            state.initial_touches[1].y - state.initial_touches[0].y,
            state.initial_touches[1].x - state.initial_touches[0].x
        );
        
        const current_angle = get_touch_angle(event.touches);
        const angle_diff = (current_angle - initial_angle) * (180 / Math.PI);
        state.rotation = state.initial_rotation + angle_diff;
        
        // Calculate zoom
        const current_distance = get_touch_distance(event.touches);
        const scale_factor = current_distance / state.initial_distance;
        const new_scale = Math.max(0.5, Math.min(10, state.initial_scale * scale_factor));
        
        // Calculate center point for zoom
        const center_x = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const center_y = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        
        // Update transform
        const svg_node = svg.node();
        const rect = svg_node.getBoundingClientRect();
        const svg_x = center_x - rect.left;
        const svg_y = center_y - rect.top;
        
        // Apply scale change around touch center
        const scale_change = new_scale / state.transform.k;
        state.transform = state.transform.translate(
            (svg_x - state.transform.x) * (1 - scale_change) / state.transform.k,
            (svg_y - state.transform.y) * (1 - scale_change) / state.transform.k
        ).scale(scale_change);
        
        apply_transform();
    }
};

const handle_touch_end = (event) => {
    if (event.touches.length < 2) {
        state.initial_touches = null;
    }
};

// Attach touch listeners
const svg_node = svg.node();
svg_node.addEventListener('touchstart', handle_touch_start, { passive: false });
svg_node.addEventListener('touchmove', handle_touch_move, { passive: false });
svg_node.addEventListener('touchend', handle_touch_end, { passive: false });

// Control functions
const zoom_in = () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.5);
};

const zoom_out = () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.67);
};

const snap_to_45_degree_increment = (current_rotation, direction) => {
    const normalized = ((current_rotation % 360) + 360) % 360;
    const current_increment = normalized / 45;
    
    let next_increment;
    if (direction === 'left') {
        next_increment = Math.floor(current_increment);
        if (next_increment === current_increment) {
            next_increment -= 1;
        }
    } else {
        next_increment = Math.ceil(current_increment);
        if (next_increment === current_increment) {
            next_increment += 1;
        }
    }
    
    return next_increment * 45;
};

const rotate_left = () => {
    state.rotation = snap_to_45_degree_increment(state.rotation, 'left');
    g.transition().duration(300).tween('rotate', () => {
        return () => apply_transform();
    });
};

const rotate_right = () => {
    state.rotation = snap_to_45_degree_increment(state.rotation, 'right');
    g.transition().duration(300).tween('rotate', () => {
        return () => apply_transform();
    });
};

const reset_view = () => {
    state.rotation = 0;
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
};

const fit_image_to_view = () => {
    const scale = Math.min(
        state.width / config.image_width, 
        state.height / config.image_height
    ) * 0.9;
    
    const x = (state.width - config.image_width * scale) / 2;
    const y = (state.height - config.image_height * scale) / 2;
    
    const initial_transform = d3.zoomIdentity.translate(x, y).scale(scale);
    svg.call(zoom.transform, initial_transform);
};

// Event listeners
document.getElementById('zoom-in-btn').addEventListener('click', zoom_in);
document.getElementById('zoom-out-btn').addEventListener('click', zoom_out);
document.getElementById('rotate-left-btn').addEventListener('click', rotate_left);
document.getElementById('rotate-right-btn').addEventListener('click', rotate_right);
document.getElementById('reset-btn').addEventListener('click', reset_view);
document.getElementById('info-close-btn').addEventListener('click', close_info_panel);

svg.on('click', close_info_panel);

window.addEventListener('resize', () => {
    state.width = container.clientWidth;
    state.height = container.clientHeight;
    svg.attr('width', state.width).attr('height', state.height);
});

// Keyboard shortcuts
const handle_keydown = (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    const key_actions = {
        'q': rotate_left,
        'e': rotate_right,
        'r': reset_view,
        '+': zoom_in,
        '=': zoom_in,
        '-': zoom_out,
        '_': zoom_out
    };
    
    const action = key_actions[event.key.toLowerCase()];
    if (action) {
        action();
    }
};

document.addEventListener('keydown', handle_keydown);

// Initialize view
fit_image_to_view();
