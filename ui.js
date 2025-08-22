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
        showStatsBtn: document.getElementById('show-stats-btn'),
        nextRoundBtn: document.getElementById('next-round-btn'),
        closeStatsBtn: document.getElementById('close-stats-btn'),
        continueToScoreboardBtn: document.getElementById('continue-to-scoreboard-btn'),
        scoreboardScreen: document.getElementById('scoreboard-screen'),
        showdownScreen: document.getElementById('showdown-screen'),
        debugArea: document.getElementById('debug-area'),
    };

    Elements.startGameBtn.addEventListener('click', () => App.startGame());
    Elements.showStatsBtn.addEventListener('click', () => App.displaySavedStats());
    Elements.nextRoundBtn.addEventListener('click', () => App.handleNextRound());
    Elements.sortButton.addEventListener('click', () => App.handleSort());
    Elements.meldButton.addEventListener('click', () => App.handleMeld());
    Elements.discardButton.addEventListener('click', () => App.handleDiscard());
    Elements.declareButton.addEventListener('click', () => App.handleDeclare());
    Elements.revealJokerButton.addEventListener('click', () => App.handleRevealJoker());
    Elements.continueToScoreboardBtn.addEventListener('click', () => App.handleContinueToScoreboard());
    Elements.closeStatsBtn.addEventListener('click', () => App.handleCloseStats());

    return Elements;
}

export function updateButtons(App) {
    if (!App.game) return;
    const { game, humanPlayer, Elements } = App;
    const isMyTurn = !game.players[game.current_player_index].isAi && !App.isAnimating;
    const totalCardsInHand = humanPlayer.hand.length;
    const selectionSize = humanPlayer.selectedIndices.length;

    if (App.pendingAiDeclaration) {
        Elements.sortButton.disabled = App.isAnimating;
        Elements.meldButton.disabled = selectionSize < 3 || App.isAnimating;
        Elements.discardButton.disabled = true;
        Elements.declareButton.disabled = App.isAnimating;
        Elements.declareButton.textContent = 'Show';
        Elements.revealJokerButton.disabled = true;
        return;
    }

    Elements.declareButton.textContent = 'Declare';

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

    if (App.game.wild_joker) {
        const jokerHeader = document.createElement('h4');
        jokerHeader.style.textAlign = 'center';
        jokerHeader.style.margin = '0 0 10px 0';
        jokerHeader.textContent = `Wild Joker for this Round: ${App.game.wild_joker.toString()}`;
        debugContent.appendChild(jokerHeader);
    }

    App.game.players.forEach((p, p_idx) => {
        if (p.isAi) {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'debug-player';

            const createCardText = (card) => {
                if (!card) return '';
                const colorClass = (card.suit === 'Hearts' || card.suit === 'Diamonds') ? 'card-text-red' : 'card-text-black';
                return `<span class="${colorClass}" style="font-weight:bold;">${card.toString()}</span>`;
            };
            
            const analysis = App.game.getHandAnalysis(p);
            const realPoints = analysis.realPoints;
            
            const rankMap = new Map(p.ranks_order.map((r, i) => [r, i]));
            const suitMap = new Map(p.suits_order.map((s, i) => [s, i]));
            analysis.deadwood.sort((a, b) => (suitMap.get(a.suit) - suitMap.get(b.suit)) || (rankMap.get(a.rank) - rankMap.get(b.rank)));

            const meldsHtml = analysis.melds.map(meld => `[${meld.map(createCardText).join(' ')}]`).join(' ');
            const deadwoodHtml = analysis.deadwood.map(createCardText).join(' ');
            
            const potentialScore = App.game._evaluateHandPotential([...p.hand, ...p.melds.flat()], p);
            
            let fullHandHtml = meldsHtml;
            if (deadwoodHtml) {
                fullHandHtml += (meldsHtml ? ' | ' : '') + deadwoodHtml;
            }

            // --- NEW: Display the Last Move ---
            const drawnText = p.lastDrawnCard ? createCardText(p.lastDrawnCard) : '--';
            const discardedText = p.lastDiscardedCard ? createCardText(p.lastDiscardedCard) : '--';
            const moveHtml = `<span style="font-size: 12px; color: #333;">(Drawn: ${drawnText} | Discarded: ${discardedText})</span>`;
            
            const jokerSeenStatus = p.hasSeenJoker ? 'Yes' : 'No';
            playerDiv.innerHTML = `<b>${p.name} :</b> ${fullHandHtml} <br> ${moveHtml}(Joker Seen: ${jokerSeenStatus}) (Real Points: ${realPoints} | AI Score: ${potentialScore})`;
            debugContent.appendChild(playerDiv);
        }
    });
}