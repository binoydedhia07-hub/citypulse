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

    // 1. LIGHTWEIGHT APIFY CALL (No SDK needed)
    let redditPosts = "No live Reddit data found.";
    
    try {
      const apifyUrl = `https://api.apify.com/v2/acts/apify~reddit-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
      
      const response = await fetch(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: `https://www.reddit.com/r/${city.replace(/\s+/g, '')}/search/?q=${vibe}&restrict_sr=1&sort=top` }],
          maxItems: 5,
          skipComments: true
        })
      });

      if (response.ok) {
        const items = await response.json();
        if (Array.isArray(items) && items.length > 0) {
          redditPosts = items.map((item: any) => 
            `Title: ${item.title}\nText: ${item.text?.slice(0, 200) || ''}`
          ).join('\n---\n');
          console.log("SUCCESS: Live Reddit data captured via Apify API.");
        }
      }
    } catch (e) {
      console.error("Apify API call failed, falling back to Gemini knowledge.");
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