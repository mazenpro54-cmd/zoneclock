/**
 * webhooks.js — Real-Time Instant Manager Alerts (Slack, Discord & Custom Webhooks)
 * Sends rich formatted notification cards for Check-ins, Check-outs, Zone Breaches & Overtime.
 */

export async function sendWebhookNotification(settings, payload) {
  if (!settings?.webhookEnabled || !settings?.webhookUrl) {
    return false;
  }

  // Check granular notification triggers if defined
  const triggers = settings.webhookTriggers || {
    checkIn: true,
    checkOut: true,
    zoneExit: true,
    overtime: true,
  };

  const {
    event,
    employeeName,
    project,
    duration,
    note,
    location,
    distanceM,
    maxAllowedM,
    overtimeHours,
    exitReason,
  } = payload;

  if (event === "check_in" && triggers.checkIn === false) return false;
  if (event === "check_out" && triggers.checkOut === false) return false;
  if (event === "zone_exit_breach" && triggers.zoneExit === false) return false;
  if (event === "overtime" && triggers.overtime === false) return false;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString();

  let title = "ZoneClock Notification";
  let description = "";
  let color = 0x6366f1; // Indigo default
  let slackEmoji = "🔔";

  switch (event) {
    case "check_in":
      title = "🟢 Employee Checked In";
      description = `**${employeeName}** started working on **${project || "General"}**.\n⏰ **Time:** ${timeStr} (${dateStr})${note ? `\n📝 **Note:** "${note}"` : ""}`;
      color = 0x10b981; // Green
      slackEmoji = "🟢";
      break;

    case "check_out":
      title = "🔴 Employee Checked Out";
      description = `**${employeeName}** concluded session on **${project || "General"}**.\n⏱️ **Duration:** ${duration || "a session"}\n🚪 **Reason:** ${exitReason === "auto_geofence_exit" ? "⚠️ Auto-checkout (Exited Geofence Zone)" : "Manual Check-Out"}`;
      color = 0xef4444; // Red
      slackEmoji = "🔴";
      break;

    case "zone_exit_breach":
      title = "🚨 Workplace Geofence Breach Alert";
      description = `⚠️ **${employeeName}** has exited the assigned workplace zone!\n📏 **Distance:** ${distanceM || "Unknown"}m from office center (Allowed radius: ${maxAllowedM || 200}m).\n🔒 **Action Taken:** Session automatically closed for time tracking integrity.`;
      color = 0xf97316; // Orange / Red
      slackEmoji = "🚨";
      break;

    case "overtime":
      title = "⏰ Daily Overtime Threshold Exceeded";
      description = `⚠️ **${employeeName}** has exceeded **${overtimeHours || 8} hours** on shift today.\n💼 **Current Project:** ${project || "General"}\n💰 Pay multiplier (1.5x overtime) applied.`;
      color = 0xeab308; // Yellow
      slackEmoji = "⏰";
      break;

    case "break_start":
      title = "☕ Employee On Break";
      description = `**${employeeName}** paused working on **${project || "General"}** to take a break.`;
      color = 0x8b5cf6;
      slackEmoji = "☕";
      break;

    case "break_end":
      title = "⚡ Employee Resumed Work";
      description = `**${employeeName}** returned from break on **${project || "General"}**.`;
      color = 0x3b82f6;
      slackEmoji = "⚡";
      break;

    case "test":
    default:
      title = "🚀 ZoneClock Webhook Connection Test";
      description = `✅ Connection successfully verified!\nZoneClock alerts are operational for **${settings.webhookType?.toUpperCase() || "WEBHOOK"}**.`;
      color = 0x6366f1;
      slackEmoji = "🚀";
      break;
  }

  let body = {};

  if (settings.webhookType === "discord") {
    body = {
      username: "ZoneClock Bot",
      avatar_url: "https://zoneclock.vercel.app/clock.svg",
      embeds: [
        {
          title,
          description,
          color,
          footer: { text: "ZoneClock Real-Time Workplace Monitoring" },
          timestamp: now.toISOString(),
        },
      ],
    };
  } else if (settings.webhookType === "slack") {
    body = {
      text: `${slackEmoji} *${title}*\n${description.replace(/\*\*/g, "*")}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${slackEmoji} ${title}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: description.replace(/\*\*/g, "*"),
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `📍 *ZoneClock Intelligence* • ${timeStr} • ${dateStr}`,
            },
          ],
        },
      ],
    };
  } else {
    // Custom JSON Webhook
    body = {
      event,
      title,
      employeeName,
      project,
      duration,
      note,
      location,
      distanceM,
      maxAllowedM,
      exitReason,
      timestamp: now.toISOString(),
      formattedMessage: description,
    };
  }

  try {
    console.log(`[ZoneClock Webhook -> ${settings.webhookType || "generic"}]`, body);
    await fetch(settings.webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (err) {
    console.warn("[ZoneClock Webhook Error]", err);
    return false;
  }
}
