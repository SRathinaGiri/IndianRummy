// rummy-logic.js - PART 1 of 7

class Card {
    constructor(suit, rank) {
        this.suit = suit; this.rank = rank;
        this.suit_symbols = {'Hearts': '♥', 'Diamonds': '♦', 'Clubs': '♣', 'Spades': '♠'};
    }
    toString() {
        if (this.rank === 'JOKER') return 'JOKER';
        return `${this.rank}${this.suit_symbols[this.suit] || '?'}`;
    }
    getPoints() {
        if (['J', 'Q', 'K', 'A'].includes(this.rank)) return 10;
        if (this.rank === 'JOKER') return 0;
        return parseInt(this.rank) || 0;
    }
}
class Deck {
    constructor(numDecks = 3) {
        this.cards = [];
        const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        for (let i = 0; i < numDecks; i++) {
            for (const suit of suits) {
                for (const rank of ranks) { this.cards.push(new Card(suit, rank)); }
            }
            this.cards.push(new Card('Joker', 'JOKER')); this.cards.push(new Card('Joker', 'JOKER'));
        }
        this.shuffle();
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    deal() { return this.cards.pop() || null; }
}
export class Player {
    constructor(name, isAi = false) {
        this.name = name; this.isAi = isAi; this.hand = []; this.melds = [];
        this.selectedIndices = []; this.hasSeenJoker = false;
        this.canRevealJoker = false;
        this.ranks_order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'];
        this.suits_order = ['Hearts', 'Diamonds', 'Clubs', 'Spades', 'Joker'];
        this.lastDrawnCard = null;
        this.lastDiscardedCard = null;        
    }
    addCards(cards) { this.hand.push(...cards); }
    sortHand() {
        this.selectedIndices = [];
        const rankMap = new Map(this.ranks_order.map((r, i) => [r, i]));
        const suitMap = new Map(this.suits_order.map((s, i) => [s, i]));
        this.hand.sort((a, b) => (suitMap.get(a.suit) - suitMap.get(b.suit)) || (rankMap.get(a.rank) - rankMap.get(b.rank)));
    }
    resetForNewRound() {
        this.hand = [];
        this.melds = [];
        this.selectedIndices = [];
        this.hasSeenJoker = false;
        this.canRevealJoker = false;
        this.lastDrawnCard = null;
        this.lastDiscardedCard = null;        
    }
    toggleSelection(cardIndex) {
        const i = this.selectedIndices.indexOf(cardIndex);
        if (i > -1) { this.selectedIndices.splice(i, 1); } else { this.selectedIndices.push(cardIndex); }
    }
}

export class RummyGameLogic {
    constructor(playerNames, gameSettings) {
        this.settings = gameSettings;
        this.players = playerNames.map((name, i) => new Player(name, i > 0));
        this.scores = new Array(this.players.length).fill(0);
        this.currentRound = 1;
        this.deck = new Deck(3);
        this.stock_pile = []; this.discard_pile = []; this.wild_joker = null;
        this.current_player_index = 0;
        this.turn_state = 'DRAW';
        this.message = { text: '' };
        this.rankMap = new Map(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r, i) => [r, i]));
        this.discard_history = [];
        this.pickup_log = {};
        this.setup_round();
    }
    
