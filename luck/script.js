// =============================================================================
//                                 UTILS
// =============================================================================

/**
 * @pure
 * Generate a normally distributed random number using Box-Muller transform
 * with rejection sampling to ensure the value is within [0, 100]
 * @param {number} mean - The mean of the normal distribution (default: 50)
 * @param {number} stdDev - The standard deviation (default: 15)
 * @returns {number} A random value from the normal distribution within [0, 100]
 */
function normal_random(mean = 50, standard_deviation = 15) {
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

/**
 * @pure
 * Map a fractional number to an integer percentage value in string format,
 * i.e. 0 -> "0%" and 1 -> "100%".
 * @param {number} x - The value to be converted.
 * @returns {string} Integer percentage with percent symbol.
 */
function to_int_percentage(x) {
    return (100 * x).toFixed(0) + '%'
}

/**
 * @pure
 * Return a randomly-selected element from a given array.
 * @param {Array} array - An array from which to select a random element.
 * @returns A randomly-selected element from array. 
 */
function random_element(array) {
    return array[Math.floor(Math.random() * array.length)]
}

// Common color scheme
function green(alpha) { return `rgba(100, 255, 100, ${alpha})` }
function gray(alpha) { return `rgba(200, 200, 200, ${alpha})` }
function red(alpha) { return `rgba(255, 100, 100, ${alpha})` }

// =============================================================================
//                                APPLICANTS
// =============================================================================

class Applicant {
    constructor(id, merit, luck) {
        this.id = id
        this.name = random_name()
        this.merit = merit
        this.luck = luck
        this.score_overall = NaN
    }
}

class ScoredApplicant {
    constructor(applicant, score = NaN) {
        this.applicant = applicant
        this.score = score
    }
}

/**
 * Generate a random name in the format "First L."
 * @returns {string} A random name with first name and last initial
 */
function random_name() {
    const first_names = [
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
    ]
    const first_name = random_element(first_names)
    const last_initial = String.fromCharCode(65 + Math.floor(Math.random() * 26)) // A-Z
    return `${first_name} ${last_initial}.`
}

// =============================================================================
//                        APPLICANT POOL MANAGEMENT
// =============================================================================

// Generate applicants, then calculate stats and update UI
function new_applicant_pool() {
    const N = get_ui_number_applicants()
    const dist = get_ui_merit_stats()

    return Array.from({ length: N }, (_, i) => {
        const merit = Math.round(normal_random(dist.mean, dist.standard_deviation))
        const luck = Math.round(100 * Math.random())
        const applicant = new Applicant(i, merit, luck)
        return new ScoredApplicant(applicant, NaN)
    })
}

// Get weight average of trait scores
function overall_score(applicant) {
    const weights = get_ui_weight_balance()
    return (weights.merit * applicant.merit) + (weights.luck * applicant.luck)
}

// For all applicants: calculate/store overall score, sort all (descending)
function score_applicants(pool) {
    for (scored_applicant of pool) {
        scored_applicant.score = overall_score(scored_applicant.applicant)
    }
    pool.sort((a, b) => b.score - a.score);
}

function luck_thresholds_adaptive(pool) {
    const luck_scores = pool.map(scored_applicant => scored_applicant.applicant.luck).sort()
    const idx_third = Math.floor(luck_scores.length / 3)
    return {
        low: luck_scores[idx_third],
        high: luck_scores[2 * idx_third]
    }
}

function luck_thresholds_fixed(pool) {
    return {
        low: 33,
        high: 67
    }
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
function update_distribution_display() {
    const dist = get_ui_merit_stats()
    document.getElementById('valueMean').textContent = dist.mean
    document.getElementById('valueStdDev').textContent = dist.standard_deviation
}

// Attach listeners
document.getElementById('meritMean').addEventListener('input', update_distribution_display)
document.getElementById('meritStdDev').addEventListener('input', update_distribution_display)

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
    update_data_visualizations()
})

document.getElementById('numHired').addEventListener('input', update_data_visualizations)

// =============================================================================
//                              VISUALIZATIONS
// =============================================================================

// Update all visualizations
function update_data_visualizations() {
    score_applicants(applicant_pool)
    update_stat_cards()
    update_scatterplot()
    update_ranking_table()
}

