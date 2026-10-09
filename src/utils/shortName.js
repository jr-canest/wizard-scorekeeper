/**
 * A name short enough for a tight spot (the replay chart labels). Names can
 * be 20 characters ("jake thewizardwinner", 2026-10-09), which ran off the
 * card. A long name shows its first word instead, unless another player
 * shares that first word; whatever is still longer than `max` is cut with an
 * ellipsis. Twin of wizard-multiplayer's src/lib/shortName.ts.
 */
export function shortName(name, all, max = 10) {
  if (name.length <= max) return name;
  const first = (s) => s.trim().split(/\s+/)[0];
  const word = first(name);
  const clashes = all.some(
    (o) => o !== name && first(o).toLowerCase() === word.toLowerCase(),
  );
  const base = word.length >= 2 && !clashes ? word : name;
  return base.length <= max ? base : `${base.slice(0, max - 1).trimEnd()}…`;
}
