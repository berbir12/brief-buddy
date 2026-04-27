import { Link } from "react-router-dom";
import { LEGAL_CONFIG } from "@/config/legal";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6 text-sm text-muted-foreground">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Privacy Policy</h1>
          <p>
            This Privacy Policy explains how {LEGAL_CONFIG.legalEntityName} ("we", "us", or "our") collects, uses,
            discloses, and protects information when you use {LEGAL_CONFIG.productName}.
          </p>
          <p>Effective date: {LEGAL_CONFIG.privacyEffectiveDate}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">1. Information we collect</h2>
          <p>We collect information needed to provide, secure, and improve the service, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account details such as email address and profile preferences.</li>
            <li>Authentication and security metadata (for example, login attempts and token metadata).</li>
            <li>Integration data and tokens that you explicitly connect (for example, calendar or messaging tools).</li>
            <li>Generated content such as briefings, task metadata, and user feedback.</li>
            <li>Operational telemetry such as request logs, error traces, and uptime signals.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">2. How we use information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and maintain product functionality.</li>
            <li>Authenticate users, prevent abuse, and enforce platform security controls.</li>
            <li>Process and deliver briefings, notifications, and related product workflows.</li>
            <li>Diagnose incidents and improve reliability, quality, and performance.</li>
            <li>Comply with legal obligations and enforce our terms.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">3. Legal bases and consent</h2>
          <p>
            Where required by law, we rely on one or more legal bases including contract performance, legitimate
            interests, legal compliance, and user consent. You can withdraw consent for optional processing where
            applicable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">4. Data sharing and processors</h2>
          <p>We may share data with trusted subprocessors that support hosting, email delivery, analytics, and APIs.</p>
          <p>
            We require subprocessors to protect data and process it only under appropriate contractual and security
            controls. We do not sell personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">5. Retention</h2>
          <p>
            We retain account and operational records for as long as needed to provide the service and meet legal or
            security obligations. Standard retention target is {LEGAL_CONFIG.dataRetentionDays} days unless a longer
            period is required by law or active investigation.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">6. Security</h2>
          <p>
            We use administrative, technical, and organizational safeguards designed to protect data from unauthorized
            access, disclosure, alteration, or destruction. No system is perfectly secure, and users should also follow
            strong account security practices.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">7. Your rights</h2>
          <p>
            Depending on your jurisdiction, you may have rights to access, correct, export, delete, or restrict
            processing of your personal data. You may also object to certain processing activities.
          </p>
          <p>To submit a privacy request, contact {LEGAL_CONFIG.contactEmail}.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">8. International transfers</h2>
          <p>
            If personal data is transferred across borders, we use appropriate safeguards required by applicable law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">9. Children’s privacy</h2>
          <p>
            {LEGAL_CONFIG.productName} is not intended for children under 13 (or the minimum age required in your
            jurisdiction), and we do not knowingly collect their personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">10. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will update the effective date and provide notice
            when required.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">11. Contact</h2>
          <p>{LEGAL_CONFIG.legalEntityName}</p>
          <p>{LEGAL_CONFIG.mailingAddress}</p>
          <p>
            Privacy inquiries: <a className="text-foreground underline" href={`mailto:${LEGAL_CONFIG.contactEmail}`}>{LEGAL_CONFIG.contactEmail}</a>
          </p>
          <p>
            Support: <a className="text-foreground underline" href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>
          </p>
          <p>
            Website: <a className="text-foreground underline" href={LEGAL_CONFIG.websiteUrl}>{LEGAL_CONFIG.websiteUrl}</a>
          </p>
        </section>
        <p className="text-xs">
          This Privacy Policy applies to your use of {LEGAL_CONFIG.productName} from the effective date listed above.
        </p>
      </div>
    </main>
  );
}
