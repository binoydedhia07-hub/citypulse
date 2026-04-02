import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { city, vibe } = await req.json();
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY || !APIFY_TOKEN) {
      throw new Error("API Keys are not configured in Vercel.");
    }

    // 1. FIXED APIFY ENDPOINT (using the correct ~ separator)
    let redditPosts = "No live Reddit data found.";
    
    try {
      // Corrected Actor ID: khadinakbar~reddit-posts-comments-scraper
      const apifyUrl = `https://api.apify.com/v2/acts/khadinakbar~reddit-posts-comments-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
      
      const response = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The specific input this scraper expects
          queries: `${city} ${vibe}`,
          maxPosts: 5,
          searchType: "link" 
        })
      });

      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          redditPosts = items.map((item: any) => 
            `Title: ${item.title}\nText: ${item.selftext?.slice(0, 200) || ''}`
          ).join('\n---\n');
          console.log("SUCCESS: Captured live Reddit pulse.");
        }
      } else {
        console.error("Apify API error:", response.status);
      }
    } catch (e) {
      console.error("Crawl failed, proceeding with AI knowledge.");
    }

    // 2. AI REASONING (Gemini 1.5 Flash Latest)
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    // CHANGE THIS LINE:
    // CHANGE THIS LINE:
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      You are a local travel expert for ${city}.
      User is looking for a "${vibe}" vibe.
      
      Here is some recent raw sentiment from local Reddit threads:
      ${redditPosts}
      
      Extract 3 real, specific places. If Reddit is sparse, use your deep expert knowledge.
      Return ONLY a raw JSON array:
      [{"name": "Place Name", "why": "2-sentence pitch based on vibe/sentiment", "vibeScore": "1-10"}]
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const recommendations = JSON.parse(text);

    return NextResponse.json({ recommendations });

  } catch (error: any) {
    console.error("Critical Backend Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}