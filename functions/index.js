import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Allow calls from the live Firebase Hosting sites (scorekeeper +
// multiplayer), the legacy GitHub Pages mirror, and local dev.
// NOTE: when the apps moved from GitHub Pages to *.web.app this list
// wasn't updated, so production calls were CORS-rejected and users only
// ever saw the deterministic fallback sentences.
const ALLOWED_ORIGINS = [
  'https://wizard-scorekeeper.web.app',
  'https://wizard-scorekeeper.firebaseapp.com',
  'https://wizard-multiplayer.web.app',
  'https://wizard-multiplayer.firebaseapp.com',
  'https://jr-canest.github.io',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'http://localhost:5181',
  'http://127.0.0.1:5181',
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

    // Optional richer signals (multiplayer fills these in from per-round logs).
    const bestRound = data.bestSingleRound;
    const worstRound = data.worstSingleRound;
    const mostExact = data.mostExactBids;
    const mostMissed = data.mostMissedBids;
    const finalRoundLeader = data.finalRoundLeader;

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
      bestRound && bestRound.delta >= 20
        ? `Biggest single-round haul: ${bestRound.name} scored ${bestRound.delta > 0 ? '+' : ''}${bestRound.delta} in round ${bestRound.round}.`
        : null,
      worstRound && worstRound.delta <= -20
        ? `Worst single-round bust: ${worstRound.name} scored ${worstRound.delta} in round ${worstRound.round}.`
        : null,
      mostExact && mostExact.count >= 2
        ? `Most exact bids: ${mostExact.name} nailed ${mostExact.count} rounds clean.`
        : null,
      mostMissed && mostMissed.count >= 2
        ? `Most busted bids: ${mostMissed.name} missed ${mostMissed.count} rounds.`
        : null,
      finalRoundLeader && (data.roundCount ?? 0) >= 2
        ? `Final round MVP: ${finalRoundLeader.name} (${finalRoundLeader.delta > 0 ? '+' : ''}${finalRoundLeader.delta}).`
        : null,
      typeof data.wizardsPlayed === 'number' && typeof data.jestersPlayed === 'number'
        ? `Wizards played: ${data.wizardsPlayed}. Jesters played: ${data.jestersPlayed}.`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    // A different narrator voice each game keeps recaps from converging
    // on the same shape. Picked here (not by the model) so it's truly
    // random game to game.
    const VOICES = [
      'a smug tavern bard who has seen a thousand card nights and is only mildly impressed',
      'an over-caffeinated arena commentator calling the final seconds',
      'a dry, unimpressed wizard-school examiner filling in the class report',
      'a royal court herald making an official (slightly petty) proclamation',
      'a nature-documentary narrator observing wizards in their natural habitat',
      'a fortune teller reviewing which of tonight\'s prophecies actually came true',
      'a sports-radio host doing the morning-after post-game breakdown',
      'a wizened innkeeper recounting the night to a regular who missed it',
      'a quill-scratching royal historian recording the match for the archives',
      'a gossip columnist for the Wizard\'s Weekly society pages',
    ];
    const voice = VOICES[Math.floor(Math.random() * VOICES.length)];

    const prompt = `Write the post-game recap for a game of Wizard — a trick-taking card game where players bid how many tricks they'll take, score big for hitting the bid exactly, lose points for missing. 60 cards: standard deck plus 4 Wizards (auto-win a trick) and 4 Jesters (auto-lose). The dealer bids last. Canadian rules (optional) force the dealer's bid to break the total.

${context}

Write in the voice of ${voice}. Never name or announce the persona ("as a bard…") — just let it color the word choice and attitude.

This is a ROAST, and it should be dripping with puns. Work in at least two groan-worthy wizard/card puns — wordplay on trick, trump, bid, charm, wand, spellbook, conjure, "no trick pony", "bid farewell", "trumped up" — the cornier the better, commit to them shamelessly. Be merciless with the numbers: roast the biggest bust AND the bottom of the table by name, give the winner at most a backhanded compliment ("congratulations, barely"), and let the actual stats land the punchlines. This recap is for the table — they know the game, so be knowing: read the story in the stats (a blowout, a nail-biter, a comeback, a chaotic mess, a collective meltdown) and commit to that story. Lean on the single juiciest specific stat above (a +50 round, a serial overbidder, a razor-thin margin) instead of generic adjectives. Aim for the recap someone reads out loud and the whole table groans, then laughs, then someone demands a rematch.

Use real Wizard lingo naturally (bids, tricks, trump, Wizards, Jesters, overbid, busted, nailed it) with light magic flavor. Keep the fantasy friendly — Gandalf / Wizard of Oz energy, nothing dark: no curses, hexes, death, doom, or dark magic. "Misfire", "fumble", "spell gone wrong" are the vibe for failure.

HARD RULES:
- Use ONLY the stats above. Never invent numbers, streaks, or drama not in the data.
- Shame points: only mention shame for players explicitly listed as shamed above. Zero shame = never imply it.
- Mention EVERY player by name at least once — mid-table players get at least a quick jab or shoutout.
- Wrap each player name's first appearance in HTML <b>Name</b> tags, e.g. <b>Alice</b>. NEVER markdown bold (**Alice** renders as literal asterisks).
- Output ONLY the recap: no title, no markdown, no quotes around it, no preamble.
- One paragraph, 2-4 sentences, 50-85 words. Shorter and sharper beats longer.
- Never use "they" or "their" — names only.
- Do not open with "In a…", "What a…", "Tonight…", or a restatement that a game of Wizard was played — start mid-story or with the most surprising number.`;

    let text;
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 300,
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