// rummy-logic.js - PART 2 of 7

    setup_round() {
        this.deck = new Deck(3);
        this.players.forEach((p, i) => {
            p.resetForNewRound();
            if (!this.settings.hiddenJoker) p.hasSeenJoker = true;
            this.pickup_log[i] = [];
        });
        this.discard_history = [];
        do { this.wild_joker = this.deck.deal(); } while (this.wild_joker && this.wild_joker.rank === 'JOKER');
        this.stock_pile = this.deck.cards;
        if (this.stock_pile.length > 0) {
            this.discard_pile = [this.stock_pile.pop()];
            this.discard_history.push(this.discard_pile[0]);
        } else {
            this.discard_pile = [];
        }
        this.turn_state = 'SETUP';
        this.current_player_index = 0;
        this.penaltyPlayerIndex = null;
    }

    // --- REFACTORED HELPER FUNCTIONS (They now accept a player object directly) ---
    isJoker(card, player) {
        if (!card || !player) return false;
        return card.rank === 'JOKER' || (player.hasSeenJoker && this.wild_joker && card.rank === this.wild_joker.rank);
    }

   isPureSequence(meld, player) {
        // A pure sequence must first be a valid run
        if (!this._validateRun(meld, player)) {
            return false;
        }

        // If any printed joker is present it can never be pure
        if (meld.some(card => card.rank === 'JOKER')) {
            return false;
        }

        // When the player hasn't seen the joker yet (or when a falsy value is
        // passed instead of a player object) jokers are not considered, so the
        // above checks are sufficient.
        if (!player || !player.hasSeenJoker || !this.wild_joker) {
            return true;
        }

        // At this point the player knows the wild joker. If the sequence
        // contains any card of the wild joker's rank, it might still be a pure
        // run if that card is used naturally (e.g., 4♦ 5♦ 6♦ when 5s are wild).
        if (meld.some(card => card.rank === this.wild_joker.rank)) {
            const tempPlayer = new Player('temp', true);
            tempPlayer.hasSeenJoker = false; // Treat wild jokers as normal
            return this._validateRun(meld, tempPlayer);
        }

        // No jokers of any kind are present
        return true;
    }

    _validateRun(cards, player) {
        if (cards.length < 3) return false;
        
        // --- THIS IS THE FIX ---
        // First, check for a Golden Rummy (e.g., 9♣ 9♣ 9♣)
        const firstCard = cards[0];
        if (cards.every(card => card.rank === firstCard.rank && card.suit === firstCard.suit)) {
            return true;
        }
        // --- END OF FIX ---

        const jokers = cards.filter(c => this.isJoker(c, player));
        const nonJokers = cards.filter(c => !this.isJoker(c, player));
        if (nonJokers.length === 0) return true;
        
        const nonJokerRanks = nonJokers.map(c => c.rank);
        if (new Set(nonJokerRanks).size !== nonJokerRanks.length) return false;
        
        const suit = nonJokers[0].suit;
        if (nonJokers.some(c => c.suit !== suit)) return false;
        
        const sortedNonJokers = [...nonJokers].sort((a, b) => this.rankMap.get(a.rank) - this.rankMap.get(b.rank));
        const gaps1 = this._calculateGaps(sortedNonJokers, this.rankMap);
        if (gaps1 <= jokers.length) return true;

        if (sortedNonJokers.some(c => c.rank === 'A')) {
            const akqRankMap = new Map(this.rankMap);
            akqRankMap.set('A', 13);
            const akqSorted = [...nonJokers].sort((a, b) => (akqRankMap.get(a.rank) ?? -1) - (akqRankMap.get(b.rank) ?? -1));
            const gaps2 = this._calculateGaps(akqSorted, akqRankMap);
            if (gaps2 <= jokers.length) return true;
        }
        return false;
    }

