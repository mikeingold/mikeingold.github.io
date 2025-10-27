// =============================================================================
//                                 UTILS
// =============================================================================

/**
 * Generate a normally distributed random number using Box-Muller transform
 * with rejection sampling to ensure the value is within [0, 100]
 * @param {number} mean - The mean of the normal distribution (default: 50)
 * @param {number} stdDev - The standard deviation (default: 15)
 * @returns {number} A random value from the normal distribution within [0, 100]
 */
function normalRandom(mean = 50, standard_deviation = 15) {
    let value;
    // Rejection sampling: keep generating until we get a value in range
    do {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        value = mean + z * standard_deviation;
    } while (value < 0 || value > 100);
    
    return value;
}

function sort_luck_ascending(a, b) {
    return (a.score_luck - b.score_luck)
}

function sort_overall_score_descending(a, b) {
    return (b.score_overall - a.score_overall)
}

function to_int_percentage(x) {
    return (100 * x).toFixed(0) + '%'
}

// =============================================================================
//                                GLOBAL STATE
// =============================================================================

let applicants = [];  // applicant data
let scatterChart = null;  // scatter plot

const GREEN = 'rgba(100, 255, 100, 1)'
const GRAY  = 'rgba(200, 200, 200, 1)'
const RED   = 'rgba(255, 100, 100, 1)'

// =============================================================================
//                            APPLICANT GENERATION
// =============================================================================

class Applicant {
    constructor(id, name, score_merit, score_luck) {
        this.id = id
        this.name = name
        this.score_merit = score_merit
        this.score_luck = score_luck
        this.score_overall = NaN
    }
}

/** Array of common first names for generating random applicant names */
const firstNames = [
    'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn',
    'Sam', 'Charlie', 'Jamie', 'Drew', 'Blake', 'Reese', 'Parker', 'Skylar',
    'Cameron', 'Peyton', 'Rowan', 'Sage', 'Dakota', 'Finley', 'River', 'Kai',
    'Emerson', 'Hayden', 'Phoenix', 'Micah', 'Jesse', 'Angel', 'Ari', 'Jules',
    'Noah', 'Emma', 'Liam', 'Olivia', 'Lucas', 'Ava', 'Mason', 'Sophia',
    'Ethan', 'Isabella', 'Logan', 'Mia', 'Oliver', 'Amelia', 'Aiden', 'Harper',
    'Elijah', 'Evelyn', 'James', 'Abigail', 'Benjamin', 'Emily', 'Jacob', 'Ella',
    'Michael', 'Grace', 'Daniel', 'Chloe', 'Henry', 'Victoria', 'Jackson', 'Madison',
    'Sebastian', 'Luna', 'David', 'Layla', 'Carter', 'Zoe', 'Wyatt', 'Penelope',
    'Jayden', 'Lily', 'John', 'Eleanor', 'Owen', 'Hannah', 'Dylan', 'Lillian'
];

/**
 * Generate a random name in the format "First L."
 * @returns {string} A random name with first name and last initial
 */
function generateName() {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastInitial = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    return `${firstName} ${lastInitial}.`;
}

// =============================================================================
//                        APPLICANT POOL MANAGEMENT
// =============================================================================

// Generate applicants, then calculate stats and update UI
function generateApplicants() {
    const N = get_ui_number_applicants()
    const dist = get_ui_merit_stats()
    
    applicants = [];
    for (let i = 0; i < N; i++) {
        const id = i + 1
        const name = generateName()
        const merit = Math.round(normalRandom(dist.mean, dist.standard_deviation))
        const luck = Math.round(Math.random() * 100)
        app = new Applicant(id, name, merit, luck)
        applicants.push(app);
    }
}

// Get weight average of trait scores
function get_overall_score(app) {
    const weights = get_ui_weight_balance()
    return (weights.merit * app.score_merit) + (weights.luck * app.score_luck)
}

// For all applicants: calculate/store overall score, sort all (descending)
function calculate_overall_scores() {
    for (app of applicants) { app.score_overall = get_overall_score(app) }
    applicants.sort(sort_overall_score_descending);
}

