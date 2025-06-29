import * as C from './config.js';

function drawCard(ctx, card, x, y, assets, width = C.CARD_WIDTH, height = C.CARD_HEIGHT) {
    if (!card) return;
    if (card.rank === 'JOKER') {
        if (assets.jokerImage.complete && assets.jokerImage.naturalHeight !== 0) {
            ctx.drawImage(assets.jokerImage, x, y, width, height);
        }
        return;
    }
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const sy = suits.indexOf(card.suit) * assets.cardOriginalHeight;
    const sx = ranks.indexOf(card.rank) * assets.cardOriginalWidth;

    if (sx === -1 || sy === -1 || !assets.cardOriginalWidth) {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, width, height);
        return;
    }
    ctx.drawImage(assets.cardSpritesheet, sx, sy, assets.cardOriginalWidth, assets.cardOriginalHeight, x, y, width, height);
}

// --- UPDATED drawCardBack function ---
// It now draws the loaded PNG image instead of a solid color.
function drawCardBack(ctx, x, y, App, width = C.CARD_WIDTH, height = C.CARD_HEIGHT) {
    const { assets } = App;
    if (assets && assets.cardBackImage && assets.cardBackImage.complete && assets.cardBackImage.naturalHeight !== 0) {
        ctx.drawImage(assets.cardBackImage, x, y, width, height);
    } else {
        // Fallback to the solid color if the image isn't loaded
        ctx.fillStyle = '#27408B';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(x, y, width, height);
    }
}

function drawUngroupButton(ctx, x, y) {
    ctx.fillStyle = '#D3D3D3';
    ctx.fillRect(x, y, C.UNGROUP_BTN_WIDTH, C.UNGROUP_BTN_HEIGHT);
    ctx.strokeStyle = 'black';
    ctx.strokeRect(x, y, C.UNGROUP_BTN_WIDTH, C.UNGROUP_BTN_HEIGHT);
    ctx.fillStyle = 'black';
    ctx.font = '24px Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛓️‍💥', x + C.UNGROUP_BTN_WIDTH / 2, y + C.UNGROUP_BTN_HEIGHT / 2 + 2);
    ctx.textBaseline = 'alphabetic';
}

function drawStatusText(App) {
    const { ctx, game, humanPlayer, assets, jokerFlipState } = App;
    
    // --- Joker and Status Text Moved ---
    const statusX = 10;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.font = '20px Tahoma';
    ctx.fillText(`Wild Joker:`, statusX, 20);

    // --- Joker Reveal Animation Logic (Corrected) ---
    let jokerDrawnByFlip = false;
    if (jokerFlipState.animating) {
        jokerDrawnByFlip = true;
        const JOKER_X = statusX + 30; // Use the new statusX
        const JOKER_Y = 30;
        let flipSpeed = 15;
        if (jokerFlipState.phase === 1) {
            jokerFlipState.currentWidth -= flipSpeed;
            if (jokerFlipState.currentWidth <= 0) {
                jokerFlipState.currentWidth = 0;
                jokerFlipState.phase = 2;
                humanPlayer.hasSeenJoker = true;
            }
            const xOffset = (C.CARD_WIDTH - jokerFlipState.currentWidth) / 2;
            drawCardBack(ctx, JOKER_X + xOffset, JOKER_Y, App, jokerFlipState.currentWidth);
        } else {
            jokerFlipState.currentWidth += flipSpeed;
            if (jokerFlipState.currentWidth >= C.CARD_WIDTH) {
                jokerFlipState.currentWidth = C.CARD_WIDTH;
                jokerFlipState.animating = false;
            }
            const xOffset = (C.CARD_WIDTH - jokerFlipState.currentWidth) / 2;
            drawCard(ctx, game.wild_joker, JOKER_X + xOffset, JOKER_Y, assets, jokerFlipState.currentWidth);
        }
    }
    
    if (!jokerDrawnByFlip && game.wild_joker) {
        if (game.settings.hiddenJoker && !humanPlayer.hasSeenJoker) {
            drawCardBack(ctx, statusX + 30, 30, App);
        } else {
            drawCard(ctx, game.wild_joker, statusX + 30, 30, assets);
        }
    }

    const currentPlayer = game.players[game.current_player_index];
    const statusText = currentPlayer.isAi ? `${currentPlayer.name}'s Turn` : `Your Turn: ${game.turn_state}`;
    ctx.font = '16px Tahoma';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(statusText, statusX, 150);

    let totalPoints = humanPlayer.hand.reduce((sum, card) => sum + card.getPoints(), 0);
    let runCount = 0;
    let pureRunCount = 0;
    humanPlayer.melds.forEach(meld => {
        if (game._validateRun(meld, humanPlayer)) {
            runCount++;
            if (game.isPureSequence(meld, humanPlayer)) {
                pureRunCount++;
            }
        }
    });
    const canMeldSets = runCount >= 2 && pureRunCount >= 1;
    humanPlayer.melds.forEach(meld => {
        const isRun = game._validateRun(meld, humanPlayer);
        const isSet = game._validateSet(meld, humanPlayer);
        if (!isRun && !(isSet && canMeldSets)) {
            totalPoints += meld.reduce((sum, card) => sum + card.getPoints(), 0);
        }
    });
    ctx.font = '16px Tahoma';
    ctx.fillStyle = 'white';
    ctx.fillText(`Hand Points: ${totalPoints}`, statusX, 170);

    if (game.message.text) {
        ctx.font = 'bold 24px Tahoma';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 153, 0.9)';
        ctx.fillRect(C.SCREEN_WIDTH / 2 - 250, 15, 500, 40);
        ctx.fillStyle = 'black';
        ctx.fillText(game.message.text, C.SCREEN_WIDTH / 2, 45);
    }
}

