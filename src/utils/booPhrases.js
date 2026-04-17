// Fun shame-point announcements. {NAME} is replaced with the shamed player's name (uppercased).
// Kept intentionally short so they fit on a phone screen in big letters.

const PHRASES = [
  'BOOOO, {NAME}!',
  'SHAME ON {NAME}!',
  'BOO BOO {NAME}!',
  '{NAME}, WHAT WAS THAT?!',
  '{NAME} GETS THE DUNCE CAP 🎩',
  'EVEN THE JESTERS ARE LAUGHING, {NAME}',
  '{NAME}, THAT HURT TO WATCH',
  'DEALER CURSE STRIKES {NAME}!',
  'YOU BUSTED THAT BID, {NAME}!',
  '{NAME} JUST BROKE THE PROPHECY',
  'THE WIZARDS ARE EMBARRASSED BY {NAME}',
  '{NAME}, GO SIT WITH THE JESTERS',
  'SHAAAME! SHAAAAME! {NAME}!',
  '{NAME} FUMBLED THE TRUMP',
  'BOOOO {NAME}, BOOOO!',
  '{NAME} EARNED THAT SHAME POINT',
  'THE CROWD TURNS ON {NAME}',
  '{NAME}, YOUR WAND IS BROKEN',
  'PACK IT UP, {NAME}',
  '{NAME} DID A WHOOPSIE',
  'TELL ME HOW, {NAME}, TELL ME HOW',
  '{NAME} NEEDS A NEW DECK',
  'THE JESTER LIVES IN {NAME} NOW',
  '{NAME} IS CURSED THIS ROUND',
  'NOT LIKE THAT, {NAME}!',
];

export function getBooPhrase(name) {
  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  return phrase.replace('{NAME}', (name || 'PLAYER').toUpperCase());
}
