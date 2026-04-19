import { Link } from "react-router-dom";
import { LEGAL_CONFIG } from "@/config/legal";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6 text-sm text-muted-foreground">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to home
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Terms of Service</h1>
          <p>
            These Terms of Service ("Terms") are a legal agreement between you and {LEGAL_CONFIG.legalEntityName}
            governing access to and use of {LEGAL_CONFIG.productName}.
          </p>
          <p>Effective date: {LEGAL_CONFIG.termsEffectiveDate}</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">1. Eligibility and account responsibility</h2>
          <p>
            You must be legally able to enter into a binding agreement and provide accurate registration information.
            You are responsible for activity under your account and for keeping credentials secure.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">2. Service scope</h2>
          <p>
            {LEGAL_CONFIG.productName} provides AI-assisted briefing and productivity workflows. Features may change as
            we improve functionality, reliability, and security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Violate applicable law or third-party rights.</li>
            <li>Attempt unauthorized access, reverse engineer protected systems, or bypass controls.</li>
            <li>Abuse API endpoints, rate limits, or integrations in a way that harms the service.</li>
            <li>Upload malicious code or content designed to disrupt operations.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">4. Integrations and third-party services</h2>
          <p>
            You may connect third-party integrations at your discretion. Your use of third-party services is governed
            by those providers' terms and policies. We are not responsible for third-party service availability.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">5. Fees and billing</h2>
          <p>
            If paid plans are offered, fees, billing terms, and renewal details will be presented at purchase time.
            Unless otherwise stated, fees are non-refundable except where required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">6. Intellectual property</h2>
          <p>
            We and our licensors retain rights to the service, software, and branding. Subject to these Terms, we
            grant you a limited, non-exclusive, revocable right to use the service for lawful internal purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">7. Confidentiality and privacy</h2>
          <p>
            Each party agrees to protect confidential information disclosed by the other party. Our data handling
            practices are described in the Privacy Policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">8. Disclaimers</h2>
          <p>
            The service is provided on an "as is" and "as available" basis. We disclaim all implied warranties to the
            fullest extent permitted by law, including merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">9. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, {LEGAL_CONFIG.legalEntityName} will not be liable for indirect,
            incidental, special, consequential, or punitive damages, or for loss of data, revenue, or profits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">10. Suspension and termination</h2>
          <p>
            We may suspend or terminate access for violations of these Terms, security risk, or legal requirements.
            You may stop using the service at any time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">11. Governing law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction where {LEGAL_CONFIG.legalEntityName} is
            established, unless applicable law requires otherwise.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">12. Contact</h2>
          <p>{LEGAL_CONFIG.legalEntityName}</p>
          <p>{LEGAL_CONFIG.mailingAddress}</p>
          <p>
            Legal inquiries: <a className="text-foreground underline" href={`mailto:${LEGAL_CONFIG.contactEmail}`}>{LEGAL_CONFIG.contactEmail}</a>
          </p>
          <p>
            Support: <a className="text-foreground underline" href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>
          </p>
        </section>
        <p className="text-xs">
          This template is provided for operational readiness and should be reviewed by qualified counsel before public
          launch.
        </p>
      </div>
    </main>
  );
}