export function drawGame(App) {
    const { ctx, game, humanPlayer, assets } = App;
    ctx.clearRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
    ctx.fillStyle = '#005000';
    ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

    // --- Stock & Discard Piles MOVED to far left ---
    const stockPileRect = { x: 250, y: 40 };
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '18px Tahoma';
    ctx.fillText(`Stock (${game.stock_pile.length})`, stockPileRect.x + C.CARD_WIDTH / 2, stockPileRect.y - 15);
    if (game.stock_pile.length > 0) drawCardBack(ctx, stockPileRect.x, stockPileRect.y, App);

    const discardPileRect = { x: 350, y: 40 };
    ctx.fillText(`Discard (${game.discard_pile.length})`, discardPileRect.x + C.CARD_WIDTH / 2, discardPileRect.y - 15);
    if (game.discard_pile.length > 0) {
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        if (!new Set(App.animatedCards.map(a => a.card)).has(topCard)) {
            drawCard(ctx, topCard, discardPileRect.x, discardPileRect.y, assets);
        }
    }

    // --- Opponent hands displayed HORIZONTALLY ---
    game.players.forEach((player, p_idx) => {
        if (player.isAi) {
            const aiPlayerIndex = p_idx - 1;
            const startX = 480 + (aiPlayerIndex * (C.CARD_WIDTH * 0.7 + 50));
            const startY = 40;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.fillText(player.name, startX, startY - 10);
            // Always draw one representative card back for each opponent.
            drawCardBack(ctx, startX, startY, App, C.CARD_WIDTH * 0.7, C.CARD_HEIGHT * 0.7);
        }
    });

    // --- Player's Hand and Melds (no change) ---
    App.ungroupButtonRects.length = 0;
    const handAndMeldY = 200;
    let meldsTotalWidth = 0;
    if (humanPlayer.melds.length > 0) {
        humanPlayer.melds.forEach(meld => {
            meldsTotalWidth += (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP) + C.MELD_SPACING;
        });
    }
    const handTotalWidth = humanPlayer.hand.length * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
    const totalPlayAreaWidth = meldsTotalWidth + handTotalWidth;
    let playAreaStartX = (C.SCREEN_WIDTH - totalPlayAreaWidth) / 2;
    if (playAreaStartX < 0) playAreaStartX = C.CARD_MARGIN;

    let currentMeldX = playAreaStartX;
    humanPlayer.melds.forEach((meld, meldIndex) => {
        meld.forEach((card, cardIndex) => drawCard(ctx, card, currentMeldX + cardIndex * C.CARD_OVERLAP, handAndMeldY, assets));
        const meldWidth = (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP);
        const btnX = currentMeldX + (meldWidth / 2) - (C.UNGROUP_BTN_WIDTH / 2);
        const btnY = handAndMeldY - C.UNGROUP_BTN_HEIGHT - 5;
        drawUngroupButton(ctx, btnX, btnY);
        App.ungroupButtonRects.push({ x: btnX, y: btnY, width: C.UNGROUP_BTN_WIDTH, height: C.UNGROUP_BTN_HEIGHT, meldIndex });
        currentMeldX += meldWidth + C.MELD_SPACING;
    });

    const handStartX = playAreaStartX + meldsTotalWidth;
    humanPlayer.hand.forEach((card, index) => {
        if (!new Set(App.animatedCards.map(a => a.card)).has(card)) {
            const isSelected = humanPlayer.selectedIndices.includes(index);
            drawCard(ctx, card, handStartX + index * C.CARD_OVERLAP, isSelected ? handAndMeldY - 20 : handAndMeldY, assets);
        }
    });

    drawStatusText(App);

    for (let i = App.animatedCards.length - 1; i >= 0; i--) {
        const anim = App.animatedCards[i];
        if (anim.showBack) {
            drawCardBack(ctx, anim.x, anim.y, App);
        } else {
            drawCard(ctx, anim.card, anim.x, anim.y, assets);
        }
        if (anim.update()) {
            if (anim.onComplete) anim.onComplete();
            App.animatedCards.splice(i, 1);
        }
    }
}