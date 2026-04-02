'use client';
import { useState } from 'react';

export default function Home() {
  const [city, setCity] = useState('');
  const [vibe, setVibe] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');

  const generateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    
    // UX Trick: Simulate complex processing to build trust
    setProgressText('Crawling local subreddits...');
    setTimeout(() => setProgressText('Cross-referencing with Gemini AI...'), 2000);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, vibe }),
      });
      
      const data = await response.json();
      setResults(data.recommendations);
    } catch (error) {
      console.error(error);
      alert('Failed to find the vibe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            VibeCheck
          </h1>
          <p className="text-neutral-400">Skip the tourist traps. Find the real scene.</p>
        </header>

        {/* The Intake Form */}
        <form onSubmit={generateTrip} className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 mb-8">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-neutral-300">Where are you going?</label>
            <input 
              type="text" 
              required
              placeholder="e.g. London, Mumbai, Tokyo" 
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-neutral-300">What's the vibe?</label>
            <select 
              required
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
            >
              <option value="" disabled>Select a subculture...</option>
              <option value="hidden gem coffee shops quiet">Quiet / Specialty Coffee</option>
              <option value="underground techno clubbing">High Energy / Techno</option>
              <option value="craft beer breweries social">Social / Craft Beer</option>
              <option value="thrift shopping vintage">Aesthetic / Vintage Shopping</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading ? 'Scanning the Vibe...' : 'Check the Vibe'}
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-10 animate-pulse text-neutral-400">
            {progressText}
          </div>
        )}

        {/* Results UI */}
        <div className="space-y-4">
          {results.map((place, index) => (
            <div key={index} className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-purple-500/50 transition">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{place.name}</h3>
                <p className="text-sm text-neutral-400 mb-3">{place.why}</p>
                <span className="inline-block bg-purple-900/50 text-purple-300 text-xs px-2 py-1 rounded-md border border-purple-800">
                  Vibe Score: {place.vibeScore}/10
                </span>
              </div>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + city)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-neutral-800 hover:bg-neutral-700 text-sm px-4 py-2 rounded-lg whitespace-nowrap transition"
              >
                View on Map ↗
              </a>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}