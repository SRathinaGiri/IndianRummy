import * as C from './config.js';
import * as Drawing from './drawing-v2.js';
import * as UI from './ui.js';
import { RummyGameLogic, Player } from './rummy-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const App = {
        // --- Game State & Core Properties ---
        game: null,
        humanPlayer: null,
        isAnimating: false,
        isDiscarding: false,
        animatedCards: [],
        ungroupButtonRects: [],
        pickedFromDiscardThisTurn: null,
        declarationResult: null,
        nextAction: null,
        messageTimer: null,
        jokerFlipState: { animating: false, phase: 1, currentWidth: 0 },
        fastMode: false,

        // --- DOM Elements & Context ---
        canvas: document.getElementById('gameCanvas'),
        ctx: null,
        Elements: {},

        // --- Asset Management ---
        assets: {
            cardSpritesheet: new Image(),
            jokerImage: new Image(),
            gameIcon: new Image(),
            cardBackImage: new Image(),
            cardOriginalWidth: 0,
            cardOriginalHeight: 0,
            sounds: {}
        },
        
        // --- Initialization ---
        init() {
            this.canvas.width = C.SCREEN_WIDTH;
            this.canvas.height = C.SCREEN_HEIGHT;
            this.ctx = this.canvas.getContext('2d');
            this.loadAssets();
            this.Elements = UI.initializeUI(this);
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            
            // --- SERVICE WORKER RE-ENABLED ---
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js').then(reg => {
                        console.log('ServiceWorker registration successful.', reg);
                    }, err => {
                        console.log('ServiceWorker registration failed: ', err);
                    });
                });
            }
        },

        loadAssets() {
            this.assets.cardSpritesheet.src = 'cards.png';
            this.assets.jokerImage.src = 'joker.png';
            this.assets.gameIcon.src = 'icon-512x512.png';
            this.assets.cardBackImage.src = 'card-back.png';
            this.assets.cardSpritesheet.onload = () => {
                this.assets.cardOriginalWidth = this.assets.cardSpritesheet.width / 13;
                this.assets.cardOriginalHeight = this.assets.cardSpritesheet.height / 4;
            };
            const soundIds = ['shuffle', 'draw', 'discard', 'meld', 'declare', 'win', 'error', 'click'];
            soundIds.forEach(id => {
                this.assets.sounds[id] = document.getElementById(`audio-${id}`);
            });
        },

        playSound(name) {
            if (this.fastMode) return;
            const sound = this.assets.sounds[name];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => console.error(`Audio Error`, e));
            }
        },

        // --- Game Loop ---
        gameLoop() {
            if (!this.game) return;
            Drawing.drawGame(this);
            UI.updateButtons(this);
            UI.updateDebugView(this);
            if (this.animatedCards.length === 0 && this.isAnimating) {
                this.isAnimating = false;
                if (this.nextAction) {
                    this.nextAction();
                    this.nextAction = null;
                }
            }
            requestAnimationFrame(() => this.gameLoop());
        },

        // --- Main Game Flow & Actions ---
        
        startGame() {
            if (!this.assets.cardSpritesheet.complete || this.assets.cardSpritesheet.naturalHeight === 0) {
                alert("Card images have not finished loading yet. Please wait a moment.");
                return;
            }

            const settings = {
                numPlayers: document.getElementById('num-players').value,
                numRounds: document.getElementById('num-rounds').value,
                hiddenJoker: document.getElementById('hidden-joker').checked,
                debugMode: document.getElementById('debug-mode').checked,
                fastMode: document.getElementById('fast-mode').checked
            };
            this.fastMode = settings.fastMode;
            this.playSound('shuffle');

            this.Elements.settingsScreen.style.display = 'none';
            this.Elements.scoreboardScreen.style.display = 'none';
            this.Elements.showdownScreen.style.display = 'none';
            this.Elements.gameContainer.style.display = 'block';
            this.Elements.debugArea.style.display = settings.debugMode ? 'block' : 'none';

            const playerNames = ['You'];
            for (let i = 0; i < parseInt(settings.numPlayers, 10); i++) {
                playerNames.push(`Computer ${i + 1}`);
            }
           
            this.game = new RummyGameLogic(playerNames, settings);
            this.humanPlayer = this.game.players[0];
            
            this.gameLoop();
            this.animateInitialDeal();
        },

        async animateInitialDeal() {
            this.isAnimating = true;
            this.setMessage('Dealing cards...');
            const stockPilePos = { x: 250, y: 40 }; // New coordinate
            const dealtCards = Array.from({ length: this.game.players.length }, () => []);
            for (let i = 0; i < 13; i++) {
                for (let p_idx = 0; p_idx < this.game.players.length; p_idx++) {
                    const card = this.game.deck.deal();
                    if (card) dealtCards[p_idx].push(card);
                }
            }

            if (this.fastMode) {
                for (let p_idx = 0; p_idx < this.game.players.length; p_idx++) {
                    this.game.players[p_idx].addCards(dealtCards[p_idx]);
                }
                this.humanPlayer.sortHand();
                this.isAnimating = false;
                this.game.turn_state = 'DRAW';
                this.setMessage('Your turn to draw.', 3000);
                this.checkAiTurn();
                return;
            }
            const animationPromises = [];
            for (let i = 0; i < 13; i++) {
                for (let p_idx = 0; p_idx < this.game.players.length; p_idx++) {
                    const promise = new Promise(resolve => {
                        setTimeout(() => {
                            const card = dealtCards[p_idx][i];
                            if (!card) {
                                resolve();
                                return;
                            }
                            this.playSound('draw');
                            let endPos;
                            let showBack = true;
                            if (p_idx === 0) {
                                const handAndMeldY = 200;
                                const finalHandWidth = 13 * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
                                const handStartX = (C.SCREEN_WIDTH - finalHandWidth) / 2;
                                endPos = { x: handStartX + i * C.CARD_OVERLAP, y: handAndMeldY };
                                showBack = false;
                            } else {
                                const aiPlayerIndex = p_idx - 1;
                                const startX = 480 + (aiPlayerIndex * (C.CARD_WIDTH * 0.7 + 50));
                                const startY = 40;
                                endPos = { x: startX, y: startY };
                            }
                            this.animateCard(card, stockPilePos, endPos, resolve, showBack, 0.12);
                        }, (i * this.game.players.length + p_idx) * 50);
                    });
                    animationPromises.push(promise);
                }
            }
            await Promise.all(animationPromises);
            for (let p_idx = 0; p_idx < this.game.players.length; p_idx++) {
                this.game.players[p_idx].addCards(dealtCards[p_idx]);
            }
            this.humanPlayer.sortHand();
            this.isAnimating = false;
            this.game.turn_state = 'DRAW';
            this.setMessage('Your turn to draw.', 3000);
            this.checkAiTurn();
        },

        async checkAiTurn() {
            if (this.isAnimating || !this.game || this.game.turn_state === 'ROUND_OVER') return;
            this.pickedFromDiscardThisTurn = null; 
            let currentPlayer = this.game.players[this.game.current_player_index];
            if (currentPlayer.isAi && this.game.turn_state === 'DRAW') {
                this.setMessage(`${currentPlayer.name} is thinking...`);
                await this.sleep(1200);
                const turnResult = this.game.executeAiTurn();

                if (turnResult.declared) {
                    this.playSound('declare');
                    this.setMessage(`${currentPlayer.name} has declared!`);
                    await this.sleep(2000); 
                    this.game.endRound(this.game.current_player_index, null);
                    this.declarationResult = { isValid: true, winnerName: currentPlayer.name, penaltyPlayer: null };
                    this.displayShowdownScreen();
                    return; 
                }
                
                if (turnResult && turnResult.drawn) {
                    this.playSound('draw');
                    this.setMessage(`${currentPlayer.name} drew a card.`);
                    
                    const stockPilePos = { x: 250, y: 40 };
                    const discardPilePos = { x: 350, y: 40 };
                    const aiPlayerIndex = this.game.current_player_index - 1;
                    const aiHandArea = {
                        x: 480 + (aiPlayerIndex * (C.CARD_WIDTH * 0.7 + 50)),
                        y: 40
                    };
                    const drawStartPos = turnResult.drawn === this.game.discard_pile[this.game.discard_pile.length] ? discardPilePos : stockPilePos;

                    this.animateCard(turnResult.drawn, drawStartPos, aiHandArea, async () => {
                         await this.sleep(1000);
                         if (turnResult.discarded) {
                            this.playSound('discard');
                            this.setMessage(`${currentPlayer.name} discarded ${turnResult.discarded.toString()}`);
                            this.isDiscarding = true;
                            this.animateCard(turnResult.discarded, aiHandArea, discardPilePos, () => {
                                this.game.playerDiscardCard(turnResult.discarded);
                                this.game.nextTurn();
                                this.isDiscarding = false;
                                this.nextAction = () => this.checkAiTurn(); 
                            });
                         } else {
                            this.game.nextTurn();
                            this.nextAction = () => this.checkAiTurn();
                         }
                    }, true);
                } else {
                    this.game.nextTurn();
                    this.checkAiTurn();
                }
            }
        },

        handleSort() { this.playSound('click'); this.humanPlayer.sortHand(); },


        handleMeld() {
            if (this.Elements.meldButton.disabled || this.isAnimating) return;
            
            const player = this.humanPlayer;
            const handAndMeldY = 200;

            let meldsTotalWidth = 0;
            if (player.melds.length > 0) {
                player.melds.forEach(meld => {
                    meldsTotalWidth += (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP) + C.MELD_SPACING;
                });
            }
            const handTotalWidth = player.hand.length * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
            const totalPlayAreaWidth = meldsTotalWidth + handTotalWidth;
            let playAreaStartX = (C.SCREEN_WIDTH - totalPlayAreaWidth) / 2;
            if (playAreaStartX < 0) playAreaStartX = C.CARD_MARGIN;
            const handStartX = playAreaStartX + meldsTotalWidth;

            let cardsToAnimate = [];
            player.selectedIndices.forEach(index => {
                cardsToAnimate.push({
                    card: player.hand[index],
                    startPos: { 
                        x: handStartX + index * C.CARD_OVERLAP,
                        y: handAndMeldY - 20
                    }
                });
            });
            
            const newMeldX = playAreaStartX + meldsTotalWidth;
            
            const cardsToMeld = player.selectedIndices.map(i => player.hand[i]);
            
            const sortedIndices = player.selectedIndices.sort((a,b) => b-a);
            sortedIndices.forEach(index => player.hand.splice(index, 1));
            player.selectedIndices = [];
            
            this.playSound('meld');

            let animatedCount = cardsToAnimate.length;
            const onSingleCardAnimationComplete = () => {
                animatedCount--;
                if (animatedCount === 0) {
                    player.melds.push(cardsToMeld);
                    
                    // After melding, check if the HUMAN player has now earned the right to see the joker.
                    if (this.game.settings.hiddenJoker && !player.canRevealJoker) {
                        if (player.melds.some(meld => this.game.isPureSequence(meld, player))) {
                            player.canRevealJoker = true;
                        }
                    }
                }
            };
            
            cardsToAnimate.forEach((item, index) => {
                const targetPos = {
                    x: newMeldX + index * C.CARD_OVERLAP,
                    y: handAndMeldY
                }
                this.animateCard(item.card, item.startPos, targetPos, onSingleCardAnimationComplete);
            });
        },
        
        handleDiscard() {
            if (this.Elements.discardButton.disabled || this.isAnimating) return;
            const player = this.humanPlayer;
            const selectedCardIndex = player.selectedIndices[0];
            const cardToDiscard = player.hand[selectedCardIndex];

            if (this.pickedFromDiscardThisTurn && cardToDiscard.rank === this.pickedFromDiscardThisTurn.rank && cardToDiscard.suit === this.pickedFromDiscardThisTurn.suit) {
                this.setMessage("You cannot discard the card you just picked.", 3000);
                return;
            }
            this.playSound('discard');
            const handAndMeldY = 200;

            let meldsTotalWidth = 0;
            if (player.melds.length > 0) {
                player.melds.forEach(meld => {
                    meldsTotalWidth += (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP) + C.MELD_SPACING;
                });
            }
            const handTotalWidth = player.hand.length * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
            const totalPlayAreaWidth = meldsTotalWidth + handTotalWidth;
            let playAreaStartX = (C.SCREEN_WIDTH - totalPlayAreaWidth) / 2;
            if (playAreaStartX < 0) playAreaStartX = C.CARD_MARGIN;
            const handStartX = playAreaStartX + meldsTotalWidth;
            
            const startPos = {x: handStartX + selectedCardIndex * C.CARD_OVERLAP, y: handAndMeldY - 20 };
            const endPos = { x: C.SCREEN_WIDTH / 2 + 15, y: 40 };

            player.hand.splice(selectedCardIndex, 1);
            player.selectedIndices = [];
            this.isDiscarding = true;
            this.animateCard(cardToDiscard, startPos, endPos, () => {
                this.game.playerDiscardCard(cardToDiscard);
                this.game.nextTurn();
                this.isDiscarding = false;
                this.nextAction = () => this.checkAiTurn();
            });
        },

        handleDeclare() {
            this.playSound('declare');
            const player = this.game.players[this.game.current_player_index];
            const selectedCardIndex = player.selectedIndices[0];
            const finalDiscard = player.hand[selectedCardIndex];

            // --- THIS IS THE FIX ---
            // Create a temporary "dummy" player to safely test the declaration.
            const dummyPlayer = new Player('dummy', false);
            dummyPlayer.hasSeenJoker = player.hasSeenJoker;
            // The dummy player's melds start with the real player's melds.
            dummyPlayer.melds = player.melds.map(meld => [...meld]); 
            // The rest of the hand is treated as one final meld.
            const handCardsAsMeld = player.hand.filter((c, i) => i !== selectedCardIndex);
            if (handCardsAsMeld.length > 0) {
                dummyPlayer.melds.push(handCardsAsMeld);
            }
            
            // Validate the dummy player's complete hand.
            const result = this.game.validateDeclaration(dummyPlayer);
            
            if (result.isValid) {
                // If valid, apply the changes to the real player.
                player.hand.splice(selectedCardIndex, 1);
                if (player.hand.length > 0) {
                    player.melds.push(player.hand.splice(0, player.hand.length));
                }
                this.game.playerDiscardCard(finalDiscard);
                const winnerIndex = this.game.current_player_index;
                this.game.players.forEach((p, i) => {
                    if (i !== winnerIndex) this.game.autoMeld(p);
                });
                this.game.endRound(winnerIndex, null);
                this.declarationResult = { isValid: true, winnerName: player.name, penaltyPlayer: null };
                this.displayShowdownScreen();
            } else {
                // If invalid, it's a wrong declaration.
                this.game.endRound(null, this.game.current_player_index);
                this.declarationResult = { isValid: false, winnerName: null, penaltyPlayer: player };
                this.displayShowdownScreen();
            }
        },
        
        drawCardAndAnimate(card, startPos, showBack) {
            if (!card) return;
            this.playSound('draw');
            
            const handY = C.SCREEN_HEIGHT - C.CARD_HEIGHT - C.CARD_MARGIN;
            const handTotalWidth = (this.humanPlayer.hand.length + 1) * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
            const handStartX = (C.SCREEN_WIDTH - handTotalWidth) / 2;
            const endPos = { x: handStartX + this.humanPlayer.hand.length * C.CARD_OVERLAP, y: handY };

            this.animateCard(card, startPos, endPos, () => {
                this.humanPlayer.addCards([card]);
                this.game.turn_state = 'ACTION';
                this.setMessage("Select cards to meld, or one to discard.", 4000);
            }, showBack);
        },


        handleCanvasClick(event) {
            if (!this.game || this.game.turn_state === 'ROUND_OVER' || this.isAnimating || this.game.players[this.game.current_player_index].isAi) {
                return;
            }

            const mouse = { x: event.clientX - this.canvas.getBoundingClientRect().left, y: event.clientY - this.canvas.getBoundingClientRect().top };
            
            if (this.game.turn_state === 'DRAW') {
                const stockPileRect = { x: 250, y: 40, width: C.CARD_WIDTH, height: C.CARD_HEIGHT };
                const discardPileRect = { x: 350, y: 40, width: C.CARD_WIDTH, height: C.CARD_HEIGHT };

                if (mouse.x >= stockPileRect.x && mouse.x <= stockPileRect.x + stockPileRect.width && mouse.y >= stockPileRect.y && mouse.y <= stockPileRect.y + stockPileRect.height) {
                    this.drawCardAndAnimate(this.game.deck.deal(), stockPileRect, true);
                } else if (mouse.x >= discardPileRect.x && mouse.x <= discardPileRect.x + discardPileRect.width && mouse.y >= discardPileRect.y && mouse.y <= discardPileRect.y + discardPileRect.height) {
                    const card = this.game.discard_pile.pop();
                    this.pickedFromDiscardThisTurn = card;
                    this.drawCardAndAnimate(card, discardPileRect, false);
                }
            } else if (this.game.turn_state === 'ACTION') {
                // The rest of this function remains unchanged.
                const handAndMeldY = 200;

                for (let i = 0; i < this.ungroupButtonRects.length; i++) {
                    const rect = this.ungroupButtonRects[i];
                    if (mouse.x >= rect.x && mouse.x <= rect.x + rect.width && mouse.y >= rect.y && mouse.y <= rect.y + rect.height) {
                        this.playSound('click');
                        this.game.ungroupMeld(rect.meldIndex);
                        return;
                    }
                }
                
                let meldsTotalWidth = 0;
                if (this.humanPlayer.melds.length > 0) {
                    this.humanPlayer.melds.forEach(meld => {
                        meldsTotalWidth += (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP) + C.MELD_SPACING;
                    });
                }
                const handTotalWidth = this.humanPlayer.hand.length * C.CARD_OVERLAP + (C.CARD_WIDTH - C.CARD_OVERLAP);
                const totalPlayAreaWidth = meldsTotalWidth + handTotalWidth;
                let playAreaStartX = (C.SCREEN_WIDTH - totalPlayAreaWidth) / 2;
                if (playAreaStartX < 0) playAreaStartX = C.CARD_MARGIN;

                if (this.humanPlayer.selectedIndices.length === 1) {
                    if (mouse.y >= handAndMeldY && mouse.y <= handAndMeldY + C.CARD_HEIGHT) {
                        let currentMeldX = playAreaStartX;
                        for (let i = 0; i < this.humanPlayer.melds.length; i++) {
                            const meld = this.humanPlayer.melds[i];
                            const meldWidth = (meld.length * C.CARD_OVERLAP + C.CARD_WIDTH - C.CARD_OVERLAP);
                            if (mouse.x >= currentMeldX && mouse.x <= currentMeldX + meldWidth) {
                                const cardIndexToMove = this.humanPlayer.selectedIndices[0];
                                const cardToMove = this.humanPlayer.hand[cardIndexToMove];
                                if (cardToMove) {
                                    this.playSound('meld');
                                    this.humanPlayer.hand.splice(cardIndexToMove, 1);
                                    meld.push(cardToMove);
                                    const rankMap = new Map(this.humanPlayer.ranks_order.map((r, i) => [r, i]));
                                    meld.sort((a, b) => rankMap.get(a.rank) - rankMap.get(b.rank));
                                    this.humanPlayer.selectedIndices = [];
                                    return;
                                }
                            }
                            currentMeldX += meldWidth + C.MELD_SPACING;
                        }
                    }
                }

                if (mouse.y >= handAndMeldY - 20 && mouse.y <= handAndMeldY + C.CARD_HEIGHT) {
                    const handStartX = playAreaStartX + meldsTotalWidth;
                    for (let i = this.humanPlayer.hand.length - 1; i >= 0; i--) {
                        const cardX = handStartX + i * C.CARD_OVERLAP;
                        const isSelected = this.humanPlayer.selectedIndices.includes(i);
                        const currentCardY = isSelected ? handAndMeldY - 20 : handAndMeldY;
                        const clickableWidth = (i === this.humanPlayer.hand.length - 1) ? C.CARD_WIDTH : C.CARD_OVERLAP;
                        if (mouse.x >= cardX && mouse.x <= cardX + clickableWidth && mouse.y >= currentCardY && mouse.y <= currentCardY + C.CARD_HEIGHT) {
                            this.humanPlayer.toggleSelection(i);
                            return;
                        }
                    }
                }
            }
        },
        
        sleep(ms) { return new Promise(resolve => setTimeout(resolve, this.fastMode ? 0 : ms)); },

        setMessage(text, duration = 2000) {
            if (!this.game) return;
            this.game.message.text = text;
            if (this.messageTimer) clearTimeout(this.messageTimer);
            this.messageTimer = setTimeout(() => {
                if (this.game) this.game.message.text = '';
            }, duration);
        },

        animateCard(card, startPos, endPos, onComplete, showBack = false, speed = 0.15) {
            if (this.fastMode) {
                if (onComplete) onComplete();
                return;
            }
            const animation = {
                card, x: startPos.x, y: startPos.y, targetX: endPos.x, targetY: endPos.y, showBack, speed,
                update: function() {
                    const dx = this.targetX - this.x;
                    const dy = this.targetY - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 15) { this.x = this.targetX; this.y = this.targetY; return true; }
                    this.x += dx * this.speed;
                    this.y += dy * this.speed;
                    return false;
                },
                onComplete
            };
            this.animatedCards.push(animation);
            this.isAnimating = true;
        },

        displayShowdownScreen() {
            this.Elements.gameContainer.style.display = 'none';
            this.Elements.debugArea.style.display = 'none';
            this.Elements.showdownScreen.style.display = 'block';
            const { winnerName, penaltyPlayer } = this.declarationResult;
            const showdownTitle = document.getElementById('showdown-title');
            const showdownContent = document.getElementById('showdown-content');
            if (this.declarationResult.isValid) {
                this.playSound('win');
                showdownTitle.textContent = winnerName === 'You' ? 'You Win the Round!' : `${winnerName} Wins the Round!`;
            } else {
                this.playSound('error');
                showdownTitle.textContent = `${penaltyPlayer.name} Made a Wrong Declaration!`;
            }
            showdownContent.innerHTML = '';
            this.game.players.forEach((player, index) => {
                const points = this.game.calculatePlayerPoints(index);
                const playerArea = document.createElement('div');
                playerArea.className = 'showdown-player-area';
                const createTextForCards = (cards) => cards.map(card => `<span class="${(card.suit === 'Hearts' || card.suit === 'Diamonds') ? 'card-text-red' : 'card-text-black'}">${card.toString()}</span>`).join(' ');
                const meldsHtml = player.melds.map(meld => `<span>[${createTextForCards(meld)}]</span>`).join(' ');
                const handHtml = createTextForCards(player.hand);
                playerArea.innerHTML = `<h4>${player.name}</h4><p>Points Added: ${points}</p><p>Melds:</p><div class="showdown-card-list">${meldsHtml || 'None'}</div><p>Hand (Deadwood):</p><div class="showdown-card-list">${handHtml || 'None'}</div>`;
                showdownContent.appendChild(playerArea);
            });
        },

        handleNextRound() {
            this.playSound('click');
            this.Elements.scoreboardScreen.style.display = 'none';

            // --- THIS IS THE FIX ---
            // We now reset the joker flip animation state for the new round.
            this.jokerFlipState = { animating: false, phase: 1, currentWidth: 0 };
            // -------------------------

            if (this.game.currentRound >= this.game.settings.numRounds) {
                this.Elements.settingsScreen.style.display = 'block';
            } else {
                this.playSound('shuffle');
                this.Elements.gameContainer.style.display = 'block';
                this.Elements.debugArea.style.display = this.game.settings.debugMode ? 'block' : 'none';
                this.game.startNextRound();
                this.animateInitialDeal();
            }
        },

        handleContinueToScoreboard() {
            this.playSound('click');
            this.Elements.showdownScreen.style.display = 'none';
            this.displayScoreboard();
        },

        displayScoreboard() {
            const scoreTable = document.getElementById('score-table');
            const roundWinnerText = document.getElementById('round-winner-text');
            const nextRoundBtn = document.getElementById('next-round-btn');
            this.Elements.scoreboardScreen.style.display = 'block';
            if (this.declarationResult.penaltyPlayer) {
                 roundWinnerText.textContent = `${this.declarationResult.penaltyPlayer.name} made a wrong declaration!`;
            } else {
                roundWinnerText.textContent = `${this.declarationResult.winnerName} won Round ${this.game.currentRound}!`;
            }
            scoreTable.innerHTML = '<thead><tr><th>Player</th><th>Score</th></tr></thead>';
            const tbody = document.createElement('tbody');
            this.game.players.forEach((player, index) => {
                const row = tbody.insertRow();
                row.insertCell().textContent = player.name;
                row.insertCell().textContent = this.game.scores[index];
            });
            scoreTable.appendChild(tbody);
            if (this.game.currentRound >= this.game.settings.numRounds) {
                nextRoundBtn.textContent = 'New Game';
            } else {
                nextRoundBtn.textContent = 'Next Round';
            }
        },

        handleRevealJoker() {
            this.playSound('click');
            this.jokerFlipState.animating = true;
        }
    };
    
    App.init();
});