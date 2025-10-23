// =============================================================================
//                                GLOBAL STATE
// =============================================================================

let applicants = [];  // applicant data
let chart = null;  // histogram
let scatterChart = null;  // scatter plot

// =============================================================================
//                            APPLICANT GENERATION
// =============================================================================

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

/**
 * Generate a normally distributed random number using Box-Muller transform
 * with rejection sampling to ensure the value is within [0, 100]
 * @param {number} mean - The mean of the normal distribution (default: 50)
 * @param {number} stdDev - The standard deviation (default: 15)
 * @returns {number} A random value from the normal distribution within [0, 100]
 */
function normalRandom(mean = 50, stdDev = 15) {
    let value;
    // Rejection sampling: keep generating until we get a value in range
    do {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        value = mean + z * stdDev;
    } while (value < 0 || value > 100);
    
    return value;
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
 * Retrieve UI setting: Competence Statistics
 * @returns {number[]} The numbers currently entered in the UI elements:
 *   - [0] The desired normal distribution mean
 *   - [1] The desired normal distribution standard deviation
 */
function get_ui_competence_stats() {
    const ui_element_mean = document.getElementById('competenceMean')
    const ui_element_stddev = document.getElementById('competenceStdDev')
    return [parseInt(ui_element_mean.value), parseInt(ui_element_stddev.value)]
}

/**
 * Retrieve UI setting: Weight Balance
 * @returns {number[]} The weights currently selected in the UI.
 *   - [0] The desired competence weight
 *   - [1] The desired luck weight
 */
function get_ui_weight_balance() {
    const ui_element = document.getElementById('weightSlider')
    const weight_competence = parseInt(ui_element.value)
    const weight_luck = 100 - weight_competence
    return [weight_competence, weight_luck]
}

// =============================================================================
//                              UI EVENT HANDLING
// =============================================================================

// Applicant Pool > Competence Distribution > Update displayed numbers on right
function updateDistributionDisplay() {
    const [mean, stdDev] = get_ui_competence_stats()
    document.getElementById('valueMean').textContent = mean;
    document.getElementById('valueStdDev').textContent = stdDev;
}

// Scoring Weights > Weight Balance > Updated displayed numbers below slider
function updateWeights() {
    const [compWeight, luckWeight] = get_ui_weight_balance()
    document.getElementById('valueCompetence').textContent = compWeight + '%';
    document.getElementById('valueLuck').textContent = luckWeight + '%';
    
    if (applicants.length > 0) {
        calculateScores();
        updateVisualization();
    }
}

document.getElementById('weightSlider').addEventListener('input', updateWeights);
document.getElementById('competenceMean').addEventListener('input', updateDistributionDisplay);
document.getElementById('competenceStdDev').addEventListener('input', updateDistributionDisplay);
document.getElementById('numHired').addEventListener('input', () => {
    if (applicants.length > 0) {
        updateVisualization();
    }
});

// Generate applicants, then calculate stats and update UI
function generateApplicants() {
    const N = get_ui_number_applicants()
    const [mean, stdDev] = get_ui_competence_stats()
    
    applicants = [];
    for (let i = 0; i < N; i++) {
        applicants.push({
            id: i + 1,
            name: generateName(),
            competence: Math.round(normalRandom(mean, stdDev)),
            luck: Math.round(Math.random() * 100),
            score: 0
        });
    }
    
    calculateScores();
    updateVisualization();
}

function calculateScores() {
    const compWeight = parseInt(document.getElementById('weightSlider').value);
    const luckWeight = 100 - compWeight;
    
    applicants.forEach(app => {
        app.score = (app.competence * compWeight + app.luck * luckWeight) / 100;
    });
    
    applicants.sort((x, y) => y.score - x.score);
}

function updateVisualization() {
    updateStats();
    updateHistogram();
    updateScatterPlot();
    updateTable();
}

function updateStats() {
    const number_to_hire = get_ui_number_hired()
    const number_available = applicants.length
    const numHired = Math.min(number_to_hire, number_available);
    
    // Update total applicants
    document.getElementById('statTotalApplicants').textContent = applicants.length;
    document.getElementById('statHired').textContent = numHired;
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort((a, b) => a.luck - b.luck);
    const third = Math.floor(sortedByLuck.length / 3);
    
    const lowLuckThreshold = sortedByLuck[third].luck;
    const highLuckThreshold = sortedByLuck[third * 2].luck;
    
    // Count hired applicants by luck category
    const hiredApplicants = applicants.slice(0, numHired);
    let lowLuckHired = 0;
    let medLuckHired = 0;
    let highLuckHired = 0;
    
    hiredApplicants.forEach(app => {
        if (app.luck <= lowLuckThreshold) {
            lowLuckHired++;
        } else if (app.luck <= highLuckThreshold) {
            medLuckHired++;
        } else {
            highLuckHired++;
        }
    });
    
    const lowLuckPercent = numHired > 0 ? ((lowLuckHired / numHired) * 100).toFixed(1) : 0;
    const medLuckPercent = numHired > 0 ? ((medLuckHired / numHired) * 100).toFixed(1) : 0;
    const highLuckPercent = numHired > 0 ? ((highLuckHired / numHired) * 100).toFixed(1) : 0;
    
    // Update luck category stats
    document.getElementById('statLowLuck').textContent = `${lowLuckHired} (${lowLuckPercent}%)`;
    document.getElementById('statMedLuck').textContent = `${medLuckHired} (${medLuckPercent}%)`;
    document.getElementById('statHighLuck').textContent = `${highLuckHired} (${highLuckPercent}%)`;
}

function updateHistogram() {
    const scores = applicants.map(a => a.score);
    const bins = 10;
    const binSize = 10;
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort((a, b) => a.luck - b.luck);
    const third = Math.floor(sortedByLuck.length / 3);
    
    const lowLuckThreshold = sortedByLuck[third].luck;
    const highLuckThreshold = sortedByLuck[third * 2].luck;
    
    const histogramLow = new Array(bins).fill(0);
    const histogramMed = new Array(bins).fill(0);
    const histogramHigh = new Array(bins).fill(0);
    const labels = [];
    
    for (let i = 0; i < bins; i++) {
        const binStart = i * binSize;
        const binEnd = binStart + binSize;
        labels.push(`${binStart}`);
        
        applicants.forEach(app => {
            const score = app.score;
            if (score >= binStart && (i === bins - 1 ? score <= binEnd : score < binEnd)) {
                if (app.luck <= lowLuckThreshold) {
                    histogramLow[i]++;
                } else if (app.luck <= highLuckThreshold) {
                    histogramMed[i]++;
                } else {
                    histogramHigh[i]++;
                }
            }
        });
    }
    
    const ctx = document.getElementById('histogram').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Low Luck',
                    data: histogramLow,
                    backgroundColor: 'rgba(255, 100, 100, 0.7)',
                    borderColor: 'rgba(255, 100, 100, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Medium Luck',
                    data: histogramMed,
                    backgroundColor: 'rgba(200, 200, 200, 0.7)',
                    borderColor: 'rgba(200, 200, 200, 1)',
                    borderWidth: 1
                },
                {
                    label: 'High Luck',
                    data: histogramHigh,
                    backgroundColor: 'rgba(100, 255, 100, 0.7)',
                    borderColor: 'rgba(100, 255, 100, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: true,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Number of Applicants'
                    }
                },
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Score Range'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

