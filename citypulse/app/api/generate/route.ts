import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { city, vibe } = await req.json();
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_KEY || !APIFY_TOKEN) {
      throw new Error("Missing API Keys");
    }

    // 1. ROBUST APIFY CALL
    let redditPosts = "No live Reddit data found.";
    
    try {
      // Switched to a faster endpoint that fetches existing data or runs a quicker scrape
      const apifyUrl = `https://api.apify.com/v2/acts/apify~reddit-scraper/run-sync?token=${APIFY_TOKEN}&timeout=30`;
      
      const response = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: `${city} ${vibe}`,
          type: 'posts',
          maxItems: 3, // Lowering items for speed to ensure the 500 error goes away
          sort: 'relevance'
        })
      });

      if (response.ok) {
        const runResult = await response.json();
        // Get the dataset ID from the successful run
        const datasetId = runResult.data.defaultDatasetId;
        
        // Quickly fetch the items from that dataset
        const itemsResponse = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        const items = await itemsResponse.json();
        
        if (Array.isArray(items) && items.length > 0) {
          redditPosts = items.map((item: any) => 
            `Title: ${item.title}\nText: ${item.text?.slice(0, 150) || ''}`
          ).join('\n---\n');
          console.log("SUCCESS: Captured Reddit data.");
        }
      } else {
        console.error("Apify returned error status:", response.status);
      }
    } catch (e) {
      console.error("Crawl failed, using fallback.");
    }
    // 2. AI SYNTHESIS
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
      City: ${city} | Requested Vibe: ${vibe}
      Live Reddit Context: ${redditPosts}
      
      If the Reddit context is useful, use it. Otherwise, use your expert knowledge of ${city}.
      Suggest 3 places. Return ONLY a raw JSON array:
      [{"name": "Place", "why": "Explanation", "vibeScore": "1-10"}]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
    const recommendations = JSON.parse(text);

    return NextResponse.json({ recommendations });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}