// rummy-logic.js - PART 3 of 7

    _validateSet(cards, player) {
        if (cards.length < 3) return false;
        const nonJokers = cards.filter(c => !this.isJoker(c, player));
        if (nonJokers.length === 0) return true;
        if (cards.length > 4) return false;
        const rank = nonJokers[0].rank;
        if (nonJokers.some(c => c.rank !== rank)) return false;
        const suits = nonJokers.map(c => c.suit);
        return new Set(suits).size === suits.length;
    }

    _getAllPossibleMelds(hand, player) {
        const runs = [];
        const sets = [];
        const combinations = (arr, k) => {
            if (k > arr.length || k <= 0) return [];
            if (k === arr.length) return [arr];
            if (k === 1) return arr.map(e => [e]);
            const combs = [];
            arr.forEach((e, i) => {
                const head = arr.slice(i + 1);
                const tailcombs = combinations(head, k - 1);
                tailcombs.forEach(tc => combs.push([e, ...tc]));
            });
            return combs;
        };
        const allCombs = [...combinations(hand, 3), ...combinations(hand, 4), ...combinations(hand, 5), ...combinations(hand, 6)];
        for (const meld of allCombs) {
            if (this._validateRun(meld, player)) runs.push(meld);
            else if (this._validateSet(meld, player)) sets.push(meld);
        }
        return { runs, sets };
    }

    _calculateGaps(nonJokers, rankMap) {
        let gaps = 0;
        for (let i = 0; i < nonJokers.length - 1; i++) {
            const v1 = rankMap.get(nonJokers[i].rank);
            const v2 = rankMap.get(nonJokers[i + 1].rank);
            if (v1 === undefined || v2 === undefined) return Infinity;
            gaps += (v2 - v1) - 1;
        }
        return gaps;
    }
    // --- END OF HELPER REFACTOR ---


    // --- AI STRATEGY FUNCTIONS ---
    // The new autoMeld function, as designed by you.
   autoMeld(player) {
        const hand = [...player.hand, ...player.melds.flat()];
        player.melds = []; // Start fresh
        let remainingCards = [...hand];
        let finalMelds = [];

        const without = (source, items) => {
            const remaining = [...source];
            for (const item of items) {
                const idx = remaining.findIndex(c => c.rank === item.rank && c.suit === item.suit);
                if (idx > -1) remaining.splice(idx, 1);
            }
            return remaining;
        };
        const meldPoints = (meld) => meld.reduce((s, c) => s + c.getPoints(), 0);

        // --- A simpler, more robust greedy algorithm ---

        // Phase 1: Greedily find all possible PURE sequences.
        let changed = true;
        while(changed) {
            changed = false;
            const pureRuns = this._getAllPossibleMelds(remainingCards, player).runs.filter(r => this.isPureSequence(r, player));
            if (pureRuns.length > 0) {
                // Prioritize the pure run that saves the most points
                pureRuns.sort((a,b) => meldPoints(b) - meldPoints(a)); 
                const bestPureRun = pureRuns[0];
                finalMelds.push(bestPureRun);
                remainingCards = without(remainingCards, bestPureRun);
                changed = true;
            }
        }
        
        // Phase 2: Greedily find all possible IMPURE sequences.
        changed = true;
        while(changed) {
            changed = false;
            const impureRuns = this._getAllPossibleMelds(remainingCards, player).runs;
            if(impureRuns.length > 0) {
                impureRuns.sort((a,b) => meldPoints(b) - meldPoints(a));
                const bestImpureRun = impureRuns[0];
                finalMelds.push(bestImpureRun);
                remainingCards = without(remainingCards, bestImpureRun);
                changed = true;
            }
        }

        // Phase 3: Check if rules are met. If so, form all possible sets.
        const runCount = finalMelds.filter(m => this._validateRun(m, player)).length;
        const pureRunCount = finalMelds.filter(m => this.isPureSequence(m, player)).length;

        if (runCount >= 2 && pureRunCount >= 1) {
            changed = true;
            while(changed) {
                changed = false;
                const sets = this._getAllPossibleMelds(remainingCards, player).sets;
                if(sets.length > 0) {
                    sets.sort((a,b) => meldPoints(b) - meldPoints(a));
                    const bestSet = sets[0];
                    finalMelds.push(bestSet);
                    remainingCards = without(remainingCards, bestSet);
                    changed = true;
                }
            }
        }
        
        player.melds = finalMelds;
        player.hand = remainingCards; // The remaining cards are the deadwood
    }

