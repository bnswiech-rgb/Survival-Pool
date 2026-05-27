export default function SweepstakesRulesPage() {
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
          <p>Brehtan Swiech, operating as Sharpr ("Sponsor"). Contact: <span className="text-green-400">legal@survivorpicks.com</span>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. Overview</h2>
          <p>Sharpr operates a sweepstakes promotional program ("Program") using two virtual currencies: Gold Coins ("GC") and Sweeps Coins ("SC"). Gold Coins are purchased virtual currency for entertainment play only and have no cash value. Sweeps Coins are promotional sweepstakes entries awarded at no charge that may be redeemed for prizes as described herein.</p>
          <p>No purchase is necessary to receive Sweeps Coins or to participate in the sweepstakes. Purchasing Gold Coins does not increase your chances of winning any sweepstakes prize. All participants who enter through the free Alternate Method of Entry (AMOE) have the same opportunity to receive Sweeps Coins and win prizes as those who purchase Gold Coins.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Eligibility</h2>
          <p>The Program is open to legal residents of the United States who are 18 years of age or older at the time of participation, except residents of the following states where the Program is void: Idaho, Nevada, and Washington (collectively, "Excluded States").</p>
          <p>Employees, officers, directors, and agents of Sponsor, and their immediate family members (spouse, parents, siblings, children) and household members, are not eligible to redeem Sweeps Coins for prizes.</p>
          <p>Participants must have a valid, active Sharpr account in good standing. Sponsor reserves the right to verify eligibility at any time.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Sweeps Coins — How to Obtain (Free)</h2>
          <p>Sweeps Coins may be obtained at no cost through the following methods:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-white">Daily Free Bonus:</strong> Registered users may claim a daily free bonus of 50 SC once per calendar day (UTC). No purchase required. Log in and click "Claim" on the dashboard.
            </li>
            <li>
              <strong className="text-white">Alternate Method of Entry (AMOE) — Mail-In:</strong> To receive 50 SC at no cost, hand-print your full legal name, mailing address, email address associated with your Sharpr account, and the statement "I am requesting my free Sweeps Coins" on a 3×5 inch card and mail it to:
              <div className="mt-2 pl-4 border-l-2 border-gray-700 text-gray-400">
                Sharpr AMOE Request<br />
                c/o Brehtan Swiech<br />
                [Your Mailing Address — add before launch]<br />
              </div>
              <p className="mt-2">Limit one AMOE request per outer envelope; one AMOE request per household per day; requests received after the Program ends will not be honored. Allow up to 14 business days for processing. Sponsor is not responsible for lost, late, illegible, or misdirected mail.</p>
            </li>
            <li>
              <strong className="text-white">Promotional Giveaways:</strong> Sponsor may award Sweeps Coins through promotional giveaways, social media contests, or other marketing activities at its sole discretion.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Sweeps Coins — Obtaining Through Gold Coin Purchase</h2>
          <p>When a user purchases a Gold Coin package, they may receive a corresponding amount of Sweeps Coins as a promotional bonus (the specific bonus amount is shown at time of purchase). This is a promotional bonus, not a purchase of Sweeps Coins. The price of any Gold Coin package is for the Gold Coins only. Sweeps Coins received in connection with a purchase have the same value and redemption terms as Sweeps Coins obtained for free.</p>
          <p>Any Gold Coin purchase that results in a chargeback or is otherwise reversed will result in forfeiture of associated Sweeps Coins.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. How Sweepstakes Contests Work</h2>
          <p>Participants use Sweeps Coins to enter sports picking contests on the Platform. Each round, participants submit one eligible pick. Picks are graded based on actual sporting event outcomes. Sweeps Coins are awarded to contest winners per the prize structure shown at contest start.</p>
          <p>Chance elements: While participant picks are skill-based predictions, outcomes depend on actual sporting events which are beyond any participant's control. The contest format, draw of opponents, and scheduling introduce elements of chance.</p>
          <p>All contest results are final once officially graded. Sponsor reserves the right to void picks and/or cancel contests in the event of a data error, technical failure, or other exceptional circumstance.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">7. Prizes and Redemption</h2>
          <p>Sweeps Coins won in contests may be redeemed for prizes as follows:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Prizes are offered in the form of cash equivalent payments (e.g., ACH transfer, PayPal, or check) at a rate of 1 SC = $0.01 USD, subject to minimum redemption thresholds and verification.</li>
            <li>Minimum redemption: 5,000 SC ($50.00 USD value). Subject to change with notice.</li>
            <li>Redemption requests are subject to identity verification and eligibility confirmation. Sponsor may require government-issued photo ID and proof of address.</li>
            <li>Winners may be required to complete an IRS Form W-9 (U.S. residents) before prize payment is issued. All prizes are subject to applicable federal, state, and local taxes. Winners are solely responsible for all taxes on prizes received.</li>
            <li>Prizes will be paid within 30 days of eligibility verification completion.</li>
            <li>Sponsor reserves the right to substitute a prize of equal or greater value at its sole discretion.</li>
          </ul>
          <p>Total prize pool value distributed through the sweepstakes Program is at Sponsor's sole discretion. Sponsor is not obligated to maintain any specific prize pool amount.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">8. Sweeps Coins Expiration</h2>
          <p>Sweeps Coins expire after 90 consecutive days of account inactivity (no login). Sponsor will make reasonable efforts to notify users before expiration but is not obligated to do so. Expired Sweeps Coins cannot be restored. Gold Coins do not expire.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">9. Limits</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>One account per person. Multiple accounts are prohibited.</li>
            <li>One daily free bonus claim per account per day.</li>
            <li>One AMOE mail-in per household per day.</li>
            <li>Redemption requests are subject to a maximum of one per calendar month per user, unless otherwise specified.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">10. Prohibited Conduct</h2>
          <p>The following are prohibited and may result in immediate disqualification and forfeiture of all Sweeps Coins: using automated software or bots; creating multiple accounts; exploiting technical errors; colluding with other participants; providing false information for AMOE or prize redemption; any conduct that Sponsor deems contrary to the spirit of the Program.</p>
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
          <p>Sponsor reserves the right, in its sole discretion, to modify, suspend, or terminate the Program at any time, for any reason, including if the Program cannot be conducted as planned due to causes beyond Sponsor's control. In the event of cancellation, all unredeemed Sweeps Coins will be honored for a minimum of 30 days following cancellation notice, provided the participant is otherwise eligible.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">15. Winner List</h2>
          <p>For a list of prize winners (name and state/province), send a written request with a self-addressed stamped envelope to the Sponsor address listed in Section 4. Requests must be received within 90 days of the end of the applicable contest.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">16. Contact</h2>
          <p>For questions about this Program, contact Sponsor at <span className="text-green-400">legal@survivorpicks.com</span>.</p>
          <p className="text-gray-500 text-xs mt-2">Note: Replace placeholder email and mailing address with actual values before launch.</p>
        </section>

      </div>
    </div>
  );
}
