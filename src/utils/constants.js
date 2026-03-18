export const SUITS = {
  spades: { name: 'Spades', symbol: '♠', color: '#e5e7eb' },
  hearts: { name: 'Hearts', symbol: '♥', color: '#ef4444' },
  diamonds: { name: 'Diamonds', symbol: '♦', color: '#3b82f6' },
  clubs: { name: 'Clubs', symbol: '♣', color: '#22c55e' },
};

export const SUIT_ORDER = ['spades', 'hearts', 'diamonds', 'clubs'];

export const NO_TRUMP = 'none';

export const DECK_SIZE = 60;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

export const PHASES = {
  PREROUND: 'preround',
  TRUMP: 'trump',
  BIDDING: 'bidding',
  TRICKS: 'tricks',
  SCORED: 'scored',
};

export const STORAGE_KEY = 'wizard-scorekeeper-state';
