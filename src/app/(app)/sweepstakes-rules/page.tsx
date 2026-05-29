'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SweepstakesRulesPage() {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const handleDigitalAmoe = async () => {
    setClaiming(true);
    try {
      const res = await fetch('/api/amoe', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to claim.');
      } else {
        setClaimed(true);
        toast.success(`$${(data.sweeps_awarded / 100).toFixed(2)} Sharpr Cash added to your account!`);
      }
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">Official Sweepstakes Rules</h1>
        <p className="text-gray-400 mt-1 text-sm">Last updated: May 26, 2026</p>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-200">
        NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE DOES NOT INCREASE YOUR CHANCES OF WINNING. VOID WHERE PROHIBITED.
      </div>

      <div className="prose prose-invert max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Sponsor</h2>
          <p>Brehtan Swiech, operating as Sharpr ("Sponsor"). Contact: <span className="text-green-400">legal@sharprpicks.com</span>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. Overview</h2>
          <p>Sharpr operates a sweepstakes promotional program ("Program") using two virtual currencies: Sharpr Coins and Sharpr Cash. Sharpr Coins are purchased virtual currency for entertainment play only and have no cash value. Sharpr Cash is a promotional sweepstakes currency awarded at no charge that may be redeemed for prizes at $1.00 per Sharpr Cash as described herein.</p>
          <p>No purchase is necessary to receive Sharpr Cash or to participate in the sweepstakes. Purchasing Sharpr Coins does not increase your chances of winning any sweepstakes prize. All participants who enter through the free Alternate Method of Entry (AMOE) have the same opportunity to receive Sharpr Cash and win prizes as those who purchase Sharpr Coins.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Eligibility</h2>
          <p>The Program is open to legal residents of the United States who are 18 years of age or older at the time of participation, except residents of the following states where the Program is void: Idaho, Nevada, and Washington (collectively, "Excluded States").</p>
          <p>Employees, officers, directors, and agents of Sponsor, and their immediate family members (spouse, parents, siblings, children) and household members, are not eligible to redeem Sharpr Cash for prizes.</p>
          <p>Participants must have a valid, active Sharpr account in good standing. Sponsor reserves the right to verify eligibility at any time.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Sharpr Cash — How to Obtain (Free)</h2>
          <p>Sharpr Cash may be obtained at no cost through the following methods:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-white">Daily Free Bonus:</strong> Registered users may claim a daily free bonus of 250 Sharpr Coins + $0.20 Sharpr Cash once per calendar day (UTC). No purchase required. Log in and click "Claim" on the coins page. Users who have previously purchased Sharpr Coins receive $0.40 Sharpr Cash daily as a loyalty bonus.
            </li>
            <li>
              <strong className="text-white">Alternate Method of Entry (AMOE) — Mail-In:</strong> To receive $0.20 Sharpr Cash at no cost, hand-print your full legal name, mailing address, email address associated with your Sharpr account, and the statement "I am requesting my free Sharpr Cash" on a 3×5 inch card and mail it to:
              <div className="mt-2 pl-4 border-l-2 border-gray-700 text-gray-400">
                Sharpr AMOE Request<br />
                c/o Brehtan Swiech<br />
                401 Guadalupe St, Apt 2219<br />
                Austin, TX 78701<br />
              </div>
              <p className="mt-2">Limit one AMOE request per outer envelope; one AMOE request per household per day; requests received after the Program ends will not be honored. Allow up to 14 business days for processing. Sponsor is not responsible for lost, late, illegible, or misdirected mail.</p>
            </li>
            <li>
              <strong className="text-white">Alternate Method of Entry (AMOE) — Digital:</strong> Registered users may submit a digital AMOE request once per calendar day (UTC) to receive $0.20 Sharpr Cash at no cost. No purchase required. You must be logged in to your Sharpr account.
              <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                {claimed ? (
                  <p className="text-green-400 text-sm font-medium">✓ $0.20 Sharpr Cash has been added to your account for today.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">By clicking below, you confirm you are a legal US resident aged 18+, you have a valid Sharpr account, and you are submitting this request in good faith. Limit one per account per day.</p>
                    <button
                      onClick={handleDigitalAmoe}
                      disabled={claiming}
                      className="bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      {claiming ? 'Submitting...' : 'Claim $0.20 Free Sharpr Cash'}
                    </button>
                  </div>
                )}
              </div>
            </li>
            <li>
              <strong className="text-white">Promotional Giveaways:</strong> Sponsor may award Sharpr Cash through promotional giveaways, social media contests, or other marketing activities at its sole discretion.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Sharpr Cash — Obtaining Through Sharpr Coin Purchase</h2>
          <p>When a user purchases a Sharpr Coins package, they receive a corresponding amount of Sharpr Cash as a FREE promotional bonus (the specific bonus amount is shown at time of purchase). This is a promotional bonus, not a purchase of Sharpr Cash. The price of any Sharpr Coins package is for the Sharpr Coins only. Sharpr Cash received in connection with a purchase has the same value and redemption terms as Sharpr Cash obtained for free.</p>
          <p>Any Sharpr Coins purchase that results in a chargeback or is otherwise reversed will result in forfeiture of associated Sharpr Cash.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. How Sweepstakes Contests Work</h2>
          <p>Participants use Sharpr Cash to enter sports picking contests on the Platform. Each round, participants submit one eligible pick. Picks are graded based on actual sporting event outcomes. Sharpr Cash is awarded to contest winners per the prize structure shown at contest start.</p>
          <p>Chance elements: While participant picks are skill-based predictions, outcomes depend on actual sporting events which are beyond any participant's control. The contest format, draw of opponents, and scheduling introduce elements of chance.</p>
          <p>All contest results are final once officially graded. Sponsor reserves the right to void picks and/or cancel contests in the event of a data error, technical failure, or other exceptional circumstance.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">7. Prizes and Redemption</h2>
          <p>Sharpr Cash won in contests may be redeemed for prizes as follows:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Prizes are offered in the form of cash equivalent payments (e.g., ACH transfer, PayPal, or check) at a rate of 1 Sharpr Cash = $1.00 USD, subject to minimum redemption thresholds and verification.</li>
            <li>Minimum redemption: $50.00 Sharpr Cash. Subject to change with notice.</li>
            <li>Sharpr Cash must be wagered at least once in a contest before it is eligible for redemption (1x playthrough requirement).</li>
            <li>Redemption requests are subject to identity verification and eligibility confirmation. Sponsor may require government-issued photo ID and proof of address.</li>
            <li>Winners may be required to complete an IRS Form W-9 (U.S. residents) before prize payment is issued. All prizes are subject to applicable federal, state, and local taxes. Winners are solely responsible for all taxes on prizes received.</li>
            <li>Prizes will be paid within 30 days of eligibility verification completion.</li>
            <li>Sponsor reserves the right to substitute a prize of equal or greater value at its sole discretion.</li>
          </ul>
          <p>Total prize pool value distributed through the sweepstakes Program is at Sponsor's sole discretion. Sponsor is not obligated to maintain any specific prize pool amount.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">8. Sharpr Cash Expiration</h2>
          <p>Sharpr Cash expires after 90 consecutive days of account inactivity (no login). Sponsor will make reasonable efforts to notify users before expiration but is not obligated to do so. Expired Sharpr Cash cannot be restored. Sharpr Coins do not expire.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">9. Limits</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>One account per person. Multiple accounts are prohibited.</li>
            <li>One daily free bonus claim per account per day.</li>
            <li>One AMOE mail-in per household per day.</li>
            <li>One digital AMOE claim per account per day.</li>
            <li>Redemption requests are subject to a maximum of one per calendar month per user, unless otherwise specified.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">10. Prohibited Conduct</h2>
          <p>The following are prohibited and may result in immediate disqualification and forfeiture of all Sharpr Cash: using automated software or bots; creating multiple accounts; exploiting technical errors; colluding with other participants; providing false information for AMOE or prize redemption; any conduct that Sponsor deems contrary to the spirit of the Program.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">11. Publicity</h2>
          <p>By accepting a prize, winner consents to Sponsor's use of their name, username, and general location (city/state) for promotional purposes without additional compensation, except where prohibited by law. Sponsor may announce winners on the Platform and through social media.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">12. Release and Indemnification</h2>
          <p>By participating, each participant releases and holds harmless Sponsor and its representatives from any and all liability for any injury, loss, or damage of any kind to persons or property arising in connection with participation in the Program or acceptance or use of any prize.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">13. Disputes</h2>
          <p>All issues and questions concerning the construction, validity, interpretation, and enforceability of these Official Rules shall be governed by the laws of the State of Illinois, without giving effect to conflicts of law principles. Sponsor's decisions regarding all aspects of the Program are final and binding.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">14. Modification or Cancellation</h2>
          <p>Sponsor reserves the right, in its sole discretion, to modify, suspend, or terminate the Program at any time, for any reason, including if the Program cannot be conducted as planned due to causes beyond Sponsor's control. In the event of cancellation, all unredeemed Sharpr Cash will be honored for a minimum of 30 days following cancellation notice, provided the participant is otherwise eligible.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">15. Winner List</h2>
          <p>For a list of prize winners (name and state/province), send a written request with a self-addressed stamped envelope to the Sponsor address listed in Section 4. Requests must be received within 90 days of the end of the applicable contest.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">16. Contact</h2>
          <p>For questions about this Program, contact Sponsor at <span className="text-green-400">legal@sharprpicks.com</span>.</p>
        </section>

      </div>
    </div>
  );
}
