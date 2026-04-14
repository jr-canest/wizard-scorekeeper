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

    const playerLines = sorted
      .map((p) => {
        const shame = p.shamePoints ? ` (${p.shamePoints} shame)` : '';
        return `  ${p.rank}. ${p.name}: ${p.score}${shame}`;
      })
      .join('\n');

    const context = [
      `Wizard card game just ended. ${data.roundCount ?? '?'} rounds, ${players.length} players.`,
      `Final standings:`,
      playerLines,
      `Winning margin: ${margin} points.`,
      data.leadChanges != null ? `Lead changes during game: ${data.leadChanges}.` : null,
      data.comebackRank ? `Winner was in ${nth(data.comebackRank)} place at their lowest point.` : null,
      data.negativeCount ? `${data.negativeCount} players finished with negative scores.` : null,
      data.canadianRules ? `Canadian rules were on (dealer restriction).` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `You're writing a funny recap for a game of Wizard — a trick-taking card game where players bid how many tricks they'll take, score big for hitting it exact, lose points for missing. 60 cards: standard deck plus 4 Wizards (auto-win a trick) and 4 Jesters (auto-lose). The dealer bids last. Canadian rules (optional) force the dealer's bid to break the total.

${context}

Write a 2-3 sentence recap based on what actually happened in THIS game. The story might be a dominance blowout, a close nail-biter, a comeback from behind, chaos with many lead changes, or a bloodbath where everyone went negative. Call out shame points when they happened. Use the real numbers from the stats above.

Mix the actual Wizard card game lingo (bids, tricks, trump, Wizards, Jesters, dealer's curse, overbid, underbid, busted, nailed) with fun wizard and magic flavor (spells, prophecies, crowns, curses, spellbound). Both should feel natural together.

Style: under 55 words, funny, a little roast-y, specific to the game. Bold every name with <b>Name</b>. Never use "they" or "their" — say names directly. No preamble or quotes — just the recap.`;

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
