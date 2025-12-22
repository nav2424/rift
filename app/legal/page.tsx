import GlassCard from '@/components/ui/GlassCard'

export default function Legal() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-black pt-32 pb-32">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h1 className="text-6xl md:text-7xl font-light text-white mb-8 tracking-tight">
            Legal
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto font-light">
            Terms of Service and Privacy Policy
          </p>
        </div>

        <div className="space-y-8">
          <GlassCard variant="liquid" className="p-12">
            <h2 className="text-3xl font-light text-white mb-8">Terms of Service</h2>
            <div className="prose prose-invert max-w-none space-y-6">
              <p className="text-white/80 leading-relaxed font-light">
                By using Rift, you agree to the following terms and conditions.
              </p>
              <p className="text-white/80 font-light">
                By using this application, you acknowledge that:
              </p>
              <ul className="list-none text-white/80 space-y-3 mt-6 ml-0">
                <li className="flex items-start gap-3 font-light">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                  <span>You are responsible for providing accurate information</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                  <span>All transactions are subject to our fee structure</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                  <span>Disputes will be resolved by administrators</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                  <span>The application is provided "as is" without any warranties</span>
                </li>
                <li className="flex items-start gap-3 font-light">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 mt-2 flex-shrink-0" />
                  <span>You must comply with all applicable laws and regulations</span>
                </li>
              </ul>
            </div>
          </GlassCard>

          <GlassCard variant="liquid" className="p-12">
            <h2 className="text-3xl font-light text-white mb-8">Privacy Policy</h2>
            <div className="prose prose-invert max-w-none space-y-6">
              <p className="text-white/80 leading-relaxed font-light">
                Rift is committed to protecting your privacy. We use bank-level encryption 
                to secure all your data and never share your information with third parties.
              </p>
              <p className="text-white/80 leading-relaxed font-light">
                We collect only the information necessary to provide our services and process 
                transactions securely. Your financial information is encrypted and stored 
                according to industry best practices.
              </p>
            </div>
          </GlassCard>

          <GlassCard variant="liquid" className="p-12">
            <h2 className="text-3xl font-light text-white mb-8">Disclaimer</h2>
            <div className="prose prose-invert max-w-none space-y-6">
              <p className="text-white/80 leading-relaxed font-light">
                Rift provides buyer protection services by holding funds securely until transaction completion, facilitating secure transactions between buyers and sellers. 
                While we take measures to protect users, we are not responsible for the quality, condition, or 
                delivery of goods or services transacted through our platform.
              </p>
              <p className="text-white/80 leading-relaxed font-light">
                Users are responsible for verifying the identity and credibility of their transaction partners. 
                Rift acts as an intermediary and dispute resolution service, but final responsibility for 
                transactions lies with the parties involved.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
