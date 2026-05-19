import Link from "next/link"
import { MapPin, ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">


      <main className="container max-w-4xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">AI Trip Planner</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly: your name, email address, and account credentials when you sign up. When you use the Service, we also collect trip preferences (destination, budget, duration), photos you upload to your memories, and reviews or ratings you leave on completed trips.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use your information to: (a) provide and improve the Service, (b) generate personalized AI-powered itineraries, (c) display your public content on the Community Wall when you opt in, (d) send you important account notifications, and (e) analyze usage patterns to improve the user experience. We never sell your personal data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">3. Data Storage & Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using Supabase, which provides enterprise-grade security including encryption at rest and in transit, Row Level Security (RLS) policies, and regular backups. Photos are stored in secure cloud storage with access controls. We implement industry-standard security measures to protect your data from unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the following third-party services: (a) <strong>Supabase</strong> for authentication and database, (b) <strong>Google OAuth</strong> for social sign-in (governed by Google's privacy policy), (c) <strong>Google Gemini AI</strong> for generating itineraries, and (d) <strong>Google Maps</strong> for interactive map features. Each third-party service has its own privacy policy governing data they process.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">5. Your Privacy Controls</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have full control over your data: (a) <strong>Public/Private toggle</strong> — choose whether your trips appear on the Community Wall, (b) <strong>Photo management</strong> — upload, view, and delete your trip photos at any time, (c) <strong>Account deletion</strong> — contact us to request complete deletion of your account and all associated data, (d) <strong>Data export</strong> — download your trip data through the PDF export feature.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">6. Cookies & Analytics</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies required for authentication and session management. We do not use third-party tracking cookies or advertising networks. We may use basic analytics to understand how users interact with the Service, but this data is anonymized and aggregated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">7. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected data from a child, please contact us immediately and we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">8. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the updated policy on this page with a revised "Last updated" date. We encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">9. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions or concerns about this Privacy Policy or your data, please contact us at{" "}
              <a href="mailto:support@aitripplanner.com" className="text-primary hover:underline">support@aitripplanner.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
