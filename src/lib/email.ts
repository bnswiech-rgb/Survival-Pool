import { Resend } from 'resend';

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

  const joinUrl = `https://sharprpicks.com/pools/${pool.id}`;

  const formatLabel: Record<string, string> = {
    classic: 'Classic Survival (1 loss and you\'re out)',
    lives: 'Lives Mode',
    streak_race: `Streak Race (first to ${pool.target_streak} wins in a row wins)`,
    first_to_x: `First To ${pool.target_wins} Wins`,
    best_record: 'Best Record',
  };

  const prizeText = pool.prize_description
    ? pool.prize_description
    : pool.entry_fee_cents && pool.entry_fee_cents > 0
    ? `$${(pool.entry_fee_cents / 100).toFixed(2)} entry fee prize pool`
    : 'Bragging Rights';

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #111; color: #fff; padding: 32px; border-radius: 12px;">
      <h1 style="font-size: 24px; font-weight: 900; margin: 0 0 4px;">New Contest Alert 🏆</h1>
      <p style="color: #aaa; margin: 0 0 24px;">A new survival pool just dropped on Sharpr.</p>

      <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #fff;">${pool.name}</h2>
        <p style="color: #aaa; margin: 0 0 4px;">Sport: <span style="color: #fff;">${pool.sport}</span></p>
        <p style="color: #aaa; margin: 0 0 4px;">Format: <span style="color: #fff;">${formatLabel[pool.contest_format] ?? pool.contest_format}</span></p>
        <p style="color: #aaa; margin: 0;">Prize: <span style="color: #4ade80; font-weight: 700;">${prizeText}</span></p>
      </div>

      <a href="${joinUrl}" style="display: block; background: #22c55e; color: #000; font-weight: 800; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-size: 16px;">
        Join Now
      </a>

      <p style="color: #555; font-size: 12px; text-align: center; margin-top: 24px;">
        You're receiving this because you signed up at sharprpicks.com
      </p>
    </div>
  `;

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Send in batches of 50 (Resend limit per request)
  for (let i = 0; i < recipients.length; i += 50) {
    const batch = recipients.slice(i, i + 50);
    await resend.emails.send({
      from: 'Sharpr <noreply@sharprpicks.com>',
      to: batch,
      subject: `New Pool: ${pool.name} 🏆`,
      html,
    });
  }
}
