import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

initializeApp();

// Recap memory: the last few recaps (both apps), so each new one is told
// not to reuse their jokes. Without it every game started from zero and
// the model kept landing on the same lines (Jorge, 2026-09-25: "one trick
// pony", "barely" and others on repeat). One small doc, admin-only (no
// client rule needed); a failed read or write never blocks a recap.
// Lines the table has heard every game. The prompt bans them and a
// recap that still uses one (or runs long) gets one quick rewrite pass.
const WORN_LINES = [
  'one trick pony', 'no trick pony', 'pony', 'barely', 'congratulations', 'bid farewell',
  'trumped up', 'up the sleeve', 'up his sleeve', 'up her sleeve', 'spell gone wrong', 'misfire',
  'fumble', 'crater', 'crystal ball', 'abracadabra', 'hocus pocus', 'wand-erful', 'spellbound',
  'quick list',
];
const MAX_RECAP_WORDS = 62;
const plainWords = (html) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean);
const wornIn = (html) => {
  const t = html.replace(/<[^>]+>/g, ' ').toLowerCase();
  return WORN_LINES.filter((w) => t.includes(w));
};

const RECAP_MEMORY_DOC = 'recapMemory/recent';
const RECAP_MEMORY_SIZE = 8;

async function readRecentRecaps() {
  try {
    const snap = await getFirestore().doc(RECAP_MEMORY_DOC).get();
    const items = snap.exists ? snap.get('items') : null;
    return Array.isArray(items) ? items.map((i) => String(i.text || '')).filter(Boolean) : [];
  } catch (err) {
    console.warn('generateGameSummary: recap memory read failed', err?.message || err);
    return [];
  }
}

async function rememberRecap(text) {
  try {
    const ref = getFirestore().doc(RECAP_MEMORY_DOC);
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const items = snap.exists && Array.isArray(snap.get('items')) ? snap.get('items') : [];
      const plain = text.replace(/<[^>]+>/g, '');
      tx.set(ref, { items: [...items, { text: plain, at: Date.now() }].slice(-RECAP_MEMORY_SIZE) });
    });
  } catch (err) {
    console.warn('generateGameSummary: recap memory write failed', err?.message || err);
  }
}

