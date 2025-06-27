// rummy-logic.js
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
class Player {
    constructor(name, isAi = false) {
        this.name = name; this.isAi = isAi; this.hand = []; this.melds = [];
        this.selectedIndices = []; this.hasSeenJoker = false;
        this.canRevealJoker = false;
        this.ranks_order = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'];
        this.suits_order = ['Hearts', 'Diamonds', 'Clubs', 'Spades', 'Joker'];
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
    calculateScores(winnerIndex, penaltyPlayerIndex = null) {
        if (penaltyPlayerIndex !== null) {
            this.scores[penaltyPlayerIndex] += 80;
        } else {
            this.players.forEach((player, index) => {
                if (index !== winnerIndex) this.scores[index] += player.hand.reduce((total, card) => total + card.getPoints(), 0);
            });
        }
    }
    calculatePlayerPoints(playerIndex) {
        const player = this.players[playerIndex];
        if (this.penaltyPlayerIndex === playerIndex) return 80;
        if (this.penaltyPlayerIndex !== null && this.penaltyPlayerIndex !== playerIndex) return 0;
        if (this.turn_state === 'ROUND_OVER' && this.current_player_index === playerIndex && this.penaltyPlayerIndex === null) return 0;
        return player.hand.reduce((total, card) => total + card.getPoints(), 0);
    }
    endRound(winnerIndex, penaltyPlayerIndex = null) {
        this.turn_state = 'ROUND_OVER';
        if (winnerIndex !== null) this.current_player_index = winnerIndex;
        this.penaltyPlayerIndex = penaltyPlayerIndex;
        this.calculateScores(winnerIndex, penaltyPlayerIndex);
    }
    startNextRound() {
        this.currentRound++;
        this.setup_round();
    }
    playerDrawFromStock() {
        const player = this.players[this.current_player_index];
        const card = this.stock_pile.pop();
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
    playerDiscardCard(card) {
        if (!card) return;
        this.discard_pile.push(card);
        this.discard_history.push(card);
    }
    groupSelectedCards() {
        const player = this.players[this.current_player_index];
        if (player.isAi || player.selectedIndices.length === 0) return;
        const cardsToMeld = [];
        const newHand = player.hand.filter((card, index) => {
            if (player.selectedIndices.includes(index)) {
                cardsToMeld.push(card);
                return false;
            }
            return true;
        });
        if (cardsToMeld.length > 0) {
            player.hand = newHand;
            player.melds.push(cardsToMeld);
            player.selectedIndices = [];
        }
    }
    ungroupMeld(meldIndex) {
        const player = this.players[this.current_player_index];
        if (player.isAi || !player.melds[meldIndex]) return;
        const cardsToReturn = player.melds.splice(meldIndex, 1)[0];
        player.hand.push(...cardsToReturn);
        player.sortHand();
    }
    isJoker(card, playerIndex) {
        const player = this.players[playerIndex];
        if (!card) return false;
        return card.rank === 'JOKER' || (player.hasSeenJoker && this.wild_joker && card.rank === this.wild_joker.rank);
    }
    _getAllPossibleMelds(hand, playerIndex) {
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
        const allCombs = [...combinations(hand, 3), ...combinations(hand, 4), ...combinations(hand, 5)];
        for (const meld of allCombs) {
            if (this._validateRun(meld, playerIndex)) runs.push(meld);
            else if (this._validateSet(meld, playerIndex)) sets.push(meld);
        }
        return { runs, sets };
    }
    _evaluateHandPotential(hand, playerIndex) {
        let bestEval = { melds: [], score: hand.reduce((s, c) => s + c.getPoints(), 0) };
        const { runs } = this._getAllPossibleMelds(hand, playerIndex);
        const pureRuns = runs.filter(r => this.isPureSequence(r, playerIndex));
        if (pureRuns.length === 0) return bestEval;
        for (const pureRun of pureRuns) {
            let handAfterPureRun = hand.filter(c => !pureRun.includes(c));
            const secondRuns = this._getAllPossibleMelds(handAfterPureRun, playerIndex).runs;
            if (secondRuns.length === 0) continue;
            for (const secondRun of secondRuns) {
                let currentMelds = [pureRun, secondRun];
                let remainingCards = hand.filter(c => !new Set([...pureRun, ...secondRun]).has(c));
                let madeMoreMelds = true;
                while (madeMoreMelds) {
                    madeMoreMelds = false;
                    const { runs: nextRuns, sets: nextSets } = this._getAllPossibleMelds(remainingCards, playerIndex);
                    const bestNextMeld = [...nextRuns, ...nextSets].sort((a,b) => b.length - a.length)[0];
                    if (bestNextMeld) {
                        currentMelds.push(bestNextMeld);
                        remainingCards = remainingCards.filter(c => !bestNextMeld.includes(c));
                        madeMoreMelds = true;
                    }
                }
                const score = remainingCards.reduce((s, c) => s + c.getPoints(), 0);
                if (score < bestEval.score) {
                    bestEval.score = score;
                    bestEval.melds = currentMelds;
                }
            }
        }
        return bestEval;
    }
    executeAiTurn() {
        const player = this.players[this.current_player_index];
        const playerIndex = this.current_player_index;
        if (this.settings.hiddenJoker && !player.hasSeenJoker) {
            if (this._getAllPossibleMelds(player.hand, playerIndex).runs.some(run => this.isPureSequence(run, playerIndex))) {
                player.hasSeenJoker = true;
            }
        }
        let drawnCard = null;
        const discardTop = this.discard_pile.length > 0 ? this.discard_pile[this.discard_pile.length - 1] : null;
        const currentEval = this._evaluateHandPotential(player.hand, playerIndex);
        
        let pickFromDiscard = false;
        if (discardTop && !this.isJoker(discardTop, playerIndex)) {
            const potentialHand = [...player.hand, discardTop];
            const evalWithDiscard = this._evaluateHandPotential(potentialHand, playerIndex);
            if (evalWithDiscard.score < currentEval.score - 5) pickFromDiscard = true;
        }
        if (pickFromDiscard) {
            drawnCard = this.discard_pile.pop();
            this.pickup_log[playerIndex].push(drawnCard);
        } else {
            if (this.stock_pile.length === 0) return { drawn: null, discarded: null };
            drawnCard = this.stock_pile.pop();
        }
        if (drawnCard) player.addCards([drawnCard]);
        else return { drawn: null, discarded: null };

        for (const potentialDiscard of player.hand) {
            const tempHand = player.hand.filter(c => c !== potentialDiscard);
            if(tempHand.length === 13) {
                const finalEval = this._evaluateHandPotential(tempHand, playerIndex);
                if (finalEval.score === 0) {
                     player.melds = finalEval.melds;
                     player.hand = tempHand.filter(c => !player.melds.flat().includes(c));
                     this.endRound(playerIndex, null);
                     return { drawn: drawnCard, discarded: potentialDiscard, declared: true };
                }
            }
        }
        let bestCardToDiscard = null;
        let bestScore = Infinity;
        const nextPlayerIndex = (playerIndex + 1) % this.players.length;
        const nextPlayerPickups = this.pickup_log[nextPlayerIndex] || [];
        for (const potentialDiscard of player.hand) {
            if (this.isJoker(potentialDiscard, playerIndex) && player.hand.some(c => !this.isJoker(c, playerIndex))) continue;
            const tempHand = player.hand.filter(c => c !== potentialDiscard);
            const futureEval = this._evaluateHandPotential(tempHand, playerIndex);
            let score = futureEval.score + potentialDiscard.getPoints();
            for (const pickedCard of nextPlayerPickups) {
                if(pickedCard.suit === potentialDiscard.suit) {
                    if(Math.abs(this.rankMap.get(pickedCard.rank) - this.rankMap.get(potentialDiscard.rank)) < 3) score += 20;
                }
            }
            if (score < bestScore) {
                bestScore = score;
                bestCardToDiscard = potentialDiscard;
            }
        }
        if (!bestCardToDiscard) bestCardToDiscard = player.hand[player.hand.length - 1];
        const discardIndex = player.hand.findIndex(c => c === bestCardToDiscard);
        const discardedCard = player.hand.splice(discardIndex, 1)[0];
        return { drawn: drawnCard, discarded: discardedCard };
    }
    autoMeld(player) {
        const playerIndex = this.players.findIndex(p => p === player);
        const evalResult = this._evaluateHandPotential(player.hand, playerIndex);
        if (evalResult.melds.length > 0) {
            player.melds = evalResult.melds;
            player.hand = player.hand.filter(c => !evalResult.melds.flat().includes(c));
        }
    }
    nextTurn() {
        if (this.turn_state === 'ROUND_OVER') return;
        this.players[this.current_player_index].selectedIndices = [];
        this.current_player_index = (this.current_player_index + 1) % this.players.length;
        this.turn_state = 'DRAW';
    }
    isPureSequence(meld, playerIndex) {
        if (meld.length < 3) return false;
        if (meld.some(card => this.isJoker(card, playerIndex) && card.rank === 'JOKER')) return false;
        const firstCard = meld[0];
        if (meld.every(card => card.rank === firstCard.rank && card.suit === firstCard.suit)) return true;
        const suit = meld[0].suit;
        if (meld.some(card => card.suit !== suit)) return false;
        const ranks = meld.map(c => c.rank);
        if (new Set(ranks).size !== ranks.length) return false;
        const sortedMeld = [...meld].sort((a, b) => this.rankMap.get(a.rank) - this.rankMap.get(b.rank));
        if (this._calculateGaps(sortedMeld, this.rankMap) === 0) return true;
        if (sortedMeld.some(c => c.rank === 'A')) {
            const akqRankMap = new Map(this.rankMap);
            akqRankMap.set('A', 13);
            const akqSortedMeld = [...meld].sort((a, b) => (akqRankMap.get(a.rank) ?? -1) - (akqRankMap.get(b.rank) ?? -1));
            if (this._calculateGaps(akqSortedMeld, akqRankMap) === 0) return true;
        }
        return false;
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
    _validateRun(cards, playerIndex) {
        if (cards.length < 3) return false;
        const jokers = cards.filter(c => this.isJoker(c, playerIndex));
        const nonJokers = cards.filter(c => !this.isJoker(c, playerIndex));
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
    _validateSet(cards, playerIndex) {
        if (cards.length < 3) return false;
        const nonJokers = cards.filter(c => !this.isJoker(c, playerIndex));
        if (nonJokers.length === 0) return true;
        if (cards.length > 4) return false;
        const rank = nonJokers[0].rank;
        if (nonJokers.some(c => c.rank !== rank)) return false;
        const suits = nonJokers.map(c => c.suit);
        return new Set(suits).size === suits.length;
    }
    validateDeclaration(playerIndex) {
        const player = this.players[playerIndex];
        const allMeldedCards = player.melds.flat();
        if (allMeldedCards.length !== 13) {
             return { isValid: false, message: `Declaration must use 13 cards. You have ${allMeldedCards.length}.` };
        }
        let runCount = 0;
        let pureRunCount = 0;
        for (const meld of player.melds) {
            if (meld.length === 0) continue; 
            const isRun = this._validateRun(meld, playerIndex);
            const isSet = this._validateSet(meld, playerIndex);
            if (!isRun && !isSet) return { isValid: false, message: `Invalid group: [${meld.map(c=>c.toString()).join(', ')}]`};
            if (isRun) {
                runCount++;
                if (this.isPureSequence(meld, playerIndex)) pureRunCount++;
            }
        }
        if (runCount < 2) return { isValid: false, message: "You need at least two runs." };
        if (pureRunCount < 1) return { isValid: false, message: "You need at least one pure sequence." };
        return { isValid: true, message: "Valid declaration!" };
    }
}