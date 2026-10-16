/**
 * Webhook & Team Chat Alerts (Slack / Discord / Custom Webhook)
 */

export async function sendWebhookNotification(settings, payload) {
  if (!settings?.webhookEnabled || !settings?.webhookUrl) {
    return false;
  }

  const { event, employeeName, project, duration, note, location } = payload;
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let text = "";
  if (event === "check_in") {
    text = `🟢 *${employeeName}* clocked in on *${project || "General"}* at ${timeStr}${note ? ` ("${note}")` : ""}`;
  } else if (event === "check_out") {
    text = `🔴 *${employeeName}* clocked out from *${project || "General"}* (Worked: ${duration || "a session"})`;
  } else if (event === "break_start") {
    text = `☕ *${employeeName}* started a break`;
  } else if (event === "break_end") {
    text = `⚡ *${employeeName}* resumed working`;
  } else if (event === "overtime") {
    text = `⚠️ *${employeeName}* reached overtime threshold (> 8 hours)`;
  } else if (event === "test") {
    text = `🚀 *ZoneClock Webhook Test:* Connection successful at ${timeStr}!`;
  }

  let body = {};
  if (settings.webhookType === "discord") {
    body = {
      content: text.replace(/\*/g, "**"),
      username: "ZoneClock Bot",
    };
  } else if (settings.webhookType === "slack") {
    body = {
      text,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text },
        },
      ],
    };
  } else {
    // Custom JSON webhook
    body = {
      event,
      employeeName,
      project,
      duration,
      note,
      location,
      timestamp: new Date().toISOString(),
      formattedMessage: text,
    };
  }

  try {
    console.log(`[ZoneClock Webhook -> ${settings.webhookType || "generic"}]`, body);
    await fetch(settings.webhookUrl, {
      method: "POST",
      mode: "no-cors", // Allows sending across domains without CORS preflight blocks
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (err) {
    console.warn("[ZoneClock Webhook Error]", err);
    return false;
  }
}
