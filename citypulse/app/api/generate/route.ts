import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApifyClient } from 'apify-client';

// CRITICAL: Vercel defaults to 10s timeouts. Apify needs more time.
// This allows the serverless function to run for up to 60 seconds.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { city, vibe } = await req.json();

    if (!process.env.GEMINI_API_KEY || !process.env.APIFY_API_TOKEN) {
      throw new Error("Missing Gemini or Apify API Keys in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

    // 1. THE APIFY CRAWL
    let posts = "No Reddit data found.";
    try {
      // We call the official Apify Reddit Scraper
      const run = await apifyClient.actor("apify/reddit-scraper").call({
        startUrls: [{ url: `https://www.reddit.com/r/${city.replace(/\s+/g, '')}/search/?q=${vibe}&restrict_sr=1&sort=top` }],
        maxItems: 10,
        skipComments: true
      });

      // Fetch the results from the Apify dataset
      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
      
      if (items.length > 0) {
        posts = items.map((item: any) => 
          `Title: ${item.title}\nText: ${item.text?.slice(0, 300) || ''}`
        ).join('\n\n---\n\n');
        console.log("Apify successfully scraped Reddit!");
      }
    } catch (apifyError) {
      console.error("Apify Crawl Failed:", apifyError);
    }

    // 2. THE AI SYNTHESIS
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    
    const prompt = `
      You are a local travel expert. A user is visiting ${city} and looking for a "${vibe}" vibe.
      
      Here is the live data just scraped from Reddit via our web crawler:
      ${posts}
      
      Based ONLY on this Reddit data, extract 3 actual places or specific recommendations.
      If the crawled data is irrelevant, use your own knowledge to suggest 3 highly accurate places in ${city}.
      
      Return ONLY a raw JSON array of objects with this exact structure (no markdown):
      [
        {
          "name": "Name of the place",
          "why": "A 2-sentence explanation of why it fits the vibe, citing the Reddit sentiment.",
          "vibeScore": "A rating out of 10 based on the hype."
        }
      ]
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    let rawText = result.response.text();
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const recommendations = JSON.parse(rawText);

    return NextResponse.json({ recommendations });

  } catch (error: any) {
    console.error("Backend Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate vibe check.' }, { status: 500 });
  }
}