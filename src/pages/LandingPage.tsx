import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Users, ShieldCheck, GraduationCap } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans">
      {/* Decorative Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 flex items-center justify-between border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
            <GraduationCap className="text-white" size={24} />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            BanoQabil
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
          <a href="#testimonials" className="hover:text-white transition-colors">Success Stories</a>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">
            Log In
          </Link>
          <Button asChild className="rounded-full px-6 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-24 pb-32 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 mb-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          Admissions are now open for Batch 4!
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-150">
          Empowering the youth with <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-primary animate-gradient">World-Class IT Education</span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 leading-relaxed">
          BanoQabil is a revolutionary platform providing 100% free, high-quality tech education, bridging the gap between talent and opportunity. Join our community of future tech leaders today.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
          <Button asChild size="lg" className="rounded-full px-8 h-14 text-base font-semibold shadow-xl shadow-primary/30 hover:scale-105 transition-all">
            <Link to="/signup" className="flex items-center gap-2">
              Apply Now <ArrowRight size={18} />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-14 text-base font-semibold border-white/20 hover:bg-white/5 hover:text-white transition-all backdrop-blur-sm bg-transparent">
            <Link to="/login">Student Portal</Link>
          </Button>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="bg-slate-900/50 border-y border-white/5 py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to succeed</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Our state-of-the-art learning management system provides a seamless experience for students, teachers, and administrators.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 text-primary border border-primary/20">
                <BookOpen size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Interactive Courses</h3>
              <p className="text-slate-400 leading-relaxed">Access high-quality course materials, submit assignments via YouTube/Drive, and track your progress in real-time.</p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              <div className="h-12 w-12 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6 text-purple-400 border border-purple-500/20">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Expert Instructors</h3>
              <p className="text-slate-400 leading-relaxed">Learn from industry professionals. Teachers can easily manage classes, grade submissions in bulk, and provide feedback.</p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:-translate-y-2 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              <div className="h-12 w-12 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6 text-green-400 border border-green-500/20">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Robust Management</h3>
              <p className="text-slate-400 leading-relaxed">Administrators have full control with granular permissions, user approvals, and comprehensive PDF reporting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 text-center text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} BanoQabil Educational Institute. All rights reserved.</p>
      </footer>
      
      <style>{`
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 8s ease infinite;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
