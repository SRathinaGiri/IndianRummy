// ui.js - Handles DOM events, button clicks, and screen updates
export function initializeUI(App) {
    const Elements = {
        sortButton: document.getElementById('sortButton'),
        meldButton: document.getElementById('meldButton'),
        discardButton: document.getElementById('discardButton'),
        declareButton: document.getElementById('declareButton'),
        revealJokerButton: document.getElementById('revealJokerButton'),
        settingsScreen: document.getElementById('settings-screen'),
        gameContainer: document.getElementById('game-container'),
        startGameBtn: document.getElementById('start-game-btn'),
        nextRoundBtn: document.getElementById('next-round-btn'),
        continueToScoreboardBtn: document.getElementById('continue-to-scoreboard-btn'),
        scoreboardScreen: document.getElementById('scoreboard-screen'),
        showdownScreen: document.getElementById('showdown-screen'),
        debugArea: document.getElementById('debug-area'),
    };

    Elements.startGameBtn.addEventListener('click', () => App.startGame());
    Elements.nextRoundBtn.addEventListener('click', () => App.handleNextRound());
    Elements.sortButton.addEventListener('click', () => App.handleSort());
    Elements.meldButton.addEventListener('click', () => App.handleMeld());
    Elements.discardButton.addEventListener('click', () => App.handleDiscard());
    Elements.declareButton.addEventListener('click', () => App.handleDeclare());
    Elements.revealJokerButton.addEventListener('click', () => App.handleRevealJoker());
    Elements.continueToScoreboardBtn.addEventListener('click', () => App.handleContinueToScoreboard());

    return Elements;
}

export function updateButtons(App) {
    if (!App.game) return;
    const { game, humanPlayer, Elements } = App;
    const isMyTurn = !game.players[game.current_player_index].isAi && !App.isAnimating;
    const totalCardsInHand = humanPlayer.hand.length;
    const selectionSize = humanPlayer.selectedIndices.length;

    Elements.sortButton.disabled = App.isAnimating;
    Elements.meldButton.disabled = !(isMyTurn && game.turn_state === 'ACTION' && selectionSize >= 3);
    Elements.discardButton.disabled = !(isMyTurn && game.turn_state === 'ACTION' && (totalCardsInHand + humanPlayer.melds.flat().length) === 14 && selectionSize === 1);
    Elements.declareButton.disabled = !(isMyTurn && game.turn_state === 'ACTION' && (totalCardsInHand + humanPlayer.melds.flat().length) === 14 && selectionSize === 1);
    
    Elements.revealJokerButton.style.display = game.settings.hiddenJoker ? 'inline-block' : 'none';
    if (isMyTurn && game.settings.hiddenJoker && !humanPlayer.hasSeenJoker) {
        humanPlayer.canRevealJoker = false;
        for (const meld of humanPlayer.melds) {
            if (game.isPureSequence(meld, 0)) {
                humanPlayer.canRevealJoker = true;
                break;
            }
        }
    }
    Elements.revealJokerButton.disabled = !(isMyTurn && game.turn_state === 'DRAW' && humanPlayer.canRevealJoker && !humanPlayer.hasSeenJoker);
}

export function updateDebugView(App) {
    if (!App.game || !App.game.settings.debugMode) return;
    
    const debugContent = document.getElementById('debug-content');
    debugContent.innerHTML = '';
    App.game.players.forEach((p, p_idx) => {
        if (p.isAi) {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'debug-player';
            
            const handHtml = p.hand.map(card => {
                const colorClass = (card.suit === 'Hearts' || card.suit === 'Diamonds') ? 'card-text-red' : 'card-text-black';
                return `<span class="${colorClass}" style="font-weight:bold;">${card.toString()}</span>`;
            }).join(' ');

            const evalResult = App.game._evaluateHandPotential(p.hand, p_idx);
            const potentialScore = evalResult.score;
            
            playerDiv.innerHTML = `<b>${p.name} (Potential Points: ${potentialScore}):</b> ${handHtml}`;
            debugContent.appendChild(playerDiv);
        }
    });
}