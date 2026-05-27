import { Resend } from 'resend';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sharprpicks.com';

// Swap to 'Sharpr <noreply@sharprpicks.com>' once domain is verified in Resend
const FROM = 'Sharpr <onboarding@resend.dev>';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function baseLayout(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; background: #0f0f0f; color: #fff; border-radius: 12px; overflow: hidden;">
      <div style="background: #111; padding: 24px 32px; border-bottom: 1px solid #222;">
        <span style="font-size: 20px; font-weight: 900; color: #fff; letter-spacing: -0.5px;">Sharpr</span>
        <span style="font-size: 20px; font-weight: 900; color: #22c55e;">.</span>
      </div>
      <div style="padding: 32px;">
        ${content}
      </div>
      <div style="padding: 20px 32px; border-top: 1px solid #222; text-align: center;">
        <p style="color: #444; font-size: 11px; margin: 0;">
          You're receiving this because you have an account at <a href="${APP_URL}" style="color: #555; text-decoration: none;">sharprpicks.com</a>.
          No purchase necessary to play. Must be 18+. Void where prohibited.
        </p>
      </div>
    </div>
  `;
}

async function send(to: string | string[], subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = getResend();
  const recipients = Array.isArray(to) ? to : [to];
  // Send in batches of 50
  for (let i = 0; i < recipients.length; i += 50) {
    await resend.emails.send({
      from: FROM,
      to: recipients.slice(i, i + 50),
      subject,
      html,
    });
  }
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string) {
  const html = baseLayout(`
    <h1 style="font-size: 26px; font-weight: 900; margin: 0 0 8px;">Welcome to Sharpr, ${username}! 🏆</h1>
    <p style="color: #aaa; margin: 0 0 24px;">You're in. Start competing in survival picking contests — submit picks, survive the rounds, win.</p>

    <div style="background: #1a1a1a; border: 1px solid #222; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <p style="font-weight: 700; color: #fff; margin: 0 0 12px;">How it works:</p>
      <p style="color: #aaa; margin: 0 0 8px;">1. <span style="color: #fff;">Join a contest</span> — browse public contests or use an invite code</p>
      <p style="color: #aaa; margin: 0 0 8px;">2. <span style="color: #fff;">Submit a pick</span> — choose a game and pick a side before the deadline each round</p>
      <p style="color: #aaa; margin: 0;">3. <span style="color: #fff;">Survive &amp; win</span> — last one standing takes the prize</p>
    </div>

    <a href="${APP_URL}/pools" style="display: block; background: #22c55e; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px; margin-bottom: 16px;">
      Browse Contests
    </a>

    <p style="color: #555; font-size: 12px; text-align: center; margin: 0;">
      No purchase necessary. Daily free coins available on your dashboard.
    </p>
  `);

  await send(to, 'Welcome to Sharpr 🏆', html);
}

// ─── New Pool Alert ───────────────────────────────────────────────────────────

export async function sendNewPoolEmail(pool: {
  id: string;
  name: string;
  contest_format: string;
  sport: string;
  target_streak?: number;
  target_wins?: number;
  prize_description?: string;
  entry_fee_cents?: number;
}, recipients: string[]) {
  if (!recipients.length) return;

  const formatLabel: Record<string, string> = {
    classic:     'Classic Survival',
    lives:       'Lives Mode',
    streak_race: `Streak Race (first to ${pool.target_streak} wins in a row)`,
    first_to_x:  `First To ${pool.target_wins} Wins`,
    best_record: 'Best Record',
    team_battle: 'Team Battle',
  };

  const prizeText = pool.prize_description
    ? pool.prize_description
    : pool.entry_fee_cents && pool.entry_fee_cents > 0
    ? `$${(pool.entry_fee_cents / 100).toFixed(2)} entry fee prize pool`
    : 'Bragging Rights';

  const html = baseLayout(`
    <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 4px;">New Contest Alert 🏆</h1>
    <p style="color: #aaa; margin: 0 0 24px;">A new contest just dropped on Sharpr.</p>

    <div style="background: #1a1a1a; border: 1px solid #222; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 12px; color: #fff;">${pool.name}</h2>
      <p style="color: #aaa; margin: 0 0 6px;">Sport: <span style="color: #fff;">${pool.sport}</span></p>
      <p style="color: #aaa; margin: 0 0 6px;">Format: <span style="color: #fff;">${formatLabel[pool.contest_format] ?? pool.contest_format}</span></p>
      <p style="color: #aaa; margin: 0;">Prize: <span style="color: #22c55e; font-weight: 700;">${prizeText}</span></p>
    </div>

    <a href="${APP_URL}/pools/${pool.id}" style="display: block; background: #22c55e; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px;">
      Join Now
    </a>
  `);

  await send(recipients, `New Contest: ${pool.name} 🏆`, html);
}

// ─── Pick Reminder ────────────────────────────────────────────────────────────

export async function sendPickReminderEmail(to: string, opts: {
  username: string;
  poolName: string;
  poolId: string;
  roundNumber: number;
  deadlineEt: string; // formatted string e.g. "Tonight at 9:30 PM ET"
}) {
  const html = baseLayout(`
    <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 8px;">⚠️ Pick Reminder</h1>
    <p style="color: #aaa; margin: 0 0 24px;">Hey ${opts.username}, you haven't submitted your pick yet for <strong style="color: #fff;">${opts.poolName}</strong>.</p>

    <div style="background: #1a1a1a; border: 1px solid #f59e0b44; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
      <p style="color: #f59e0b; font-weight: 700; margin: 0 0 8px;">Round ${opts.roundNumber} Deadline</p>
      <p style="color: #fff; font-size: 18px; font-weight: 800; margin: 0;">${opts.deadlineEt}</p>
      <p style="color: #aaa; font-size: 13px; margin: 8px 0 0;">Missing this deadline means an automatic loss in most formats.</p>
    </div>

    <a href="${APP_URL}/pools/${opts.poolId}" style="display: block; background: #f59e0b; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px;">
      Submit My Pick Now
    </a>
  `);

  await send(to, `⚠️ Submit your pick — ${opts.poolName} Round ${opts.roundNumber}`, html);
}

// ─── Round Results ────────────────────────────────────────────────────────────

export async function sendRoundResultsEmail(to: string, opts: {
  username: string;
  poolName: string;
  poolId: string;
  roundNumber: number;
  pickResult: 'won' | 'lost' | 'push' | 'void';
  pickDescription: string; // e.g. "Over 217.5 — Spurs @ Thunder"
  stillAlive: boolean;
  eliminatedCount: number;
  survivorsLeft: number;
}) {
  const isWin = opts.pickResult === 'won';
  const isPush = opts.pickResult === 'push' || opts.pickResult === 'void';
  const resultColor = isWin ? '#22c55e' : isPush ? '#60a5fa' : '#ef4444';
  const resultLabel = isWin ? '✅ Won' : isPush ? '🔄 Push' : '❌ Lost';
  const statusMsg = opts.stillAlive
    ? `You're still alive. <strong style="color: #22c55e;">${opts.survivorsLeft} survivor${opts.survivorsLeft !== 1 ? 's' : ''} remaining.</strong>`
    : `You've been eliminated. Better luck next time!`;

  const html = baseLayout(`
    <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 4px;">Round ${opts.roundNumber} Results</h1>
    <p style="color: #aaa; margin: 0 0 24px;">${opts.poolName}</p>

    <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
      <p style="color: #aaa; font-size: 13px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.05em;">Your Pick</p>
      <p style="color: #fff; font-weight: 700; margin: 0 0 12px;">${opts.pickDescription}</p>
      <span style="background: ${resultColor}22; color: ${resultColor}; font-weight: 800; font-size: 18px; padding: 6px 16px; border-radius: 6px; border: 1px solid ${resultColor}44;">
        ${resultLabel}
      </span>
    </div>

    <div style="background: #1a1a1a; border: 1px solid #222; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
      <p style="color: #aaa; margin: 0 0 4px; font-size: 13px;">${opts.eliminatedCount} player${opts.eliminatedCount !== 1 ? 's' : ''} eliminated this round.</p>
      <p style="color: #ccc; margin: 0;" dangerouslySetInnerHTML={{ __html: "${statusMsg}" }}></p>
      <p style="color: #ccc; margin: 0;">${statusMsg}</p>
    </div>

    <a href="${APP_URL}/pools/${opts.poolId}" style="display: block; background: #22c55e; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px;">
      View Contest
    </a>
  `);

  await send(to, `Round ${opts.roundNumber} results — ${opts.poolName}`, html);
}

