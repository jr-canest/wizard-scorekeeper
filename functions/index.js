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

    const prompt = `You're the smack-talking friend at a Wizard card game giving a recap after the final trick. Wizard is a trick-taking card game:
- 60-card deck: standard 52 + 4 Wizards (auto-win any trick) + 4 Jesters (auto-lose any trick)
- Round 1 deals 1 card, round 2 deals 2, etc — hand sizes grow
- Before each round, every player BIDS how many tricks they'll win
- Exact bid = 20 + 10 per trick won. Miss by anything = -10 per trick off the bid
- Dealer bids LAST, which is a curse (you know everyone else's bid before yours)
- Canadian rules (optional): dealer can't bid a number that makes the totals match — forces someone to overbid or underbid
- Trump suit is flipped from the top of the deck each round (Wizard flipped = dealer picks, Jester flipped = no trump)
- "Overbid" = total bids > tricks available. "Underbid" = total < tricks. Either way, somebody's missing.

${context}

Write a 2-3 sentence recap. First sentence or two: the main story (who won, how, the roast). Last sentence: a twist — a callout on a specific player, a dry observation, a question, a burn. Under 55 words total.

Lean HEAVY on actual Wizard lingo: bids, overbids, underbids, tricks, trump, Wizards (the cards), Jesters, the dealer's curse, flipped trump, cards dealt, "nailed it," "busted the bid," "trumped," "sandbagged," "stuck with the Jester."

Style examples (match THIS game's stats, don't copy the words):

Dominance:
"<b>Alice</b> nailed every single bid like the trump flip was rigged in her favor. <b>Bob</b> and <b>Carl</b> are still arguing about whose overbid lost Round 7. Somebody check <b>Alice</b>'s sleeve for Wizards."

Close:
"One busted bid in Round 9 was all it took — <b>Alice</b> wins by 10 while <b>Bob</b> replays that Jester lead in his nightmares. <b>Carl</b>'s 5 lead changes prove nobody had any idea who was winning."

Comeback:
"<b>Alice</b> was dead and buried in 4th through Round 6, then apparently remembered how to count trumps. <b>Bob</b>'s 100-point lead is now a cautionary tale. <b>Carl</b> went from ruler to footnote in three rounds flat."

Chaotic:
"Seven lead changes. Nine missed bids. Nobody could read the trump. <b>Alice</b> backed into victory because everyone else was busy trumping each other out of existence. Was this even Wizard?"

Bloodbath (negatives):
"Three players finished in the red — apparently bidding is hard. <b>Alice</b> wins by not being the disaster. <b>Bob</b> took -80 and a shame point; maybe sit the next one out."

Shame points:
"<b>Bob</b> earned 3 shame points for confidently bidding 5 and taking 1 — twice. <b>Alice</b> wins the crown, but <b>Bob</b> wins the story of the night."

Rules:
- 2-3 sentences. Under 55 words total.
- Bold EVERY name: <b>Name</b>
- Never say "they" or "their" — names only.
- Use the real stats (margin, lead changes, shame count, rank climbed from, round count, player count).
- USE WIZARD LINGO liberally — bids, tricks, trumps, Wizards, Jesters, dealer, overbid, underbid, busted, nailed.
- Be FUNNY. Dry, sharp, teasing. Not flowery, not fantasy-novel, not a sportscaster.
- No preamble, no quotes, no markdown besides <b>. Output only the recap.`;

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
