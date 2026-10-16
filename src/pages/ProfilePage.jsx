import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { doc, updateDoc } from "../firebaseCompat";
import { db } from "../firebase";
import { TIMEZONES } from "../services/timezone";
import { sendWebhookNotification } from "../services/webhooks";
import {
  User, Mail, Shield, LogOut, Globe, MapPin, Bell,
  Clock, Download, CheckCircle, Navigation, MessageSquare, Send, Compass
} from "lucide-react";
import GoogleMapsZonePicker from "../components/GoogleMapsZonePicker";

export default function ProfilePage() {
  const { user, profile, logout } = useAuth();
  const { settings, updateSettings } = useSettings();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [webhookTested, setWebhookTested] = useState(false);

  // Listen for PWA install event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setInstallPrompt(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function handleInstallPWA() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { displayName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCaptureOfficeLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateSettings({
          zoneLat: pos.coords.latitude,
          zoneLng: pos.coords.longitude,
          zoneEnforcement: true,
        });
        setGpsLoading(false);
      },
      (err) => {
        alert("GPS Error: " + err.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }

  async function handleTestWebhook() {
    if (!settings.webhookUrl) {
      alert("Please enter a Webhook URL first.");
      return;
    }
    await sendWebhookNotification(settings, {
      event: "test",
      employeeName: displayName || "Mazen",
    });
    setWebhookTested(true);
    setTimeout(() => setWebhookTested(false), 3000);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2><User size={20} /> My Profile & Preferences</h2>
      </div>

      <div className="profile-grid">
        {/* User Card */}
        <div className="profile-card">
          <div className="avatar-ring">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="avatar" className="avatar-img" />
            ) : (
              <div className="avatar-initials">
                {(displayName || user?.email || "U")[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="profile-form">
            <label className="field">
              <User size={14} />
              <span>Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
              />
            </label>
            <label className="field">
              <Mail size={14} />
              <span>Email</span>
              <input type="email" value={user?.email || ""} disabled />
            </label>
            <label className="field">
              <Shield size={14} />
              <span>Role</span>
              <input type="text" value={profile?.role || "employee"} disabled />
            </label>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saved ? "✓ Saved Profile!" : saving ? "Saving…" : "Save Changes"}
            </button>
          </form>

          {/* PWA Install Button */}
          {installPrompt && (
            <button onClick={handleInstallPWA} className="btn-pwa">
              <Download size={16} /> Install ZoneClock on Home Screen
            </button>
          )}
          {installed && (
            <p className="pwa-status">
              <CheckCircle size={14} /> App installed on device
            </p>
          )}
        </div>

        {/* Work & Zone Settings */}
        <div className="profile-card">
          <h3 className="settings-section-title">
            <Globe size={18} /> Workplace & Zone Settings
          </h3>

          <div className="settings-stack">
            {/* Timezone */}
            <label className="field">
              <span>Timezone</span>
              <select
                value={settings.timezone}
                onChange={(e) => updateSettings({ timezone: e.target.value })}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </label>

            {/* Inactivity idle timeout */}
            <label className="field">
              <div className="field-title-row">
                <Clock size={14} />
                <span>Inactivity Warning Timeout</span>
              </div>
              <select
                value={settings.idleTimeoutMinutes || 5}
                onChange={(e) => updateSettings({ idleTimeoutMinutes: Number(e.target.value) })}
              >
                <option value={2}>2 Minutes (Strict)</option>
                <option value={5}>5 Minutes (Recommended)</option>
                <option value={10}>10 Minutes</option>
                <option value={15}>15 Minutes</option>
              </select>
            </label>

            {/* Overtime hours threshold */}
            <label className="field">
              <div className="field-title-row">
                <Clock size={14} />
                <span>Overtime Alert Threshold</span>
              </div>
              <select
                value={settings.overtimeHours}
                onChange={(e) => updateSettings({ overtimeHours: Number(e.target.value) })}
              >
                <option value={6}>6 Hours</option>
                <option value={7}>7 Hours</option>
                <option value={8}>8 Hours (Standard)</option>
                <option value={9}>9 Hours</option>
                <option value={10}>10 Hours</option>
              </select>
            </label>

            {/* Daily check-in reminder hour */}
            <label className="field">
              <div className="field-title-row">
                <Bell size={14} />
                <span>Daily Check-in Reminder</span>
              </div>
              <select
                value={settings.reminderHour}
                onChange={(e) => updateSettings({ reminderHour: Number(e.target.value) })}
              >
                <option value={7}>7:00 AM</option>
                <option value={8}>8:00 AM</option>
                <option value={9}>9:00 AM</option>
                <option value={10}>10:00 AM</option>
              </select>
            </label>

            {/* Work Zone Geofence */}
            <div className="zone-box">
              <div className="zone-box-header">
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text)" }}>Work Zone Geofence & Google Maps</h4>
                  <p className="muted-small">Configure office coordinates and geofence radius on Google Maps</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={settings.zoneEnforcement}
                  onChange={(e) => updateSettings({ zoneEnforcement: e.target.checked })}
                />
              </div>

              {settings.zoneEnforcement && (
                <div className="zone-controls" style={{ paddingTop: "0.75rem" }}>
                  <GoogleMapsZonePicker />
                </div>
              )}
            </div>

            {/* Team Chat & Webhooks Section */}
            <div className="zone-box">
              <div className="zone-box-header">
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text)" }}>
                    Team Chat & Webhooks
                  </h4>
                  <p className="muted-small">Post check-in/out alerts to Slack or Discord</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={settings.webhookEnabled || false}
                  onChange={(e) => updateSettings({ webhookEnabled: e.target.checked })}
                />
              </div>

              {settings.webhookEnabled && (
                <div className="zone-controls">
                  <label className="field">
                    <span>Platform</span>
                    <select
                      value={settings.webhookType || "slack"}
                      onChange={(e) => updateSettings({ webhookType: e.target.value })}
                    >
                      <option value="slack">Slack Incoming Webhook</option>
                      <option value="discord">Discord Channel Webhook</option>
                      <option value="custom">Generic HTTP Webhook (JSON)</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Webhook URL</span>
                    <input
                      type="url"
                      value={settings.webhookUrl || ""}
                      onChange={(e) => updateSettings({ webhookUrl: e.target.value })}
                      placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                    />
                  </label>

                  <button
                    type="button"
                    className="btn-outline btn-sm-block"
                    onClick={handleTestWebhook}
                  >
                    <Send size={13} />
                    {webhookTested ? "✓ Test Alert Sent!" : "Send Test Webhook Message"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="profile-divider" style={{ marginTop: "1rem" }} />
          <button onClick={logout} className="btn-danger">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
