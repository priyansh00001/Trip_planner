import Link from "next/link"
import { MapPin, ArrowLeft } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container max-w-4xl mx-auto flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-16">
        <div className="flex items-center gap-3 mb-8">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">AI Trip Planner</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using AI Trip Planner ("the Service"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use our service. These terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              AI Trip Planner is an AI-powered travel planning platform that generates personalized itineraries, suggests accommodations, and provides travel-related features including trip memories, community sharing, and interactive maps. The service uses artificial intelligence to create suggestions and recommendations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              To use certain features of the Service, you must create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account and keep your information up to date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">4. User Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of any content you upload or create through the Service, including photos, reviews, and trip data. By marking content as "Public" on the Community Wall, you grant us a non-exclusive, worldwide, royalty-free license to display that content to other users of the platform. You can revoke this by marking your content as private at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">5. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              The itineraries, recommendations, and suggestions provided by our AI are for informational purposes only. We do not guarantee the accuracy, completeness, or reliability of AI-generated content. Always verify critical travel information (flights, bookings, visa requirements) through official sources before making travel arrangements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">6. Prohibited Uses</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to: (a) use the Service for any unlawful purpose, (b) upload content that is harmful, offensive, or infringes on others' rights, (c) attempt to gain unauthorized access to any part of the Service, (d) interfere with or disrupt the Service, or (e) use automated systems to access the Service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" and "as available" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">8. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new terms on this page. Your continued use of the Service after such changes constitutes your acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3">9. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{" "}
              <a href="mailto:support@aitripplanner.com" className="text-primary hover:underline">support@aitripplanner.com</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
