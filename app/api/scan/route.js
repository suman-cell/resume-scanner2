export const dynamic = "force-dynamic";

import Groq from "groq-sdk";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export async function POST(req) {
  const { resume, jd } = await req.json();

  if (!resume?.trim() || !jd?.trim()) {
    return Response.json(
      { error: "Both resume and job description are required." },
      { status: 400 }
    );
  }

  const prompt = `You are an ATS (Applicant Tracking System) simulator and technical recruiter. Compare the RESUME against the JOB DESCRIPTION below and respond with ONLY valid JSON, no markdown fences, no preamble.

RESUME:
"""${resume.slice(0, 6000)}"""

JOB DESCRIPTION:
"""${jd.slice(0, 6000)}"""

Return this exact JSON shape:
{
  "matchScore": <integer 0-100, overall ATS match likelihood>,
  "verdict": "<one short punchy sentence, e.g. 'Strong match — minor gaps' or 'Needs work before applying'>",
  "matchedKeywords": ["keyword1", "keyword2", ...up to 12],
  "missingKeywords": ["keyword1", "keyword2", ...up to 10],
  "suggestions": ["specific actionable suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]
}`;

  try {
    if (!groq) {
      return Response.json(
        { error: "Server missing GROQ_API_KEY. Add it to your environment variables." },
        { status: 500 }
      );
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 700,
    });

    const raw = completion.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return Response.json(parsed);
  } catch (err) {
    return Response.json(
      { error: "Scan failed: " + String(err.message || err).slice(0, 200) },
      { status: 500 }
    );
  }
}
