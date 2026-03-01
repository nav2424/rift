import GlassCard from '@/components/ui/GlassCard'

export default function Legal() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-white pt-8 pb-32">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="text-6xl md:text-7xl font-light text-[#1d1d1f] mb-8 tracking-tight">
            Legal
          </h1>
          <p className="text-xl text-[#86868b] max-w-2xl mx-auto font-light">
            Terms and Conditions & Privacy Policy
          </p>
        </div>

        <div className="space-y-8">
          {/* Terms & Conditions */}
          <GlassCard variant="liquid" className="p-12">
            <h2 className="text-3xl font-light text-[#1d1d1f] mb-4">RIFT TERMS & CONDITIONS</h2>
            <p className="text-[#86868b] font-light text-sm mb-8">Last Updated: December 31st 2025</p>
            
            <div className="prose prose-invert max-w-none space-y-8">
              <p className="text-gray-700 leading-relaxed font-light">
                Welcome to Rift ("Rift," "we," "our," or "us"). These Terms and Conditions ("Terms") govern your access to and use of the Rift platform, including our website, mobile applications, and related services (collectively, the "Platform").
              </p>
              <p className="text-gray-700 leading-relaxed font-light">
                By accessing or using Rift, you agree to these Terms. If you do not agree, you must not use the Platform.
              </p>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">1. What Rift Is (and Is Not)</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-4">
                  Rift is a transaction facilitation platform that helps creators and brands (buyers and sellers) complete transactions more safely by providing payment flow structure, communication records, and conditional release mechanisms.
                </p>
                <p className="text-gray-700 leading-relaxed font-light mb-2">Rift:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Is not a marketplace</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Does not sell or deliver goods or services</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Is not a bank, money transmitter, or regulated payment service provider</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Does not guarantee transaction outcomes</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  All transactions occur directly between buyers and sellers.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">2. Eligibility</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">You must:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Be at least 18 years old</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Have legal capacity to enter into binding agreements</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Provide accurate and truthful information</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  Rift may suspend or terminate accounts that violate these requirements.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">3. Accounts</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">You are responsible for:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Maintaining account security</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>All actions taken under your account</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Keeping information accurate and up to date</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  You may not create multiple accounts to bypass enforcement or restrictions.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">4. Payments & Financial Processing</h3>
                <h4 className="text-lg font-light text-gray-800 mb-3 mt-6">4.1 Stripe Payment Processing</h4>
                <p className="text-gray-700 leading-relaxed font-light mb-4">
                  All payments on Rift are processed exclusively by third-party payment processors, including Stripe.
                </p>
                <p className="text-gray-700 leading-relaxed font-light mb-2">Rift does not:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Process or store credit card information</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Process or store bank account information</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Hold user funds</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Act as a financial institution</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4 mb-4">
                  All financial information is handled directly by Stripe and governed by Stripe's Terms of Service and Privacy Policy.
                </p>
                <p className="text-gray-700 leading-relaxed font-light">
                  Rift only receives non-sensitive transaction metadata, such as payment status and transaction identifiers.
                </p>
                <h4 className="text-lg font-light text-gray-800 mb-3 mt-6">4.2 Fees</h4>
                <p className="text-gray-700 leading-relaxed font-light">
                  Rift charges service fees that may include buyer and seller fees. All fees are disclosed before payment and are non-refundable once a transaction begins, except where required by law.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">5. Transactions</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">
                  Rift supports transactions including, but not limited to:
                </p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Tickets</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Digital goods</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Services</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Physical items (where enabled)</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  Rift does not verify authenticity of any item or service.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">6. Communication & Proof</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-4">
                  All transaction-related communication should occur within Rift.
                </p>
                <p className="text-gray-700 leading-relaxed font-light mb-2">
                  Messages, files, confirmations, and timestamps on Rift may be used as:
                </p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Transaction records</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Evidence during disputes</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Compliance and fraud review material</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  Off-platform communication may reduce or eliminate Rift's ability to assist.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">7. Disputes</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">Disputes:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Must be opened within the allowed dispute window</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Require supporting evidence</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Are intentionally high-friction to prevent abuse</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4 mb-4">
                  Rift may review evidence and make a final determination.
                </p>
                <p className="text-gray-700 leading-relaxed font-light">
                  All dispute decisions are final and binding.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">8. Zero-Tolerance Misuse Policy</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-4">
                  Rift enforces a strict zero-tolerance policy.
                </p>
                <p className="text-gray-700 leading-relaxed font-light mb-2">Prohibited conduct includes, but is not limited to:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Scams or fraud</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Misrepresentation</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Chargeback abuse</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Harassment, threats, or intimidation</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Abuse of the dispute system</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Circumventing fees or safeguards</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Illegal or prohibited activity</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">9. Enforcement & Penalties</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">
                  If Rift determines, in its sole discretion, that a user has violated these Terms, Rift may:
                </p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Permanently ban the user (lifetime ban)</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Terminate all associated accounts</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Forfeit any pending or unreleased funds</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Cancel active transactions</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Withhold payouts</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Report activity to payment processors or authorities</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  There are no warnings or appeals for severe violations.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">10. Forfeiture of Funds</h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  Users agree that any funds associated with fraudulent, abusive, or malicious activity may be permanently forfeited and will not be released, refunded, or recovered.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">11. Harassment Policy</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-4">
                  Harassment of any kind will not be tolerated.
                </p>
                <p className="text-gray-700 leading-relaxed font-light mb-4">
                  This includes abusive language, threats, coercion, discrimination, or repeated unwanted contact.
                </p>
                <p className="text-gray-700 leading-relaxed font-light">
                  Violations may result in immediate permanent bans and fund forfeiture.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">12. Limitation of Liability</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">
                  To the maximum extent permitted by law, Rift is not liable for:
                </p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Transaction outcomes</span>
                  </li>
                <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Fraud by users</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Lost profits or opportunities</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Indirect or consequential damages</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  Rift's total liability shall not exceed the fees paid to Rift for the transaction in question.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">13. Indemnification</h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  You agree to indemnify and hold Rift harmless from any claims arising from:
                </p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Your use of the Platform</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Your transactions</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Your violation of these Terms or applicable law</span>
                </li>
              </ul>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">14. Governing Law</h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  These Terms are governed by the laws of Quebec, Canada.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Disclaimer */}
          <GlassCard variant="liquid" className="p-12">
            <h2 className="text-3xl font-light text-[#1d1d1f] mb-8">RIFT DISCLAIMER</h2>
            <div className="prose prose-invert max-w-none space-y-6">
              <p className="text-gray-700 leading-relaxed font-light">
                Rift is provided "as is" and "as available."
              </p>
              <p className="text-gray-700 leading-relaxed font-light mb-2">Rift does not:</p>
              <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                <li className="flex items-start gap-3 font-light">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>Verify users beyond required compliance checks</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>Guarantee authenticity, delivery, or performance</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                  <span className="text-gray-400 mt-1">•</span>
                  <span>Act as a guarantor, insurer, or regulated payment intermediary</span>
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed font-light mt-6">
                All transactions involve risk. Rift provides structured protection, not certainty.
              </p>
              <p className="text-gray-700 leading-relaxed font-light">
                Use of Rift is at your own risk.
              </p>
            </div>
          </GlassCard>

          {/* Privacy Policy */}
          <GlassCard variant="liquid" className="p-12">
            <h2 className="text-3xl font-light text-[#1d1d1f] mb-4">RIFT PRIVACY POLICY</h2>
            <p className="text-[#86868b] font-light text-sm mb-8">Last Updated: December 31st 2025</p>
            
            <div className="prose prose-invert max-w-none space-y-8">
              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">1. Information We Collect</h3>
                <h4 className="text-lg font-light text-gray-800 mb-3 mt-6">Information You Provide</h4>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Name, email, phone number</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Account credentials</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Transaction details</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Messages and files</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Verification information (if required)</span>
                  </li>
                </ul>
                <h4 className="text-lg font-light text-gray-800 mb-3 mt-6">Automatically Collected Information</h4>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>IP address</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Device and browser data</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Usage logs</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Cookies and analytics data</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">2. Payment Information</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">Rift does not collect or store:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Credit card numbers</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Bank account numbers</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Payment credentials</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  All payments are handled directly by Stripe.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">3. How We Use Information</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">We use information to:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Operate the Platform</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Process transactions</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Prevent fraud</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Resolve disputes</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Meet legal obligations</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Improve services</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">4. Sharing Information</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">We may share information with:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Payment processors (e.g., Stripe)</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Compliance and fraud partners</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Service providers</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Legal authorities when required</span>
                  </li>
                </ul>
                <p className="text-gray-700 leading-relaxed font-light mt-4">
                  Rift does not sell personal data.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">5. Data Retention</h3>
                <p className="text-gray-700 leading-relaxed font-light mb-2">We retain data as long as necessary for:</p>
                <ul className="list-none text-gray-700 space-y-2 mt-4 ml-0">
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Platform operations</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Legal compliance</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Dispute resolution</span>
                  </li>
                  <li className="flex items-start gap-3 font-light">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Enforcement of agreements</span>
                  </li>
                </ul>
                <p className="text-[#86868b] leading-relaxed font-light text-sm mt-4">
                  For detailed information about data retention periods and disposal procedures, please refer to our Data Retention and Disposal Policy. The policy defines specific retention periods, data deletion procedures, and user rights regarding data management.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">6. Security</h3>
                <p className="text-gray-700 leading-relaxed font-light">
                  We use industry-standard security measures, but no system is completely secure. You acknowledge and accept this risk.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">7. Your Rights</h3>
              <p className="text-gray-700 leading-relaxed font-light">
                  Depending on jurisdiction, you may have rights to access, correct, or delete your data.
              </p>
              </div>

              <div>
                <h3 className="text-xl font-light text-[#1d1d1f] mb-4 mt-8">8. Changes to This Policy</h3>
              <p className="text-gray-700 leading-relaxed font-light">
                  We may update this policy periodically. Continued use constitutes acceptance.
              </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
