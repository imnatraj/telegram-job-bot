// api/webhook.js
// Vercel serverless function — handles all Telegram updates

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY   = process.env.RAPIDAPI_KEY;
const TELEGRAM_API   = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("✅ Job Bot is running.");
  }

  try {
    const { message } = req.body ?? {};
    if (!message?.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text   = String(message.text).trim();

    if (text === "/start") {
      await sendMessage(chatId,
        "🚀 *Job Bot Ready\\!*\n\nTry:\n👉 `/jobs nodejs chennai`\n👉 `/jobs backend remote`"
      );
      return res.status(200).json({ ok: true });
    }

    if (text.startsWith("/jobs")) {
      const query = text.replace(/\/jobs\s*/i, "").trim();

      if (!query) {
        await sendMessage(chatId,
          "⚠️ Add keywords after `/jobs`\nExample: `/jobs react remote`"
        );
        return res.status(200).json({ ok: true });
      }

      // Tell user we are searching
      await sendMessage(chatId,
        `🔍 Searching jobs for: *${escape(query)}*\\.\\.\\.`
      );

      // Fetch from JSearch
      const jobs = await fetchJobs(query);

      if (jobs === null) {
        await sendMessage(chatId,
          "❌ *JSearch quota exceeded\\.* Check your RapidAPI dashboard \\— the free tier has a monthly cap\\."
        );
        return res.status(200).json({ ok: true });
      }

      if (!jobs.length) {
        await sendMessage(chatId,
          "😕 *No jobs found* for those keywords\\. Try something broader\\."
        );
        return res.status(200).json({ ok: true });
      }

      // Send header
      await sendMessage(chatId, `🔥 *Found ${jobs.length} Jobs*\n━━━━━━━━━━━━━━`);

      // Send each job as its own message
      for (let i = 0; i < jobs.length; i++) {
        await sendMessage(chatId, formatJob(jobs[i], i + 1));
      }

      return res.status(200).json({ ok: true });
    }

    // Default reply
    await sendMessage(chatId,
      "💡 Type `/jobs <keyword> <location>` to search for open positions\\."
    );
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(200).json({ ok: true }); // always return 200 to Telegram
  }
}

/* ─── JSearch ─────────────────────────────────────────── */

async function fetchJobs(query) {
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("date_posted", "month");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key" : RAPIDAPI_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  console.log("JSearch status:", res.status);

  if (res.status === 429) return null;
  if (!res.ok) return [];

  const json = await res.json();
  if (!Array.isArray(json.data)) return [];

  return json.data.slice(0, 5).map(j => ({
    title    : j.job_title             || "Untitled Position",
    company  : j.employer_name         || "Unknown Company",
    location : j.job_city && j.job_country
                 ? `${j.job_city}, ${j.job_country}`
                 : (j.job_country      || "Remote"),
    type     : j.job_employment_type   || "",
    posted   : j.job_posted_at_datetime_utc
                 ? new Date(j.job_posted_at_datetime_utc).toDateString()
                 : "",
    link     : j.job_apply_link        || "",
  }));
}

/* ─── Format a single job ─────────────────────────────── */

function formatJob(j, index) {

  return `
🔥 JOB #${index}
━━━━━━━━━━━━━━
💼 ${j.title}
🏢 ${j.company}
📍 ${j.location}
💼 ${j.type || "N/A"}
📅 ${j.posted || "Recent"}

🔗 Apply:
${j.link || "N/A"}
━━━━━━━━━━━━━━
`;
}

/* ─── Telegram sender ─────────────────────────────────── */

async function sendMessage(chatId, text) {

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    }),
  });

  const body = await res.text();

  console.log("Telegram:", body);
}

/* ─── Helpers ─────────────────────────────────────────── */

function escape(t = "") {
  return t.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
