// api/cron.js

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const RAPIDAPI_KEY   = process.env.RAPIDAPI_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export default async function handler(req, res) {

  try {

    // Define different target chats with their own queries
    const targets = [
      {
        chatId: process.env.TELEGRAM_CHAT_ID, // Your original chat
        title: "Weekly Chennai & Remote Node.js Jobs",
        queries: [
          "nodejs developer chennai",
          "backend developer chennai",
          "remote nodejs india",
          "remote backend developer india",
          "fullstack developer remote india"
        ]
      },
      {
        chatId: process.env.TELEGRAM_CHAT_ID_2, // Add this to your Vercel env
        title: "Weekly Frontend Jobs",
        queries: [
          "react developer remote india",
          "frontend developer chennai"
        ]
      },
      {
        chatId: process.env.TELEGRAM_CHAT_ID_3, // Add this to your Vercel env
        title: "Weekly Python Jobs",
        queries: [
          "python developer remote india",
          "django developer chennai"
        ]
      }
    ];

    for (const target of targets) {
      if (!target.chatId) continue; // Skip if chat ID is missing from environment variables

      let jobs = [];

      for (const q of target.queries) {
        const result = await fetchJobs(q);

        if (result === null) {
          console.log("⚠️ Quota exceeded detected! Attempting to notify Telegram...");
          await sendMessage(
            process.env.TELEGRAM_CHAT_ID, // Notify your main personal account
            "❌ *JSearch quota exceeded.* Your RapidAPI free tier monthly cap has been reached."
          );
          return res.status(200).send("Quota Exceeded");
        }

        if (result?.length) {
          jobs.push(...result);
        }
      }

      // Remove duplicates for this specific chat
      const unique = [];
      const seen = new Set();

      for (const j of jobs) {
        const uniqueKey = j.link || `${j.title}-${j.company}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          unique.push(j);
        }
      }

      const finalJobs = unique.slice(0, 10);

      if (finalJobs.length === 0) {
        await sendMessage(
          target.chatId,
          "😕 *Weekly Update: No new jobs found this week.*"
        );
        continue; // Check the next target in the list instead of stopping completely
      }

      await sendMessage(
        target.chatId,
        `🔥 *${target.title}*\n📅 Friday Update\n━━━━━━━━━━━━━━`
      );

      for (let i = 0; i < finalJobs.length; i++) {
        await sendMessage(
          target.chatId,
          formatJob(finalJobs[i], i + 1)
        );
      }
    }

    return res.status(200).send("Done");

  } catch (err) {

    console.error("Cron error:", err);

    return res.status(500).send("Error");
  }
}

/* ───────────────────────────────────── */

async function fetchJobs(query) {

  const url = new URL("https://jsearch.p.rapidapi.com/search");

  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("date_posted", "week");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
  });

  console.log("JSearch status:", res.status);

  if (res.status === 429) return null;
  if (!res.ok) return [];

  const json = await res.json();

  if (!Array.isArray(json.data)) return [];

  return json.data.slice(0, 5).map(j => ({
    title    : j.job_title || "Untitled Position",
    company  : j.employer_name || "Unknown Company",
    location : j.job_city && j.job_country
      ? `${j.job_city}, ${j.job_country}`
      : (j.job_country || "Remote"),
    type     : j.job_employment_type || "",
    posted   : j.job_posted_at_datetime_utc
      ? new Date(j.job_posted_at_datetime_utc).toDateString()
      : "",
    link     : j.job_apply_link || "",
  }));
}

/* ───────────────────────────────────── */

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

/* ───────────────────────────────────── */

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

/* ───────────────────────────────────── */

function escape(t = "") {

  return t.replace(
    /([_*\[\]()~`>#+\-=|{}.!\\])/g,
    "\\$1"
  );
}