// =============================================================================
//                            UI SETTINGS RETRIEVAL
// =============================================================================

/**
 * Retrieve UI setting: Number of Applicants
 * @returns {number} The number currently entered in the UI element.
 */
function get_ui_number_applicants() {
    const ui_element = document.getElementById('numApplicants')
    return parseInt(ui_element.value)
}

/**
 * Retrieve UI setting: Number to Hire
 * @returns {number} The number currently entered in the UI element.
 */
function get_ui_number_hired() {
    const ui_element = document.getElementById('numHired')
    return parseInt(ui_element.value)
}

/**
 * Retrieve UI setting: Merit Statistics (normal distribution)
 * @returns {{mean: number, standard_deviation: number}} Object containing the
 *          numbers currently entered in the UI elements
 */
function get_ui_merit_stats() {
    const mean = document.getElementById('meritMean')
    const standard_deviation = document.getElementById('meritStdDev')
    return {
        mean: parseInt(mean.value),
        standard_deviation: parseInt(standard_deviation.value)
    }
}

/**
 * Retrieve UI setting: Weight Balance
 * @returns {{merit: number, luck: number}} The weights currently selected
 *          in the UI.
 */
function get_ui_weight_balance() {
    const ui_element = document.getElementById('weightSlider')
    const weight_merit = parseInt(ui_element.value) / 100
    return {
        merit: weight_merit,
        luck: (1 - weight_merit)
    }
}

// =============================================================================
//                          UI - APPLICANT POOL
// =============================================================================

// Applicant Pool > Merit Distribution > Update displayed numbers on right
function updateDistributionDisplay() {
    const dist = get_ui_merit_stats()
    document.getElementById('valueMean').textContent = dist.mean;
    document.getElementById('valueStdDev').textContent = dist.standard_deviation;
}

// Attach listeners
document.getElementById('meritMean').addEventListener('input', updateDistributionDisplay);
document.getElementById('meritStdDev').addEventListener('input', updateDistributionDisplay);

// Trigger: generate new applicant pool and update visualizations
function new_applicant_pool() {
    generateApplicants()
    updateVisualization()
}

// =============================================================================
//                          UI - HIRING CRITERIA
// =============================================================================



// Scoring Weights > Weight Balance > Updated displayed numbers below slider
function update_weight_labels() {
    const weights = get_ui_weight_balance()
    document.getElementById('valueMerit').textContent = to_int_percentage(weights.merit)
    document.getElementById('valueLuck').textContent = to_int_percentage(weights.luck)
}

// Attach listener: update visualizations based on new weight
document.getElementById('weightSlider').addEventListener('input', () => {
    update_weight_labels()
    updateVisualization()
});

document.getElementById('numHired').addEventListener('input', updateVisualization);

// =============================================================================
//                              VISUALIZATIONS
// =============================================================================

// Update all visualizations
function updateVisualization() {
    calculate_overall_scores()
    updateStats()
    updateScatterPlot()
    updateTable()
}

// Statistics Cards: Total Applicants, Hired, Stats per Luck Level
function updateStats() {
    const number_to_hire = get_ui_number_hired()
    const number_available = applicants.length
    const numHired = Math.min(number_to_hire, number_available);
    
    // Update total applicants
    document.getElementById('statTotalApplicants').textContent = applicants.length;
    document.getElementById('statHired').textContent = numHired;
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort(sort_luck_ascending);
    const third = Math.floor(sortedByLuck.length / 3);
    
    const lowLuckThreshold = sortedByLuck[third].score_luck;
    const highLuckThreshold = sortedByLuck[third * 2].score_luck;
    
    // Count hired applicants by luck category
    let lowLuckHired = medLuckHired = highLuckHired = 0;
    applicants.slice(0, numHired).forEach(app => {
        if (app.score_luck <= lowLuckThreshold) {
            lowLuckHired++
        } else if (app.score_luck > highLuckThreshold) {
            highLuckHired++
        } else {
            medLuckHired++
        }
    });

    // Update luck category stats
    const lowLuckPercent = numHired > 0 ? ((lowLuckHired / numHired) * 100).toFixed(1) : 0;
    const medLuckPercent = numHired > 0 ? ((medLuckHired / numHired) * 100).toFixed(1) : 0;
    const highLuckPercent = numHired > 0 ? ((highLuckHired / numHired) * 100).toFixed(1) : 0;
    document.getElementById('statLowLuck').textContent = `${lowLuckHired} (${lowLuckPercent}%)`;
    document.getElementById('statMedLuck').textContent = `${medLuckHired} (${medLuckPercent}%)`;
    document.getElementById('statHighLuck').textContent = `${highLuckHired} (${highLuckPercent}%)`;
}