// Statistics Cards: Total Applicants, Hired, Stats per Luck Level
function update_stat_cards() {
    const number_to_hire = get_ui_number_hired()
    const number_available = applicant_pool.length
    const numHired = Math.min(number_to_hire, number_available)

    // Update total applicants
    document.getElementById('statTotalApplicants').textContent = number_available
    document.getElementById('statHired').textContent = numHired

    // Count hired applicants by luck category
    let lowLuckHired = medLuckHired = highLuckHired = 0
    const thresholds = luck_thresholds_fixed(applicant_pool)
    applicant_pool.slice(0, numHired).forEach((scored_applicant) => {
        if (scored_applicant.applicant.luck <= thresholds.low) {
            lowLuckHired++
        } else if (thresholds.high <= scored_applicant.applicant.luck) {
            highLuckHired++
        } else {
            medLuckHired++
        }
    })

    // Update luck category stats
    const lowLuckPercent = numHired > 0 ? ((lowLuckHired / numHired) * 100).toFixed(1) : 0;
    const medLuckPercent = numHired > 0 ? ((medLuckHired / numHired) * 100).toFixed(1) : 0;
    const highLuckPercent = numHired > 0 ? ((highLuckHired / numHired) * 100).toFixed(1) : 0;
    document.getElementById('statLowLuck').textContent = `${lowLuckHired} (${lowLuckPercent}%)`;
    document.getElementById('statMedLuck').textContent = `${medLuckHired} (${medLuckPercent}%)`;
    document.getElementById('statHighLuck').textContent = `${highLuckHired} (${highLuckPercent}%)`;
}

function update_scatterplot() {
    const number_to_hire = get_ui_number_hired()
    const number_applicants = applicant_pool.length
    const numHired = Math.min(number_to_hire, number_applicants)
    const thresholds = luck_thresholds_fixed(applicant_pool)
    
    // Separate hired and non-hired applicants (include name in data)
    const hiredData = applicant_pool.slice(0, numHired).map(scored_applicant => ({
        x: scored_applicant.applicant.merit,
        y: scored_applicant.applicant.luck,
        name: scored_applicant.applicant.name
    }))
    const notHiredData = applicant_pool.slice(numHired).map(scored_applicant => ({
        x: scored_applicant.applicant.merit,
        y: scored_applicant.applicant.luck,
        name: scored_applicant.applicant.name
    }))
    
    // Calculate the cutoff score (lowest hired-applicant's score)
    const cutoffScore = (numHired > 0) ? applicant_pool[numHired - 1].score : 0;

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
            const lowLuckY = y.getPixelForValue(thresholds.low);
            ctx.fillStyle = 'rgba(255, 100, 100, 0.08)';
            ctx.fillRect(left, lowLuckY, right - left, bottom - lowLuckY);
            
            // Medium luck region (middle)
            const highLuckY = y.getPixelForValue(thresholds.high);
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
function update_ranking_table() {
    // Erase old table contents
    const tbody = document.getElementById('applicantsTable');
    tbody.innerHTML = '';
    
    // Determine cutoff scores
    const numHired = get_ui_number_hired()
    const thresholds = luck_thresholds_fixed(applicant_pool)

    // Iteratively build table rows
    applicant_pool.forEach((scored_applicant, index) => {
        // Append an empty new row to the table body
        const row = tbody.insertRow()
        
        // Calculate background color based on luck category
        let background_color
        if (scored_applicant.applicant.luck <= thresholds.low) {
            background_color = red(0.3)
        } else if (thresholds.high <= scored_applicant.applicant.luck) {
            background_color = green(0.3)
        } else {
            background_color = gray(0.3)
        }
        row.style.backgroundColor = background_color;

        // Use symbols to indicate hired or not
        const hired_indicator = (index < numHired) ? "✅" : "❌"
        
        // Build row from applicant data
        row.innerHTML = `
            <td class="rank">#${index + 1}</td>
            <td>${scored_applicant.applicant.name}</td>
            <td>${scored_applicant.applicant.merit}</td>
            <td>${scored_applicant.applicant.luck}</td>
            <td>${scored_applicant.score.toFixed(1)}</td>
            <td>${hired_indicator}</td>
        `
    })
}

// =============================================================================
//                                MAIN
// =============================================================================

function initialize() {
    applicant_pool = new_applicant_pool()
    update_weight_labels()
    update_data_visualizations()
}

let applicant_pool = []  // applicant data
let scatterChart = null  // scatter plot

initialize()
