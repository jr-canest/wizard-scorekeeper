import { DECK_SIZE } from './constants';

export function getMaxRounds(numPlayers) {
  return Math.floor(DECK_SIZE / numPlayers);
}

export function getCardsForRound(roundIndex, maxRounds, roundDirection) {
  if (roundDirection === 'ascending') {
    return roundIndex + 1;
  }
  // ascending_descending: 1,2,...,max,...,2,1
  if (roundIndex < maxRounds) {
    return roundIndex + 1;
  }
  // descending phase
  return 2 * maxRounds - roundIndex - 1;
}

export function getTotalRounds(maxRounds, roundDirection) {
  if (roundDirection === 'ascending') {
    return maxRounds;
  }
  // ascending_descending: max rounds up + (max-1) rounds down = 2*max - 1
  return 2 * maxRounds - 1;
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

export function isNaturalNoTrumpRound(roundIndex, maxRounds, roundDirection) {
  const cards = getCardsForRound(roundIndex, maxRounds, roundDirection);
  const maxCards = maxRounds;
  return cards === maxCards;
}
