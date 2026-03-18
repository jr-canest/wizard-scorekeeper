import { DECK_SIZE } from './constants';

export function getMaxRounds(numPlayers) {
  return Math.floor(DECK_SIZE / numPlayers);
}

export function getCardsForRound(roundIndex, maxRounds) {
  // Rounds go 1, 2, 3, ..., maxRounds, maxRounds, maxRounds, ...
  return Math.min(roundIndex + 1, maxRounds);
}

export function getDealerIndex(roundIndex, firstDealerIndex, numPlayers) {
  return (firstDealerIndex + roundIndex) % numPlayers;
}

export function getBiddingOrder(dealerIndex, players) {
  const order = [];
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    order.push(players[(dealerIndex + i) % n]);
  }
  return order;
}

export function getRestrictedBid(cardsDealt, bidsArray, canadianRules, isDealer, roundNumber) {
  if (!canadianRules || !isDealer || roundNumber === 1) {
    return null;
  }
  const totalBidsSoFar = bidsArray.reduce((sum, b) => sum + b, 0);
  const restricted = cardsDealt - totalBidsSoFar;
  if (restricted >= 0 && restricted <= cardsDealt) {
    return restricted;
  }
  return null;
}
