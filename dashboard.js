// dashboard.js - renders statistics dashboard with simple pie charts

document.addEventListener('DOMContentLoaded', () => {
    const stats = calculateStats();
    updateScorecards(stats);
    drawCharts(stats);
});

function calculateStats() {
    let gamesPlayed = 0,
        roundsPlayed = 0,
        gamesWon = 0,
        roundsWon = 0;

    const rawHistory = localStorage.getItem('rummyGameHistory');
    if (rawHistory) {
        try {
            const history = JSON.parse(rawHistory);
            history.forEach(game => {
                gamesPlayed += 1;
                roundsPlayed += game.round || 0;
                const wins = Array.isArray(game.wins) ? (game.wins[0] || 0) : 0;
                roundsWon += wins;
                if (Array.isArray(game.scores)) {
                    const lowest = Math.min(...game.scores);
                    if (game.scores[0] === lowest) {
                        gamesWon += 1;
                    }
                }
            });
        } catch (e) {
            console.error('Failed to parse saved game history', e);
        }
    }

    const rawCurrent = localStorage.getItem('rummyScoreHistory');
    if (rawCurrent) {
        try {
            const data = JSON.parse(rawCurrent);
            gamesPlayed += 1; // current game in progress
            roundsPlayed += data.round || 0;
            if (Array.isArray(data.wins)) {
                roundsWon += data.wins[0] || 0;
            }
        } catch (e) {
            console.error('Failed to parse current game stats', e);
        }
    }

    const roundsLost = roundsPlayed - roundsWon;
    const gamesLost = gamesPlayed - gamesWon;
    return { gamesPlayed, roundsPlayed, gamesWon, gamesLost, roundsWon, roundsLost };
}

function updateScorecards(s) {
    document.getElementById('games-played').textContent = s.gamesPlayed;
    document.getElementById('games-won').textContent = s.gamesWon;
    document.getElementById('games-lost').textContent = s.gamesLost;
    document.getElementById('rounds-played').textContent = s.roundsPlayed;
    document.getElementById('rounds-won').textContent = s.roundsWon;
    document.getElementById('rounds-lost').textContent = s.roundsLost;
}

function drawCharts(stats) {
    drawPieChart('gameChart', 'gameChart-legend', ['Won', 'Lost'], [stats.gamesWon, stats.gamesLost], ['#4CAF50', '#F44336']);
    drawPieChart('roundChart', 'roundChart-legend', ['Won', 'Lost'], [stats.roundsWon, stats.roundsLost], ['#2196F3', '#FFC107']);
}

function drawPieChart(canvasId, legendId, labels, values, colors) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    const total = values.reduce((a, b) => a + b, 0);
    let startAngle = -Math.PI / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 10;

    for (let i = 0; i < values.length; i++) {
        const sliceAngle = total ? (2 * Math.PI * values[i]) / total : 0;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, canvas.height / 2);
        ctx.arc(canvas.width / 2, canvas.height / 2, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();

        const midAngle = startAngle + sliceAngle / 2;
        const labelX = canvas.width / 2 + Math.cos(midAngle) * (radius * 0.6);
        const labelY = canvas.height / 2 + Math.sin(midAngle) * (radius * 0.6);
        const percent = total ? Math.round((values[i] / total) * 100) : 0;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(percent + '%', labelX, labelY);

        startAngle += sliceAngle;
    }

    const legend = document.getElementById(legendId);
    legend.innerHTML = '';
    labels.forEach((label, i) => {
        const item = document.createElement('div');
        item.innerHTML = `<span style="background:${colors[i]};"></span>${label}`;
        legend.appendChild(item);
    });
}
