export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
        <p className="text-gray-400 mt-1 text-sm">Last updated: May 26, 2026</p>
      </div>

      <div className="prose prose-invert max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
        <p>This Privacy Policy describes how Brehtan Swiech, operating as Sharpr ("we," "us," or "our"), collects, uses, and shares information about you when you use Sharpr ("the Platform"). By using the Platform, you agree to this Privacy Policy.</p>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
          <p><strong className="text-white">Account information:</strong> When you create an account, we collect your email address and the username you choose.</p>
          <p><strong className="text-white">Activity data:</strong> We collect information about how you use the Platform, including contest picks, round results, wins, losses, and coin balances.</p>
          <p><strong className="text-white">Payment information:</strong> When you purchase Gold Coins, your payment is processed by Stripe, Inc. We do not store your full credit card number or financial account details. Stripe provides us with a payment token and basic billing information (last 4 digits, card type, billing country) for our records.</p>
          <p><strong className="text-white">AMOE requests:</strong> If you submit a free Alternate Method of Entry request by mail or other qualifying method, we collect the name and address you provide solely to award Sweeps Coins and maintain required sweepstakes records.</p>
          <p><strong className="text-white">Communications:</strong> If you contact us by email or through the Platform, we retain those communications to respond to your inquiry.</p>
          <p><strong className="text-white">Technical data:</strong> We collect basic technical information such as your IP address, browser type, device type, and pages visited to operate and improve the Platform.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To operate and maintain your account and the Platform</li>
            <li>To process Gold Coin purchases and manage coin balances</li>
            <li>To administer the sweepstakes program, including awarding and tracking Sweeps Coins</li>
            <li>To display your username, picks, and standings to other contest participants</li>
            <li>To send you transactional emails (account confirmation, pick reminders, contest results)</li>
            <li>To detect and prevent fraud, abuse, or violations of our Terms of Service</li>
            <li>To comply with applicable laws, including sweepstakes record-keeping requirements</li>
            <li>To improve the Platform experience</li>
          </ul>
          <p>We do not sell your personal information to third parties.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Information Shared With Others</h2>
          <p><strong className="text-white">Other users:</strong> Your username and contest picks are visible to other participants in the same contest after each round's pick deadline passes. Your email address and payment information are never visible to other users.</p>
          <p><strong className="text-white">Service providers:</strong> We share information with third-party vendors who help us operate the Platform, including Supabase (database and authentication), Vercel (hosting), Stripe (payment processing), and Resend (transactional email). These providers are contractually prohibited from using your data for any purpose other than providing services to us.</p>
          <p><strong className="text-white">Legal requirements:</strong> We may disclose your information if required by law, subpoena, court order, or other governmental authority, or if we believe in good faith that disclosure is necessary to protect our rights or the safety of any person.</p>
          <p><strong className="text-white">Business transfers:</strong> If Sharpr is acquired or merged with another entity, your information may be transferred as part of that transaction. We will notify you before your information is transferred and becomes subject to a different privacy policy.</p>
          <p><strong className="text-white">Sweepstakes winners:</strong> As required by law, winners of sweepstakes prizes may have their name disclosed upon request.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Payment Data and Stripe</h2>
          <p>All payment processing is handled by Stripe, Inc. When you purchase Gold Coins, your payment information is transmitted directly to Stripe over encrypted connections and is governed by <a href="https://stripe.com/privacy" className="text-green-400 hover:text-green-300" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>. We store only a Stripe customer ID and non-sensitive payment metadata (transaction ID, amount, date, last 4 digits of card) necessary for billing records and customer support.</p>
          <p>We are PCI compliant through our use of Stripe and do not store, process, or transmit full cardholder data on our systems.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Data Storage and Security</h2>
          <p>Your data is stored securely using Supabase on servers located in the United States. We implement industry-standard security measures including encryption in transit (TLS), encrypted storage, and access controls. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
          <p>We retain your account data for as long as your account is active. If you request account deletion, we will delete your personal data within 30 days, except where retention is required by law (e.g., financial transaction records, sweepstakes winner records).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. Cookies and Tracking</h2>
          <p>We use cookies solely for authentication purposes to keep you logged into your account. We do not use advertising cookies, cross-site tracking, or third-party behavioral tracking. We do not serve targeted advertisements.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">7. Third-Party Services</h2>
          <p>The Platform uses the following third-party services, each governed by their own privacy policies:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white">Supabase</strong> — database and authentication</li>
            <li><strong className="text-white">Vercel</strong> — hosting and infrastructure</li>
            <li><strong className="text-white">Stripe</strong> — payment processing</li>
            <li><strong className="text-white">Resend</strong> — transactional email delivery</li>
            <li><strong className="text-white">The Odds API</strong> — sports odds data</li>
            <li><strong className="text-white">ESPN</strong> — sports scores and results</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">8. Your Rights and Choices</h2>
          <p><strong className="text-white">Access and correction:</strong> You may review and update your account information at any time through your profile settings.</p>
          <p><strong className="text-white">Deletion:</strong> You may request deletion of your account and associated personal data by emailing <span className="text-green-400">legal@survivorpicks.com</span>. We will process deletion requests within 30 days, subject to any legal retention requirements.</p>
          <p><strong className="text-white">Email opt-out:</strong> You may opt out of non-transactional promotional emails at any time by following the unsubscribe link in any such email. You cannot opt out of transactional emails necessary for account operation (e.g., password reset, prize notifications).</p>
          <p><strong className="text-white">California residents:</strong> If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete your personal information, and the right to opt out of the sale of personal information (we do not sell personal information). To exercise these rights, contact us at the email below.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">9. Children's Privacy</h2>
          <p>The Platform is not directed at or intended for anyone under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have collected information from a person under 18, we will delete that information promptly. If you believe we have collected information from a minor, please contact us immediately.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">10. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes by updating the "Last updated" date at the top of this page and, where appropriate, by sending an email to the address associated with your account. Your continued use of the Platform after changes constitutes acceptance of the updated policy.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">11. Contact</h2>
          <p>For privacy questions, data access requests, or deletion requests, contact us at:</p>
          <p className="text-green-400">legal@survivorpicks.com</p>
          <p className="text-gray-500">Brehtan Swiech / Sharpr</p>
          <p className="text-gray-500 text-xs mt-2">Note: Replace with your actual contact email and mailing address before launch.</p>
        </section>
      </div>
    </div>
  );
}
