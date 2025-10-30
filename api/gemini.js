/**
 * This is your new backend "proxy" function.
 * - Save this file as `api/gemini.js`.
 * - It will live at the URL endpoint "/api/gemini".
 * - It reads your API key from "Environment Variables", NOT from the code.
 * - You must set an Environment Variable in your hosting provider (Vercel, Netlify, etc.)
 * named: GEMINI_API_KEY
 */

// We use this handler format for serverless functions
export default async function handler(req, res) {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // 2. Get the API key securely from environment variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'API key is not configured on the server.' });
        return;
    }

    const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // 3. Get the parameters from the frontend's request body
    const { userQuery, systemPrompt, useGrounding } = req.body;

    if (!userQuery) {
        res.status(400).json({ error: 'userQuery is required.' });
        return;
    }

    // 4. Build the payload to send to Google (same as before)
    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
    };

    if (useGrounding) {
        payload.tools = [{ "google_search": {} }];
    }

    if (systemPrompt) {
        payload.systemInstruction = {
            parts: [{ text: systemPrompt }]
        };
    }

    // 5. Make the "real" API call from the server
    try {
        const googleResponse = await fetch(googleApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!googleResponse.ok) {
            const errorBody = await googleResponse.text();
            console.error("Google API Error:", errorBody);
            // Pass the error from Google back to the frontend
            res.status(googleResponse.status).json({ error: `Google API Error: ${errorBody}` });
            return;
        }

        const result = await googleResponse.json();

        // 6. Extract the data and send it back to the frontend
        const candidate = result.candidates?.[0];
        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }
            
            // Send the clean { text, sources } object to the frontend
            res.status(200).json({ text, sources });

        } else {
            console.error("Invalid Google API response structure:", result);
            res.status(500).json({ error: 'The API returned an unexpected response.' });
        }

    } catch (error) {
        console.error("Server-side fetch error:", error);
        res.status(500).json({ error: `Server error: ${error.message}` });
    }
}
