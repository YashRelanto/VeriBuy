import React, { useState } from 'react';

interface LandingPageProps {
  onAnalyze: (query: string) => void;
}

export default function LandingPage({ onAnalyze }: LandingPageProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      onAnalyze(query.trim());
    }
  };

  const handleChipClick = (preset: string) => {
    onAnalyze(preset);
  };

  return (
    <div className="bg-background text-on-background font-body-md overflow-x-hidden min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between px-margin-desktop py-stack-sm max-w-container-max mx-auto">
          <div className="flex items-center gap-stack-md">
            <span className="font-headline-md text-headline-md font-bold text-primary">VeriBuy</span>
          </div>
          <nav className="hidden md:flex items-center gap-stack-lg">
            <a className="font-body-md text-body-md text-primary border-b-2 border-primary hover:text-primary transition-colors cursor-pointer" href="#">Research Hub</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer" href="#">Marketplace Analysis</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer" href="#">Pricing</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer" href="#">Intelligence</a>
          </nav>
          <div className="flex items-center gap-stack-md">
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer">notifications</span>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer">settings</span>
            <div className="h-8 w-8 rounded-full overflow-hidden border border-outline-variant/30 bg-primary flex items-center justify-center text-on-primary font-bold">
              U
            </div>
          </div>
        </div>
      </header>

      <main className="pt-24 flex-grow">
        {/* Hero Section */}
        <section className="relative px-margin-mobile md:px-margin-desktop py-20 overflow-hidden">
          <div className="max-w-container-max mx-auto text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label-md text-label-md mb-stack-md animate-pulse">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              New: YouTube Sentiment Analysis V2
            </div>
            <h1 className="font-headline-xl text-headline-xl-mobile md:text-headline-xl mb-stack-md text-glow max-w-3xl leading-tight">
              Buy Smarter. <span className="text-primary">Not Louder.</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-12">
              AI-powered product research across Amazon, Flipkart, YouTube, and Reddit. We cut through the noise so you can make decisions with precision.
            </p>

            {/* Command Bar */}
            <form onSubmit={handleSearch} className="w-full max-w-3xl glass-card rounded-full p-2 flex items-center shadow-lg group focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <div className="pl-4 pr-3 flex items-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[28px]">search</span>
              </div>
              <input 
                className="bg-transparent border-none outline-none focus:ring-0 w-full font-headline-sm text-headline-sm placeholder:text-outline-variant py-3" 
                placeholder="What product are you looking for?" 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="hidden md:flex items-center pr-4 gap-2">
                <kbd className="px-2 py-1 bg-surface-container rounded font-label-md text-label-md text-on-surface-variant border border-outline-variant/30">Enter</kbd>
              </div>
              <button 
                type="submit"
                className="ml-2 px-8 py-3 bg-primary text-on-primary rounded-full font-label-md font-bold hover:opacity-90 transition-opacity"
              >
                Analyze
              </button>
            </form>

            {/* Prompt Chips */}
            <div className="mt-stack-lg flex flex-wrap justify-center gap-stack-sm max-w-3xl">
              <button onClick={() => handleChipClick('Best gaming laptop under ₹80,000')} className="px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all">
                Best gaming laptop under ₹80,000
              </button>
              <button onClick={() => handleChipClick('Compare iPhone vs Samsung')} className="px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all">
                Compare iPhone vs Samsung
              </button>
              <button onClick={() => handleChipClick('Best wireless earbuds under ₹5000')} className="px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-full font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all">
                Best wireless earbuds under ₹5000
              </button>
            </div>
          </div>
        </section>

        {/* Metrics Strip */}
        <section className="border-y border-outline-variant/20 bg-surface-bright py-stack-md">
          <div className="max-w-container-max mx-auto px-margin-desktop flex flex-wrap justify-around gap-stack-lg">
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-headline-md text-primary">4.2M</span>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Reviews Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-headline-md text-primary">850k</span>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Reddit Insights</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-headline-md text-primary">12k+</span>
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Brands Tracked</span>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="px-margin-mobile md:px-margin-desktop py-stack-lg max-w-container-max mx-auto">
          <div className="mb-stack-lg">
            <h2 className="font-headline-lg text-headline-lg mb-stack-xs">Decision Intelligence Engine</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">The tools we use to dismantle marketing hype and find the truth.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-6 gap-gutter">
            <div className="md:col-span-4 glass-card rounded-xl p-stack-lg hover:shadow-md transition-all group overflow-hidden relative">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="material-symbols-outlined text-primary text-[32px] mb-4">analytics</span>
                  <h3 className="font-headline-md text-headline-md">Marketplace Analysis</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">Aggregated price tracking and historical data across every major Indian retailer.</p>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2 glass-card rounded-xl p-stack-lg hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <span className="material-symbols-outlined text-primary text-[32px] mb-4">forum</span>
                <h3 className="font-headline-sm text-headline-sm">Reddit Insights</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">Real human opinions scraped from thousands of niche community threads.</p>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <div className="p-2 bg-surface-container-low rounded border border-outline-variant/10 text-[12px]">"Battery life is stellar but the screen..."</div>
                <div className="p-2 bg-surface-container-low rounded border border-outline-variant/10 text-[12px]">"Best value for money in 2024 hands down."</div>
              </div>
            </div>
            
            <div className="md:col-span-2 glass-card rounded-xl p-stack-lg hover:shadow-md transition-all">
              <span className="material-symbols-outlined text-primary text-[32px] mb-4">smart_display</span>
              <h3 className="font-headline-sm text-headline-sm">YouTube Intelligence</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">We watch the reviews so you don't have to. Transcribed, analyzed, summarized.</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 flex-grow bg-surface-container rounded overflow-hidden">
                  <div className="h-full w-4/5 sentiment-gradient"></div>
                </div>
                <span className="text-[10px] font-bold">Positive</span>
              </div>
            </div>
            
            <div className="md:col-span-2 glass-card rounded-xl p-stack-lg hover:shadow-md transition-all">
              <span className="material-symbols-outlined text-primary text-[32px] mb-4">verified_user</span>
              <h3 className="font-headline-sm text-headline-sm">Fake Review Detection</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">Our neural networks identify non-organic patterns and industrial click-farms.</p>
              <div className="mt-4 px-3 py-1 bg-error-container text-on-error-container rounded-full inline-block text-[11px] font-bold">
                Filtered 1.2M Bot Reviews
              </div>
            </div>
            
            <div className="md:col-span-2 glass-card rounded-xl p-stack-lg hover:shadow-md transition-all bg-primary-container text-on-primary">
              <span className="material-symbols-outlined text-on-primary text-[32px] mb-4">psychology</span>
              <h3 className="font-headline-sm text-headline-sm">AI Recommendations</h3>
              <p className="font-body-sm text-body-sm opacity-80 mt-2">Personalized product discovery based on your actual needs, not affiliate payouts.</p>
              <button className="mt-4 flex items-center gap-1 font-label-md text-label-md underline hover:opacity-80 transition-opacity">
                View Demo <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-stack-lg mt-auto bg-surface-bright border-t border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-col md:flex-row justify-between items-center">
          <div className="flex flex-col items-center md:items-start mb-stack-md md:mb-0">
            <span className="font-headline-sm text-headline-sm font-black text-primary mb-2">VeriBuy</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center md:text-left">© 2024 VeriBuy AI. Precision Decision Intelligence.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-stack-md">
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-opacity duration-200 underline decoration-primary/30" href="#">Marketplace Analysis</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-opacity duration-200 underline decoration-primary/30" href="#">YouTube Intelligence</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-opacity duration-200 underline decoration-primary/30" href="#">Reddit Community Insights</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-opacity duration-200 underline decoration-primary/30" href="#">Privacy Policy</a>
            <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-opacity duration-200 underline decoration-primary/30" href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
