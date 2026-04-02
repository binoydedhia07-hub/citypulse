import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const { city, vibe } = await req.json();

    // 1. FREE WEB CRAWL: Fetch live Reddit data without an API key
    // We search the specific city subreddit for the requested vibe
    const redditUrl = `https://www.reddit.com/r/${city.replace(/\s+/g, '')}/search.json?q=${vibe}&restrict_sr=on&sort=top&t=year&limit=10`;
    
    const redditRes = await fetch(redditUrl);
    const redditData = await redditRes.json();
    
    // Extract titles and main text from Reddit posts to feed to Gemini
    const posts = redditData.data?.children.map((child: any) => 
      `Title: ${child.data.title}\nText: ${child.data.selftext.slice(0, 300)}`
    ).join('\n\n---\n\n') || "No Reddit data found.";

    // 2. THE REASONING LAYER: Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
      You are a local travel expert. A user is visiting ${city} and looking for a "${vibe}" vibe.
      Here is the latest raw data scraped from the local Reddit community:
      ${posts}
      
      Based ONLY on the provided Reddit data, extract 3 actual places or specific recommendations.
      If the Reddit data is empty or irrelevant, suggest 3 highly accurate places in ${city} that match the vibe.
      
      Return ONLY a JSON array of objects with this exact structure:
      [
        {
          "name": "Name of the place",
          "why": "A 2-sentence explanation of why it fits the vibe, citing Reddit sentiment if available.",
          "vibeScore": "A rating out of 10 based on the hype."
        }
      ]
    `;

    // Force Gemini to return clean JSON
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const recommendations = JSON.parse(result.response.text());

    return NextResponse.json({ recommendations });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to generate vibe check.' }, { status: 500 });
  }
}