// ─── Winner Announcement ──────────────────────────────────────────────────────

export async function sendWinnerEmail(to: string, opts: {
  username: string;
  poolName: string;
  poolId: string;
  isWinner: boolean;
  winnerUsername: string;
  finalRecord: string; // e.g. "7W-2L"
}) {
  const html = opts.isWinner
    ? baseLayout(`
        <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px;">🏆 You Won!</h1>
        <p style="color: #aaa; margin: 0 0 24px;">Congratulations ${opts.username} — you're the last survivor in <strong style="color: #fff;">${opts.poolName}</strong>!</p>

        <div style="background: linear-gradient(135deg, #22c55e22, #16a34a22); border: 1px solid #22c55e44; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="font-size: 48px; margin: 0 0 8px;">🏆</p>
          <p style="font-size: 22px; font-weight: 900; color: #22c55e; margin: 0 0 4px;">${opts.username}</p>
          <p style="color: #aaa; margin: 0;">Final record: <strong style="color: #fff;">${opts.finalRecord}</strong></p>
        </div>

        <a href="${APP_URL}/pools/${opts.poolId}" style="display: block; background: #22c55e; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px; margin-bottom: 12px;">
          View Results
        </a>
        <a href="${APP_URL}/pools" style="display: block; background: #1a1a1a; color: #aaa; font-weight: 700; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-size: 14px; border: 1px solid #333;">
          Join Another Contest
        </a>
      `)
    : baseLayout(`
        <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 8px;">Contest Over</h1>
        <p style="color: #aaa; margin: 0 0 24px;"><strong style="color: #fff;">${opts.poolName}</strong> has ended.</p>

        <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #aaa; margin: 0 0 4px; font-size: 13px;">Winner</p>
          <p style="font-size: 20px; font-weight: 800; color: #f59e0b; margin: 0;">🏆 ${opts.winnerUsername}</p>
          <p style="color: #aaa; margin: 8px 0 0; font-size: 13px;">Your final record: <strong style="color: #fff;">${opts.finalRecord}</strong></p>
        </div>

        <a href="${APP_URL}/pools" style="display: block; background: #22c55e; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px;">
          Join Another Contest
        </a>
      `);

  const subject = opts.isWinner
    ? `🏆 You won ${opts.poolName}!`
    : `${opts.poolName} has ended — ${opts.winnerUsername} wins`;

  await send(to, subject, html);
}
