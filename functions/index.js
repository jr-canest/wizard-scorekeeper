import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Allow calls from the live GitHub Pages site and local dev
const ALLOWED_ORIGINS = [
  'https://jr-canest.github.io',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
];

/**
 * Generate a funny wizard-themed game summary via Claude.
 *
 * Expected data:
 * {
 *   players: [{ name, score, rank, shamePoints }],
 *   roundCount: number,
 *   canadianRules: boolean,
 *   leadChanges: number,        // how many times the #1 spot flipped during the game
 *   biggestLead: number,        // max score gap between 1st and 2nd over the game
 *   comebackRank: number|null,  // winner's worst rank during the game (null if led throughout)
 *   negativeCount: number,      // how many players finished with negative score
 * }
 *
 * Returns: { summary: "<string with <b>name</b> tags>" }
 */
export const generateGameSummary = onCall(
  {
    region: 'us-central1',
    secrets: [ANTHROPIC_API_KEY],
    cors: ALLOWED_ORIGINS,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  async (request) => {
    const data = request.data || {};
    const players = Array.isArray(data.players) ? data.players : [];

    if (players.length === 0) {
      throw new HttpsError('invalid-argument', 'players array is required');
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const sorted = [...players].sort((a, b) => a.rank - b.rank);
    const winnerScore = sorted[0]?.score ?? 0;
    const runnerUpScore = sorted[1]?.score ?? 0;
    const margin = winnerScore - runnerUpScore;

    // Always show the shame count explicitly — 0 included — so the model
    // cannot hallucinate shame on players who didn't get any this game.
    const playerLines = sorted
      .map((p) => {
        const shame = p.shamePoints || 0;
        return `  ${p.rank}. ${p.name}: ${p.score} points, ${shame} shame point${shame === 1 ? '' : 's'} this game`;
      })
      .join('\n');

    const shamedPlayers = sorted.filter((p) => (p.shamePoints || 0) > 0);
    const shameSummary = shamedPlayers.length === 0
      ? 'NO player received any shame points this game. Do NOT invent or imply shame points.'
      : `Shamed this game: ${shamedPlayers.map((p) => `${p.name} (${p.shamePoints})`).join(', ')}. Every other player had ZERO shame — do not mention shame for anyone not in this list.`;

    const context = [
      `Wizard card game just ended. ${data.roundCount ?? '?'} rounds, ${players.length} players.`,
      `Final standings (scores + shame counts are from THIS game only):`,
      playerLines,
      `Winning margin: ${margin} points.`,
      shameSummary,
      data.leadChanges != null ? `Lead changes during game: ${data.leadChanges}.` : null,
      data.comebackRank ? `Winner was in ${nth(data.comebackRank)} place at their lowest point.` : null,
      data.negativeCount ? `${data.negativeCount} players finished with negative scores.` : null,
      data.canadianRules ? `Canadian rules were on (dealer restriction).` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `You're writing a funny recap for a game of Wizard — a trick-taking card game where players bid how many tricks they'll take, score big for hitting it exact, lose points for missing. 60 cards: standard deck plus 4 Wizards (auto-win a trick) and 4 Jesters (auto-lose). The dealer bids last. Canadian rules (optional) force the dealer's bid to break the total.

${context}

Write a 2-3 sentence recap based ONLY on what actually happened in THIS game (the stats above). The story might be a dominance blowout, a close nail-biter, a comeback from behind, a chaotic mess with many lead changes, or a meltdown where everyone went negative. Use the real numbers from the stats above — do not invent stats, shame points, or drama that isn't in the data.

CRITICAL: Only mention a player's shame points if the stats above explicitly list them as having shame this game. If the stats say "0 shame points this game" for a player, that player was NOT shamed — do not imply otherwise.

Mix the actual Wizard card game lingo (bids, tricks, trump, Wizards, Jesters, overbid, underbid, busted, nailed) with fun wizard and magic flavor (spells, prophecies, crowns, enchantments, spellbound, wands, potions, wizard's hat, wizard towers, fireworks). Both should feel natural together.

TONE / CONTENT (important): keep it friendly-fantasy — Gandalf / Harry Potter / Wizard of Oz vibes. AVOID anything demonic, satanic, occult, dark arts, evil, cursed, hexed, death, blood, sacrifice, shadow realm, underworld, grim, tormented, damned, etc. No "dealer's curse", no "cursed", no skulls in the text, no "dark magic". Keep it playful and wholesome — this is a game night with friends, not a horror movie. "Bad luck", "off night", "misfire", "fumble", "spell gone wrong" are fine. If you reach for a word and it feels dark, pick something cheerful instead.

IMPORTANT: mention EVERY player by name at least once — no player should be left out of the recap. Even the middle-of-the-pack ones get a callout, a tease, or a one-word shoutout.

FORMATTING RULES (strict):
- Wrap each player name's first appearance in HTML <b>Name</b> tags. Example: <b>Alice</b>. NEVER use markdown bold like **Alice** — it will render as literal asterisks.
- Output ONLY the recap text. No headers, no titles, no markdown (# or ## or ---), no bullet points, no quotes around the whole thing, no preamble like "Here's the recap:".
- One flowing paragraph of 2-3 sentences, under 65 words total.
- Never use "they" or "their" — say names directly.

Style: funny, a little roast-y, specific to the game.`;

    let text;
    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        temperature: 1,
        messages: [{ role: 'user', content: prompt }],
      });
      text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
    } catch (err) {
      console.error('Anthropic API error:', err);
      throw new HttpsError('internal', 'Failed to generate summary');
    }

    if (!text) {
      throw new HttpsError('internal', 'Empty response from model');
    }

    // Strip wrapping quotes if the model added them
    text = text.replace(/^["']|["']$/g, '').trim();

    return { summary: text };
  }
);

function nth(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