function updateScatterPlot() {
    const number_to_hire = get_ui_number_hired()
    const number_applicants = applicants.length
    const numHired = Math.min(number_to_hire, number_applicants);
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort(sort_luck_ascending);
    const third = Math.floor(sortedByLuck.length / 3);
    
    const lowLuckThreshold = sortedByLuck[third].score_luck;
    const highLuckThreshold = sortedByLuck[third * 2].score_luck;
    
    // Separate hired and non-hired applicants (include name in data)
    const hiredData = applicants.slice(0, numHired).map(app => ({
        x: app.score_merit,
        y: app.score_luck,
        name: app.name
    }));
    const notHiredData = applicants.slice(numHired).map(app => ({
        x: app.score_merit,
        y: app.score_luck,
        name: app.name
    }));
    
    // Calculate the cutoff score (lowest hired-applicant's score)
    const cutoffScore = (numHired > 0) ? applicants[numHired - 1].score_overall : 0;
    console.log(`cutoffScore = ${cutoffScore}`)

    // Get weights
    const weights = get_ui_weight_balance()
    
    // The cutoff line equation: compWeight * merit + luckWeight * luck = cutoffScore
    // Solving for luck: luck = (cutoffScore - compWeight * merit) / luckWeight
    // Extend the line beyond the plot boundaries
    const boundaryLine = [];
    if (weights.luck > 0.001) {
        // Avoid division by zero
        // Calculate luck values at the extreme merit values
        const luckAt0 = (cutoffScore - weights.merit * 0) / weights.luck;
        const luckAt100 = (cutoffScore - weights.merit * 100) / weights.luck;

        // Extend beyond visible range
        if ((0 <= luckAt0) && (luckAt0 <= 100)) {
            // Start from left edge
            boundaryLine.push({ x: 0, y: luckAt0 });
        } else if (100 < luckAt0) {
            // Line starts above plot, find where it enters
            const compAtLuck100 = (cutoffScore - weights.luck * 100) / weights.merit;
            boundaryLine.push({ x: compAtLuck100, y: 100 });
        } else {
            // Line starts below plot, find where it enters
            const compAtLuck0 = (cutoffScore - weights.luck * 0) / weights.merit;
            boundaryLine.push({ x: compAtLuck0, y: 0 });
        }
        
        if ((0 <= luckAt100) && (luckAt100 <= 100)) {
            // End at right edge
            boundaryLine.push({ x: 100, y: luckAt100 });
        } else if (100 < luckAt100) {
            // Line ends above plot, find where it exits
            const compAtLuck100 = (cutoffScore - weights.luck * 100) / weights.merit;
            boundaryLine.push({ x: compAtLuck100, y: 100 });
        } else {
            // Line ends below plot, find where it exits
            const compAtLuck0 = (cutoffScore - weights.luck * 0) / weights.merit;
            boundaryLine.push({ x: compAtLuck0, y: 0 });
        }
    } else {
        // Vertical line when luck weight is zero
        const cutoffComp = cutoffScore / weights.merit;
        if (cutoffComp >= 0 && cutoffComp <= 100) {
            boundaryLine.push({ x: cutoffComp, y: 0 });
            boundaryLine.push({ x: cutoffComp, y: 100 });
        }
    }

    for (pt of boundaryLine) { console.log(pt) }
    
    // Locate scatter plot element, erase existing data
    const ctx = document.getElementById('scatterPlot').getContext('2d');
    if (scatterChart) {
        scatterChart.destroy();
    }
    
    // Plugin to draw background regions
    const backgroundRegionsPlugin = {
        id: 'backgroundRegions',
        beforeDatasetsDraw: (chart) => {
            const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
            
            ctx.save();
            
            // Low luck region (bottom)
            const lowLuckY = y.getPixelForValue(lowLuckThreshold);
            ctx.fillStyle = 'rgba(255, 100, 100, 0.08)';
            ctx.fillRect(left, lowLuckY, right - left, bottom - lowLuckY);
            
            // Medium luck region (middle)
            const highLuckY = y.getPixelForValue(highLuckThreshold);
            ctx.fillStyle = 'rgba(200, 200, 200, 0.08)';
            ctx.fillRect(left, highLuckY, right - left, lowLuckY - highLuckY);
            
            // High luck region (top)
            ctx.fillStyle = 'rgba(100, 255, 100, 0.08)';
            ctx.fillRect(left, top, right - left, highLuckY - top);
            
            ctx.restore();
        }
    };
    
    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Hired',
                    data: hiredData,
                    backgroundColor: 'rgba(52, 152, 219, 0.8)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1,
                    pointRadius: 5,
                    pointHoverRadius: 7
                },
                {
                    label: 'Not Hired',
                    data: notHiredData,
                    backgroundColor: 'rgba(50, 50, 50, 0.6)',
                    borderColor: 'rgba(50, 50, 50, 1)',
                    borderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Hiring Cutoff',
                    data: boundaryLine,
                    type: 'line',
                    borderColor: 'rgba(231, 76, 60, 0.8)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    showLine: true,
                    hidden: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,    // x and y axes have equal scale
            animation: false,  // No softening transition between updates
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Merit',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    min: 0,
                    max: 100
                },
                y: {
                    title: {
                        display: true,
                        text: 'Luck',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        filter: function(legendItem) {
                            return legendItem.text !== 'Hiring Cutoff';
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Hiring Cutoff') {
                                return `Cutoff boundary`;
                            }
                            const point = context.raw;
                            return [
                                point.name,
                                `Merit: ${point.x}`,
                                `Luck: ${point.y}`
                            ];
                        }
                    }
                }
            }
        },
        plugins: [backgroundRegionsPlugin]
    });
}

