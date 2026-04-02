import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { city, vibe } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing Gemini API Key");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

   // 1. THE ACTUAL BACKEND FIX FOR REDDIT
    let posts = "No live Reddit data available. Rely strictly on your training data for highly accurate local recommendations.";
    
    try {
      // Swapped to api.reddit.com which is less hostile to server requests
      const redditUrl = `https://api.reddit.com/r/${city.replace(/\s+/g, '')}/search?q=${vibe}&restrict_sr=on&sort=top&t=year&limit=10`;
      
      const redditRes = await fetch(redditUrl, {
        headers: { 
          // Reddit strictly enforces this exact User-Agent format for API access
          'User-Agent': 'web:com.vibecheck.app:v1.0 (by /u/vibecheck_admin)',
          'Accept': 'application/json'
        },
        cache: 'no-store' // Force fresh fetch, don't let Vercel cache a dead response
      });
      
      const contentType = redditRes.headers.get("content-type");
      if (redditRes.ok && contentType && contentType.includes("application/json")) {
        const redditData = await redditRes.json();
        
        if (redditData.data && redditData.data.children && redditData.data.children.length > 0) {
          posts = redditData.data.children.map((child: any) => 
            `Title: ${child.data.title}\nText: ${child.data.selftext.slice(0, 300)}`
          ).join('\n\n---\n\n');
        }
      } else {
         console.error("Reddit blocked the API request. Status:", redditRes.status);
      }
    } catch (redditError) {
      console.error("Reddit fetch failed:", redditError);
    }
    // 2. THE REASONING LAYER
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are a local travel expert. A user is visiting ${city} and looking for a "${vibe}" vibe.
      
      Here is the latest raw data scraped from the local Reddit community (if available):
      ${posts}
      
      Based on the Reddit data OR your own expert knowledge of ${city}, extract or suggest 3 highly accurate places that match the exact vibe.
      
      Return ONLY a raw JSON array of objects with this exact structure (no markdown, no backticks, no extra text):
      [
        {
          "name": "Name of the place",
          "why": "A 2-sentence explanation of why it fits the vibe.",
          "vibeScore": "A rating out of 10 based on the hype."
        }
      ]
    `;

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    // 3. CLEAN AND PARSE THE AI RESPONSE
    let rawText = result.response.text();
    // Strip any markdown code blocks if Gemini accidentally includes them
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const recommendations = JSON.parse(rawText);

    return NextResponse.json({ recommendations });

  } catch (error: any) {
    console.error("Backend Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate vibe check.' }, { status: 500 });
  }
}