// rummy-logic.js - PART 4 of 7
    
    _evaluateHandPotential(hand, player) {
        const tempPlayer = new Player('dummy', true);
        tempPlayer.hand = [...hand];
        tempPlayer.hasSeenJoker = player.hasSeenJoker;
        this.autoMeld(tempPlayer);
        let score = tempPlayer.hand.reduce((s, c) => s + c.getPoints(), 0);
        // Penalize holding high value cards when similar ranks were already discarded
        for (const c of tempPlayer.hand) {
            if (c.getPoints() >= 10 && this.discard_history.some(d => d.rank === c.rank)) {
                score += 5; // increase potential score to discourage waiting
            }
        }
        if (tempPlayer.melds.length > 0) {
             const validation = this.validateDeclaration(tempPlayer);
             if (validation.isValid) {
                 score -= 100;
             } else {
                 score -= tempPlayer.melds.length * 10;
             }
        }
        return score;
    }
    
    executeAiTurn() {
        const player = this.players[this.current_player_index];

        if (this.settings.hiddenJoker && player.canRevealJoker && !player.hasSeenJoker) {
            player.hasSeenJoker = true;
        }

        const discardTop = this.discard_pile[this.discard_pile.length - 1];
        let pickFromDiscard = false;
        if (discardTop) {
            if (this.isJoker(discardTop, player)) {
                pickFromDiscard = true;
            } else {
                const currentScore = this._evaluateHandPotential([...player.hand, ...player.melds.flat()], player);
                const scoreWithCard = this._evaluateHandPotential([...player.hand, ...player.melds.flat(), discardTop], player);
                if (scoreWithCard < currentScore) {
                    pickFromDiscard = true;
                }
            }
        }
        let drawnCard = null;
        if (pickFromDiscard) {
            drawnCard = this.discard_pile.pop();
        } else {
            if (this.stock_pile.length === 0) return { drawn: null, discarded: null, declared: false };
            drawnCard = this.deck.deal();
        }
        player.lastDrawnCard = drawnCard;
        
        const entireHand = [...player.hand, ...player.melds.flat()];
        if(drawnCard) entireHand.push(drawnCard);
        
        player.hand = entireHand;
        player.melds = [];
        this.autoMeld(player);

        if (player.hand.length <= 1) {
            const validation = this.validateDeclaration(player);
            if(validation.isValid) {
                let cardToDiscard;
                if(player.hand.length === 1) {
                    cardToDiscard = player.hand[0];
                } else if(player.melds.length > 0) {
                    const lastMeld = player.melds[player.melds.length - 1];
                    if (lastMeld && lastMeld.length > 0) cardToDiscard = lastMeld.pop();
                }
                if (cardToDiscard) {
                    player.hand = [];
                    player.lastDiscardedCard = cardToDiscard;
                    return { drawn: drawnCard, discarded: cardToDiscard, declared: true };
                }
            }
        }

        let bestCardToDiscard = null;
        let discardPool = player.hand;
        if (discardPool.length === 0) {
            if (player.melds.length > 0) {
                player.melds.sort((a,b) => a.reduce((s,c)=>s+c.getPoints(),0) - b.reduce((s,c)=>s+c.getPoints(),0));
                const meldToBreak = player.melds.shift();
                discardPool = meldToBreak;
            } else {
                player.lastDiscardedCard = drawnCard;
                return { drawn: drawnCard, discarded: drawnCard, declared: false };
            }
        }
        
        let lowestFutureScore = Infinity;
        let candidateDiscards = [];
        for (const potentialDiscard of discardPool) {
            if (this.isJoker(potentialDiscard, player) && discardPool.length > 1) continue;
            const tempHand = discardPool.filter(c => c !== potentialDiscard);
            let futureEval = this._evaluateHandPotential(tempHand, player);
            if (potentialDiscard.getPoints() >= 10 && this.discard_history.some(d => d.rank === potentialDiscard.rank)) {
                futureEval -= 5; // prefer discarding high value cards already seen discarded
            }
            if (futureEval < lowestFutureScore) {
                lowestFutureScore = futureEval;
                candidateDiscards = [potentialDiscard];
            } else if (futureEval === lowestFutureScore) {
                candidateDiscards.push(potentialDiscard);
            }
        }

        if (candidateDiscards.length > 1) {
            const prevDiscarded = candidateDiscards.filter(c => this.discard_history.some(d => d.rank === c.rank));
            if (prevDiscarded.length > 0) candidateDiscards = prevDiscarded;
        }

        const nextIndex = (this.current_player_index + 1) % this.players.length;
        const nextLog = this.pickup_log[nextIndex] || [];
        const lastPickup = nextLog[nextLog.length - 1];
        if (candidateDiscards.length > 1 && lastPickup) {
            const lastRank = this.rankMap.get(lastPickup.rank);
            candidateDiscards = candidateDiscards.filter(c => {
                const r = this.rankMap.get(c.rank);
                if (c.rank === lastPickup.rank) return false;
                if (c.suit === lastPickup.suit && Math.abs(r - lastRank) <= 1) return false;
                return true;
            });
            if (candidateDiscards.length === 0) candidateDiscards = [prevDiscarded ? prevDiscarded[0] : discardPool[0]];
        }

        if (candidateDiscards.length === 0) {
            candidateDiscards = discardPool;
        }

        candidateDiscards.sort((a,b)=>b.getPoints()-a.getPoints());
        bestCardToDiscard = candidateDiscards[0];
        
        if (!bestCardToDiscard) {
             bestCardToDiscard = discardPool.sort((a,b)=>b.getPoints()-a.getPoints())[0];
        }
        
        const finalDiscardPool = player.hand.length > 0 ? player.hand : discardPool;
        const discardIndex = finalDiscardPool.indexOf(bestCardToDiscard);
        if (discardIndex > -1) {
            finalDiscardPool.splice(discardIndex, 1);
        }
        if (player.hand.length === 0 && finalDiscardPool !== player.hand) {
            // We broke a meld to discard, so the remaining cards become the new hand
            player.hand = finalDiscardPool;
        }
        
        player.lastDiscardedCard = bestCardToDiscard;
        return { drawn: drawnCard, discarded: bestCardToDiscard, declared: false };
    }