// True once this instance has served a request — lets the logs say
// whether a slow recap was a cold start.
let warmed = false;

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

    // Pre-warm ping. The client sends this when the table declares the
    // last round, so the real game-over call lands on an instance that
    // is already up (a cold start is 2-6 s on top of the API call).
    if (data.warmup) {
      const cold = !warmed;
      warmed = true;
      return { ok: true, cold };
    }

    const players = Array.isArray(data.players) ? data.players : [];

    if (players.length === 0) {
      throw new HttpsError('invalid-argument', 'players array is required');
    }

    const cold = !warmed;
    warmed = true;

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
      data.comebackRank
        ? `Winner's lowest position during the game: ${nth(data.comebackRank)} of ${players.length}${data.comebackRank >= players.length ? ' (dead last)' : ''}.`
        : null,
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

    // How the recap opens, also picked at random: left to itself the model
    // opened every recap the same way.
    const OPENINGS = [
      'Open with the single most surprising number in the stats.',
      'Open on the bottom of the table, then work up to the winner.',
      'Open on the winner, then take the crown down a peg.',
      'Open like a one-line newspaper headline, then the story.',
      'Open with the moment the game turned (a big round, a bust, a lead change) if the stats show one; otherwise the closest race on the board.',
      'Open with a mock-solemn observation about the table as a whole.',
      'Open with the mid-table players, the ones who usually get skipped.',
      'Open with a short question to the table, then answer it with the stats.',
    ];
    const opening = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];

    const recent = await readRecentRecaps();
    const recentBlock = recent.length
      ? `\nRECENT RECAPS (other games, for contrast only). Do NOT reuse their jokes, puns, openings, sentence shapes or distinctive words:\n${recent.map((r) => `- ${r}`).join('\n')}\n`
      : '';

    const prompt = `LENGTH: about 40 words, never more than 60. Three short sentences. Mid-table players can be named together with their scores in one short run instead of a clause each (no label like "quick list").

Write the post-game recap for a game of Wizard — a trick-taking card game where players bid how many tricks they'll take, score big for hitting the bid exactly, lose points for missing. 60 cards: standard deck plus 4 Wizards (auto-win a trick) and 4 Jesters (auto-lose). The dealer bids last. Canadian rules (optional) force the dealer's bid to break the total.

${context}

Write in the voice of ${voice}. Never name or announce the persona ("as a bard…") — just let it color the word choice and attitude.

${opening}

This is a ROAST with at least one groan-worthy pun on the game itself (tricks, trump, bids, Wizards, Jesters, the deal, the deck), two if they fit. Invent a fresh one for THIS game from its own names and numbers; do not reach for a stock card-game pun. Be merciless with the numbers: roast the biggest bust AND the bottom of the table by name, give the winner a backhanded compliment in your own words (and not always "it was just luck": pick on how the win happened in THIS game's stats), and let the actual stats land the punchlines. Quick jabs beat full sentences for the mid-table. This recap is for the table — they know the game, so be knowing: read the story in the stats (a blowout, a nail-biter, a comeback, a chaotic mess, a collective meltdown) and commit to that story. Lean on the single juiciest specific stat above (a +50 round, a serial overbidder, a razor-thin margin) instead of generic adjectives. Aim for the recap someone reads out loud and the whole table groans, then laughs, then someone demands a rematch.

Use real Wizard lingo naturally (bids, tricks, trump, Wizards, Jesters, overbid, busted, nailed it) with light magic flavor. Keep the fantasy friendly — Gandalf / Wizard of Oz energy, nothing dark: no curses, hexes, death, doom, or dark magic. Failure is clumsy and comic, never grim.
${recentBlock}

HARD RULES:
- Use ONLY the stats above. Never invent numbers, streaks, or drama not in the data.
- Shame points: only mention shame for players explicitly listed as shamed above. Zero shame = never imply it.
- Mention EVERY player by name at least once; mid-table players can get a few words, not a sentence.
- Wrap each player name's first appearance in HTML <b>Name</b> tags, e.g. <b>Alice</b>. NEVER markdown bold (**Alice** renders as literal asterisks).
- Output ONLY the recap: no title, no markdown, no quotes around it, no preamble.
- One paragraph, about 40 words (never over 60). Shorter and sharper beats longer: this is read on a phone at the table.
- No pronouns for players at all (he, she, him, her, his, they, them, their): repeat the name or restructure the sentence.
- Describe positions accurately: with ${players.length} players, only ${nth(players.length)} place is "last" — never call any other position "last", "dead last", or "the bottom".
- Do not open with "In a…", "What a…", "Tonight…", or a restatement that a game of Wizard was played.
- Worn out, NEVER use (the table has heard them every game): ${WORN_LINES.map((w) => `"${w}"`).join(', ')}. Also never the "less X, more Y" construction.`;

    let text;
    try {
      const apiStart = Date.now();
      const message = await client.messages.create({
        model: 'claude-sonnet-5',
        // Sonnet 5 runs adaptive thinking by default, and those tokens
        // count against max_tokens. At the default (high) effort it spent
        // hundreds to thousands of tokens reasoning about an 80-word roast
        // before writing a word — the main reason recaps blew past the
        // client's 15 s watchdog. Low effort keeps thinking near zero for
        // a task this size; 1500 stays as headroom in case it does think.
        max_tokens: 1500,
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: prompt }],
      });
      // One line per recap so slow games can be diagnosed in the Firebase
      // logs: cold start or not, API round trip, and how many output
      // tokens (thinking + text) the model produced.
      console.info(
        `generateGameSummary: ${cold ? 'cold' : 'warm'} instance, api ${Date.now() - apiStart}ms, ` +
        `output_tokens ${message.usage?.output_tokens ?? '?'}, stop ${message.stop_reason}`
      );
      if (message.stop_reason === 'max_tokens') {
        console.warn('generateGameSummary: hit max_tokens, recap may be truncated');
      }
      text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();
    } catch (err) {
      console.error('Anthropic API error:', err?.message || err, err?.status ?? '');
      throw new HttpsError('internal', 'Failed to generate summary');
    }

    if (!text) {
      throw new HttpsError('internal', 'Empty response from model');
    }

    // Strip wrapping quotes if the model added them
    text = text.replace(/^["']|["']$/g, '').trim();

    // Safety net: one fast rewrite when the recap runs long or still uses
    // a worn line. The model does not count words reliably at low effort.
    const words = plainWords(text).length;
    const worn = wornIn(text);
    if (words > MAX_RECAP_WORDS || worn.length) {
      try {
        const fixStart = Date.now();
        const fix = await client.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 800,
          output_config: { effort: 'low' },
          messages: [{
            role: 'user',
            content: `This game recap is ${words} words; it must be 55 words or fewer, so cut at least ${words - 55} words by deleting the weakest phrases (do not add anything new). Keep every player's name wrapped in <b></b> exactly as it is, keep the facts and numbers, keep the funniest joke, keep one paragraph.${worn.length ? ` Remove these worn phrases entirely: ${worn.map((w) => `"${w}"`).join(', ')}.` : ''} No pronouns for players (he, she, his, her, they, their). Output ONLY the rewritten recap.\n\n${text}`,
          }],
        });
        const fixed = fix.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim().replace(/^["']|["']$/g, '').trim();
        console.info(`generateGameSummary: rewrite pass (${words} words, worn [${worn.join(', ')}]) → ${plainWords(fixed).length} words, ${Date.now() - fixStart}ms`);
        if (fixed && plainWords(fixed).length < words + 5) text = fixed;
      } catch (err) {
        console.warn('generateGameSummary: rewrite pass failed, keeping the first recap', err?.message || err);
      }
    }

    await rememberRecap(text);

    return { summary: text };
  }
);

function nth(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