function updateScatterPlot() {
    const numHired = Math.min(parseInt(document.getElementById('numHired').value), applicants.length);
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort((a, b) => a.luck - b.luck);
    const third = Math.floor(sortedByLuck.length / 3);
    
    const lowLuckThreshold = sortedByLuck[third].luck;
    const highLuckThreshold = sortedByLuck[third * 2].luck;
    
    // Separate hired and non-hired applicants (include name in data)
    const hiredData = applicants.slice(0, numHired).map(app => ({
        x: app.competence,
        y: app.luck,
        name: app.name
    }));
    
    const notHiredData = applicants.slice(numHired).map(app => ({
        x: app.competence,
        y: app.luck,
        name: app.name
    }));
    
    // Calculate the cutoff score (lowest hired applicant's score)
    const cutoffScore = numHired > 0 ? applicants[numHired - 1].score : 0;
    
    // Get weights
    const compWeight = parseInt(document.getElementById('weightSlider').value) / 100;
    const luckWeight = 1 - compWeight;
    
    // The cutoff line equation: compWeight * competence + luckWeight * luck = cutoffScore
    // Solving for luck: luck = (cutoffScore - compWeight * competence) / luckWeight
    // Extend the line beyond the plot boundaries
    const boundaryLine = [];
    if (luckWeight > 0.001) { // Avoid division by zero
        // Calculate luck values at the extreme competence values
        const luckAt0 = (cutoffScore - compWeight * 0) / luckWeight;
        const luckAt100 = (cutoffScore - compWeight * 100) / luckWeight;
        
        // Extend beyond visible range
        if (luckAt0 >= 0 && luckAt0 <= 100) {
            // Start from left edge
            boundaryLine.push({ x: 0, y: luckAt0 });
        } else if (luckAt0 > 100) {
            // Line starts above plot, find where it enters
            const compAtLuck100 = (cutoffScore - luckWeight * 100) / compWeight;
            boundaryLine.push({ x: compAtLuck100, y: 100 });
        } else {
            // Line starts below plot, find where it enters
            const compAtLuck0 = (cutoffScore - luckWeight * 0) / compWeight;
            boundaryLine.push({ x: compAtLuck0, y: 0 });
        }
        
        if (luckAt100 >= 0 && luckAt100 <= 100) {
            // End at right edge
            boundaryLine.push({ x: 100, y: luckAt100 });
        } else if (luckAt100 > 100) {
            // Line ends above plot, find where it exits
            const compAtLuck100 = (cutoffScore - luckWeight * 100) / compWeight;
            boundaryLine.push({ x: compAtLuck100, y: 100 });
        } else {
            // Line ends below plot, find where it exits
            const compAtLuck0 = (cutoffScore - luckWeight * 0) / compWeight;
            boundaryLine.push({ x: compAtLuck0, y: 0 });
        }
    } else {
        // If luck weight is essentially 0, vertical line at cutoff competence
        const cutoffComp = cutoffScore / compWeight;
        if (cutoffComp >= 0 && cutoffComp <= 100) {
            boundaryLine.push({ x: cutoffComp, y: 0 });
            boundaryLine.push({ x: cutoffComp, y: 100 });
        }
    }
    
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
            aspectRatio: 1,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Competence',
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
                                `Competence: ${point.x}`,
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

function updateTable() {
    const tbody = document.getElementById('applicantsTable');
    tbody.innerHTML = '';
    
    // Categorize applicants by luck into three equal groups
    const sortedByLuck = [...applicants].sort((a, b) => a.luck - b.luck);
    const third = Math.floor(sortedByLuck.length / 3);
    
    const lowLuckThreshold = sortedByLuck[third].luck;
    const highLuckThreshold = sortedByLuck[third * 2].luck;

    const numHired = get_ui_number_hired()
    
    applicants.forEach((app, index) => {
        const row = tbody.insertRow();
        
        // Calculate background color based on luck category
        let backgroundColor;
        if (app.luck <= lowLuckThreshold) {
            backgroundColor = 'rgba(255, 100, 100, 0.3)'; // Low luck - red
        } else if (app.luck <= highLuckThreshold) {
            backgroundColor = 'rgba(200, 200, 200, 0.3)'; // Medium luck - gray
        } else {
            backgroundColor = 'rgba(100, 255, 100, 0.3)'; // High luck - green
        }

        const hired_indicator = (index < numHired) ? "✅" : "❌"
        
        row.style.backgroundColor = backgroundColor;
        row.innerHTML = `
            <td class="rank">#${index + 1}</td>
            <td>${app.name}</td>
            <td>${app.competence}</td>
            <td>${app.luck}</td>
            <td>${app.score.toFixed(1)}</td>
            <td>${hired_indicator}</td>
        `;
    });
}

// Generate initial applicants
generateApplicants();