// rummy-logic.js - PART 5 of 7
    
    // --- CORE GAME AND SCORING FUNCTIONS ---
    calculateScores(winnerIndex, penaltyPlayerIndex = null) {
        if (penaltyPlayerIndex !== null) {
            this.scores[penaltyPlayerIndex] += 80;
        } else {
            this.players.forEach((player, index) => {
                if (index !== winnerIndex) {
                    this.scores[index] += this.calculatePlayerPoints(player);
                }
            });
        }
    }
    
    calculatePlayerPoints(player) {
        const playerObj = typeof player === 'number' ? this.players[player] : player;
        if (!playerObj) return 0;

        const playerIndex = this.players.indexOf(playerObj);
        if (this.penaltyPlayerIndex === playerIndex) return 80;
        if (this.penaltyPlayerIndex !== null && playerIndex !== -1 && playerIndex !== this.penaltyPlayerIndex) return 0;
        if (this.turn_state === 'ROUND_OVER' && this.current_player_index === playerIndex && this.penaltyPlayerIndex === null) return 0;
        
        let totalPoints = 0;

        // Count points from cards in hand
        playerObj.hand.forEach(card => {
            if (!this.isJoker(card, playerObj)) {
                totalPoints += card.getPoints();
            }
        });

        // Evaluate melds as arranged by the player
        let runCount = 0;
        let pureRunCount = 0;
        playerObj.melds.forEach(meld => {
            if (this._validateRun(meld, playerObj)) {
                runCount++;
                if (this.isPureSequence(meld, playerObj)) {
                    pureRunCount++;
                }
            }
        });

        const canMeldSets = runCount >= 2 && pureRunCount >= 1;
        playerObj.melds.forEach(meld => {
            const isRun = this._validateRun(meld, playerObj);
            const isSet = this._validateSet(meld, playerObj);
            if (!isRun && !(isSet && canMeldSets)) {
                meld.forEach(card => {
                    if (!this.isJoker(card, playerObj)) {
                        totalPoints += card.getPoints();
                    }
                });
            }
        });

        return totalPoints;
    }

