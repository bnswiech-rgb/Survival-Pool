export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
        <p className="text-gray-400 mt-1 text-sm">Last updated: May 2026</p>
      </div>

      <div className="prose prose-invert max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
          <p>We collect information you provide when creating an account (email address, username), information generated through use of the Platform (picks, contest activity), and basic usage data.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">2. How We Use Your Information</h2>
          <p>We use your information to operate the Platform, display your picks and standings to other contest participants, and improve the Platform experience. We do not sell your personal information to third parties.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">3. Information Shared With Others</h2>
          <p>Your username and picks are visible to other participants in the same contest after the daily pick deadline passes. Your email address is never shared with other users.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">4. Data Storage</h2>
          <p>Your data is stored securely using Supabase. We take reasonable measures to protect your information but cannot guarantee absolute security.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">5. Cookies</h2>
          <p>We use cookies solely for authentication purposes to keep you logged in. We do not use tracking or advertising cookies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">6. Third Party Services</h2>
          <p>We use the following third-party services: Supabase (database and authentication), Vercel (hosting), and The Odds API (sports data). Each has their own privacy policy governing how they handle data.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">7. Your Rights</h2>
          <p>You may request deletion of your account and associated data at any time by contacting us through the Platform. We will process deletion requests within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">8. Children's Privacy</h2>
          <p>The Platform is not directed at anyone under 18 years of age. We do not knowingly collect information from minors.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">9. Changes to This Policy</h2>
          <p>We may update this policy at any time. Continued use of the Platform after changes constitutes acceptance of the updated policy.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">10. Contact</h2>
          <p>For privacy questions or data deletion requests, contact us through the Platform.</p>
        </section>
      </div>
    </div>
  );
}