// Update Applicant Rankings table
function updateTable() {
    // Erase old table contents
    const tbody = document.getElementById('applicantsTable');
    tbody.innerHTML = '';
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort(sort_luck_ascending);
    const third = Math.floor(sortedByLuck.length / 3);
    const lowLuckThreshold = sortedByLuck[third].score_luck;
    const highLuckThreshold = sortedByLuck[2 * third].score_luck;

    // Determine hiring cutoff
    const numHired = get_ui_number_hired()
    
    applicants.forEach((app, index) => {
        const row = tbody.insertRow();
        
        // Calculate background color based on luck category
        let backgroundColor;
        if (app.score_luck <= lowLuckThreshold) {
            backgroundColor = 'rgba(255, 100, 100, 0.3)'; // Low luck - red
        } else if (app.score_luck <= highLuckThreshold) {
            backgroundColor = 'rgba(200, 200, 200, 0.3)'; // Medium luck - gray
        } else {
            backgroundColor = 'rgba(100, 255, 100, 0.3)'; // High luck - green
        }

        const hired_indicator = (index < numHired) ? "✅" : "❌"
        
        row.style.backgroundColor = backgroundColor;
        row.innerHTML = `
            <td class="rank">#${index + 1}</td>
            <td>${app.name}</td>
            <td>${app.score_merit}</td>
            <td>${app.score_luck}</td>
            <td>${app.score_overall.toFixed(1)}</td>
            <td>${hired_indicator}</td>
        `;
    });
}

// Generate initial applicants
generateApplicants();
updateVisualization()