// rummy-logic.js - PART 6 of 7

    getHandAnalysis(player) {
        const tempPlayer = new Player(player.name, player.isAi);
        tempPlayer.hand = [...player.hand];
        tempPlayer.melds = [...player.melds];
        tempPlayer.hasSeenJoker = player.hasSeenJoker;

        this.autoMeld(tempPlayer);
        
        const deadwood = tempPlayer.hand;
        const realPoints = deadwood.reduce((total, card) => total + (this.isJoker(card, tempPlayer) ? 0 : card.getPoints()), 0);

        return { 
            realPoints: realPoints,
            melds: tempPlayer.melds,
            deadwood: deadwood 
        };
    }

    validateDeclaration(player) {
        if (player.name !== 'dummy') {
            const playerIndex = this.players.indexOf(player);
             if (this.penaltyPlayerIndex === playerIndex) return { isValid: false, message: "Wrong Declaration"};
        }
       
        const allMeldedCards = player.melds.flat();
        if (allMeldedCards.length > 0 && allMeldedCards.length !== 13) {
             return { isValid: false, message: `Declaration must use 13 cards. You have ${allMeldedCards.length}.` };
        }
        let runCount = 0, pureRunCount = 0;
        for (const meld of player.melds) {
            if (meld.length === 0) continue; 
            const isRun = this._validateRun(meld, player);
            const isSet = this._validateSet(meld, player);
            if (!isRun && !isSet) return { isValid: false, message: `Invalid group: [${meld.map(c=>c.toString()).join(', ')}]`};
            if (isRun) {
                runCount++;
                if (this.isPureSequence(meld, player)) pureRunCount++;
            }
        }
        if (runCount < 2) return { isValid: false, message: "You need at least two runs." };
        if (pureRunCount < 1) return { isValid: false, message: "You need at least one pure sequence." };
        return { isValid: true, message: "Valid declaration!" };
    }
    
    endRound(winnerIndex, penaltyPlayerIndex = null) {
        this.turn_state = 'ROUND_OVER';
        if (winnerIndex !== null) this.current_player_index = winnerIndex;
        this.penaltyPlayerIndex = penaltyPlayerIndex;
        this.players.forEach((p, i) => {
            if (i !== winnerIndex && p.isAi) {
                this.autoMeld(p);
            }
        });
        this.calculateScores(winnerIndex, penaltyPlayerIndex);
    }

    startNextRound() { this.currentRound++; this.setup_round(); }

    playerDrawFromStock() {
        const player = this.players[this.current_player_index];
        const card = this.deck.deal();
        if(card) player.addCards([card]);
        this.turn_state = 'ACTION';
    }
    playerDrawFromDiscard() {
        const player = this.players[this.current_player_index];
        const card = this.discard_pile.pop();
        if(card) {
            player.addCards([card]);
            if (!this.pickup_log[this.current_player_index]) this.pickup_log[this.current_player_index] = [];
            this.pickup_log[this.current_player_index].push(card);
        }
        this.turn_state = 'ACTION';
    }

// rummy-logic.js - PART 7 of 7

    playerDiscardCard(card) { 
        if(card) { 
            this.discard_pile.push(card); 
            this.discard_history.push(card); 
        } 
    }
    groupSelectedCards() {
        const player = this.players[this.current_player_index];
        if(player.isAi || player.selectedIndices.length===0) return;
        const cardsToMeld = [];
        const newHand = player.hand.filter((card, index) => {
            if (player.selectedIndices.includes(index)) {
                cardsToMeld.push(card);
                return false;
            }
            return true;
        });
        if(cardsToMeld.length > 0) {
            player.hand = newHand;
            player.melds.push(cardsToMeld);
            player.selectedIndices = [];
        }
    }
    ungroupMeld(meldIndex) {
        const player = this.players[this.current_player_index];
        if(player.isAi || !player.melds[meldIndex]) return;
        player.hand.push(...player.melds.splice(meldIndex, 1)[0]);
        player.sortHand();
    }
    nextTurn() {
        if (this.turn_state === 'ROUND_OVER') return;
        const previousPlayer = this.players[this.current_player_index];
        if (this.settings.hiddenJoker && !previousPlayer.canRevealJoker) {
            const allCards = [...previousPlayer.hand, ...previousPlayer.melds.flat()];
            const { runs } = this._getAllPossibleMelds(allCards, previousPlayer);
            if (runs.some(run => this.isPureSequence(run, previousPlayer))) {
               previousPlayer.canRevealJoker = true;
            }
        }
        previousPlayer.selectedIndices = [];
        this.current_player_index = (this.current_player_index + 1) % this.players.length;
        this.turn_state = 'DRAW';
    }
}    