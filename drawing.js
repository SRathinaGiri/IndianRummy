// drawing.js - All canvas rendering functions
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

function drawCardBack(ctx, x, y, width = C.CARD_WIDTH, height = C.CARD_HEIGHT) {
    ctx.fillStyle = '#27408B';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(x, y, width, height);
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
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.font = '20px Tahoma';
    ctx.fillText(`Wild Joker:`, 20, 40);

    let jokerDrawnByFlip = false;
    if (jokerFlipState.animating) {
        jokerDrawnByFlip = true;
        const JOKER_X = 140, JOKER_Y = 20;
        let flipSpeed = 15;
        if (jokerFlipState.phase === 1) {
            jokerFlipState.currentWidth -= flipSpeed;
            if (jokerFlipState.currentWidth <= 0) {
                jokerFlipState.currentWidth = 0;
                jokerFlipState.phase = 2;
                humanPlayer.hasSeenJoker = true;
            }
            const xOffset = (C.CARD_WIDTH - jokerFlipState.currentWidth) / 2;
            drawCardBack(ctx, JOKER_X + xOffset, JOKER_Y, jokerFlipState.currentWidth);
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
            drawCardBack(ctx, 140, 20);
        } else {
            drawCard(ctx, game.wild_joker, 140, 20, assets);
        }
    }

    const currentPlayer = game.players[game.current_player_index];
    const statusText = currentPlayer.isAi ? `${currentPlayer.name}'s Turn` : `Your Turn: ${game.turn_state}`;
    ctx.font = '22px Tahoma';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(statusText, 20, 175);

    let totalPoints = humanPlayer.hand.reduce((sum, card) => sum + card.getPoints(), 0);
    let runCount = 0;
    let pureRunCount = 0;
    humanPlayer.melds.forEach(meld => {
        if (game._validateRun(meld, 0)) {
            runCount++;
            if (game.isPureSequence(meld, 0)) pureRunCount++;
        }
    });
    const canMeldSets = runCount >= 2 && pureRunCount >= 1;
    humanPlayer.melds.forEach(meld => {
        const isRun = game._validateRun(meld, 0);
        const isSet = game._validateSet(meld, 0);
        if (!isRun && !(isSet && canMeldSets)) {
            totalPoints += meld.reduce((sum, card) => sum + card.getPoints(), 0);
        }
    });
    ctx.font = '20px Tahoma';
    ctx.fillStyle = 'white';
    ctx.fillText(`Hand Points: ${totalPoints}`, 20, 205);

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
    
    // Draw the game icon in the top-right corner
    if (assets.gameIcon.complete && assets.gameIcon.naturalHeight !== 0) {
        const iconWidth = assets.gameIcon.width * 0.5;
        const iconHeight = assets.gameIcon.height * 0.5;
        const iconX = C.SCREEN_WIDTH - iconWidth - 20; // 20px padding from the right
        const iconY = 20; // 20px padding from the top
        ctx.globalAlpha = 1.0; // Make the icon slightly transparent
        ctx.drawImage(assets.gameIcon, iconX, iconY, iconWidth, iconHeight);
        ctx.globalAlpha = 1.0; // Reset alpha for other elements
    }
    
    const animatingCardSet = new Set(App.animatedCards.map(a => a.card));
    
    ctx.font = '18px Tahoma';
    ctx.textAlign = 'center';
    
    const stockPileRect = { x: C.SCREEN_WIDTH / 2 - C.CARD_WIDTH - 30, y: C.SCREEN_HEIGHT / 2 - C.CARD_HEIGHT / 2 - 20 };
    ctx.fillStyle = 'white';
    ctx.fillText(`Stock (${game.stock_pile.length})`, stockPileRect.x + C.CARD_WIDTH / 2, stockPileRect.y - 15);
    if (game.stock_pile.length > 0) drawCardBack(ctx, stockPileRect.x, stockPileRect.y);
    
    const discardPileRect = { x: C.SCREEN_WIDTH / 2 + 30, y: C.SCREEN_HEIGHT / 2 - C.CARD_HEIGHT / 2 - 20 };
    ctx.fillStyle = 'white';
    ctx.fillText(`Discard (${game.discard_pile.length})`, discardPileRect.x + C.CARD_WIDTH / 2, discardPileRect.y - 15);

    // This is the fix for the discard animation glitch
    if (game.discard_pile.length > 0) {
        const topCard = game.discard_pile[game.discard_pile.length - 1];
        if (!animatingCardSet.has(topCard)) drawCard(ctx, topCard, discardPileRect.x, discardPileRect.y, assets);
    }
    
    App.ungroupButtonRects.length = 0;
    const meldY = C.SCREEN_HEIGHT - (C.CARD_HEIGHT * 2) - (C.CARD_MARGIN * 3);
    let currentMeldX = C.CARD_MARGIN * 2;
    humanPlayer.melds.forEach((meld, meldIndex) => {
        meld.forEach((card, cardIndex) => drawCard(ctx, card, currentMeldX + cardIndex * C.CARD_OVERLAP, meldY, assets));
        const meldWidth = (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP);
        const btnX = currentMeldX + (meldWidth / 2) - (C.UNGROUP_BTN_WIDTH / 2);
        const btnY = meldY - C.UNGROUP_BTN_HEIGHT - 5;
        drawUngroupButton(ctx, btnX, btnY);
        App.ungroupButtonRects.push({ x: btnX, y: btnY, width: C.UNGROUP_BTN_WIDTH, height: C.UNGROUP_BTN_HEIGHT, meldIndex });
        currentMeldX += meldWidth + C.MELD_SPACING;
    });

    const handY = C.SCREEN_HEIGHT - C.CARD_HEIGHT - C.CARD_MARGIN;
    const handTotalWidth = humanPlayer.hand.length * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
    const handStartX = (C.SCREEN_WIDTH - handTotalWidth) / 2;
    humanPlayer.hand.forEach((card, index) => {
        if (animatingCardSet.has(card)) return;
        const isSelected = humanPlayer.selectedIndices.includes(index);
        drawCard(ctx, card, handStartX + index * C.CARD_OVERLAP, isSelected ? handY - 20 : handY, assets);
    });

    drawStatusText(App);

    for (let i = App.animatedCards.length - 1; i >= 0; i--) {
        const anim = App.animatedCards[i];
        if (anim.showBack) drawCardBack(ctx, anim.x, anim.y);
        else drawCard(ctx, anim.card, anim.x, anim.y, assets);
        if (anim.update()) {
            if (anim.onComplete) anim.onComplete();
            App.animatedCards.splice(i, 1);
        }
    }
}