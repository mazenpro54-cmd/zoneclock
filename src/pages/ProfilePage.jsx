import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { doc, updateDoc } from "../firebaseCompat";
import { db } from "../firebase";
import { TIMEZONES } from "../services/timezone";
import { sendWebhookNotification } from "../services/webhooks";
import {
  User, Mail, Shield, LogOut, Globe, MapPin, Bell,
  Clock, Download, CheckCircle, Navigation, MessageSquare, Send, Compass, Fingerprint, Sparkles, AlertTriangle, KeyRound
} from "lucide-react";
import GoogleMapsZonePicker from "../components/GoogleMapsZonePicker";
import {
  isBiometricsAvailable,
  isBiometricEnrolled,
  registerBiometricCredential,
  removeBiometricCredential
} from "../services/biometrics";

export default function ProfilePage() {
  const { user, profile, logout, changePassword } = useAuth();
  const { settings, updateSettings } = useSettings();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [webhookTested, setWebhookTested] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(isBiometricEnrolled());
  const [biometricRegistering, setBiometricRegistering] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdError, setPwdError] = useState("");

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricsSupported);
  }, []);

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

  async function handleRegisterBiometrics() {
    setBiometricRegistering(true);
    try {
      await registerBiometricCredential(user?.email || "employee@zoneclock.app");
      setBiometricsEnrolled(true);
      updateSettings({ biometricClockIn: true });
      alert("✅ Biometric credential registered successfully! You can now use Face ID / Touch ID / Fingerprint to clock in.");
    } catch (err) {
      alert("Registration failed: " + err.message);
    } finally {
      setBiometricRegistering(false);
    }
  }

  function handleRemoveBiometrics() {
    if (confirm("Disable and remove stored biometric credentials on this device?")) {
      removeBiometricCredential();
      setBiometricsEnrolled(false);
      updateSettings({ biometricClockIn: false });
    }
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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdError("");
    setPwdSuccess("");
    if (!newPassword || newPassword.length < 6) {
      setPwdError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword(newPassword);
      setPwdSuccess("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwdSuccess(""), 4000);
    } catch (err) {
      setPwdError(err.message || "Failed to update password.");
    } finally {
      setPwdLoading(false);
    }
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text)" }}>Auto Check-Out on Zone Exit</span>
                      <p className="muted-small" style={{ margin: "2px 0 0" }}>Keep session active when app is closed. Only check out if you exit the work zone or tap Check Out.</p>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle-switch"
                      checked={settings.autoCheckoutOnExit !== false}
                      onChange={(e) => updateSettings({ autoCheckoutOnExit: e.target.checked })}
                    />
                  </div>
                  <GoogleMapsZonePicker />
                </div>
              )}
            </div>

            {/* One-Tap Biometric Clock-In Section */}
            <div className="zone-box">
              <div className="zone-box-header">
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Fingerprint size={16} style={{ color: "#6366f1" }} />
                    One-Tap Biometric Clock-In
                  </h4>
                  <p className="muted-small">Authenticate via Face ID, Touch ID, or Windows Hello for instant check-in</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle-switch"
                  checked={settings.biometricClockIn || false}
                  onChange={(e) => updateSettings({ biometricClockIn: e.target.checked })}
                />
              </div>

              {settings.biometricClockIn && (
                <div className="zone-controls" style={{ paddingTop: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "var(--text)" }}>
                        {biometricsEnrolled ? "✅ Device Biometrics Enrolled" : "⚠️ Biometrics Not Registered Yet"}
                      </span>
                      <p className="muted-small" style={{ margin: "2px 0 0" }}>
                        {biometricsEnrolled
                          ? "Your fingerprint / Face ID is registered and ready for 1-tap check in."
                          : "Enroll your biometric passkey on this browser to activate."}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      {!biometricsEnrolled ? (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: "12px", padding: "6px 12px" }}
                          onClick={handleRegisterBiometrics}
                          disabled={biometricRegistering}
                        >
                          <Sparkles size={14} />
                          {biometricRegistering ? "Scanning..." : "Register Biometrics"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ fontSize: "12px", padding: "6px 10px", color: "#ef4444" }}
                          onClick={handleRemoveBiometrics}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Team Chat & Instant Webhook Alerts */}
            <div className="zone-box">
              <div className="zone-box-header">
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageSquare size={16} style={{ color: "#10b981" }} />
                    Team Chat & Real-Time Alerts
                  </h4>
                  <p className="muted-small">Post check-in, geofence departure, and overtime alerts to Slack or Discord</p>
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

                  {/* Granular Alert Triggers */}
                  <div style={{ marginTop: "10px", padding: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text)", display: "block", marginBottom: "8px" }}>
                      Active Alert Triggers
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.8rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={settings.webhookTriggers?.checkIn !== false}
                          onChange={(e) => updateSettings({
                            webhookTriggers: { ...settings.webhookTriggers, checkIn: e.target.checked }
                          })}
                        />
                        <span>🟢 Check-In</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={settings.webhookTriggers?.checkOut !== false}
                          onChange={(e) => updateSettings({
                            webhookTriggers: { ...settings.webhookTriggers, checkOut: e.target.checked }
                          })}
                        />
                        <span>🔴 Check-Out</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={settings.webhookTriggers?.zoneExit !== false}
                          onChange={(e) => updateSettings({
                            webhookTriggers: { ...settings.webhookTriggers, zoneExit: e.target.checked }
                          })}
                        />
                        <span>🚨 Zone Departure</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={settings.webhookTriggers?.overtime !== false}
                          onChange={(e) => updateSettings({
                            webhookTriggers: { ...settings.webhookTriggers, overtime: e.target.checked }
                          })}
                        />
                        <span>⏰ Daily Overtime</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-outline btn-sm-block"
                    style={{ marginTop: "12px" }}
                    onClick={handleTestWebhook}
                  >
                    <Send size={13} />
                    {webhookTested ? "✓ Test Alert Sent!" : "Send Test Webhook Message"}
                  </button>
                </div>
              )}
            </div>

            {/* Account Security & Password */}
            <div className="zone-box">
              <div className="zone-box-header">
                <div>
                  <h4 style={{ fontSize: "0.9rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <KeyRound size={16} style={{ color: "var(--accent)" }} />
                    Account Security & Password
                  </h4>
                  <p className="muted-small">Change your account sign-in password</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span>New Password</span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span>Confirm Password</span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </label>
                </div>

                {pwdError && <p className="error-msg" style={{ margin: "2px 0 0" }}>{pwdError}</p>}
                {pwdSuccess && (
                  <p style={{ color: "#10b981", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px", margin: "2px 0 0" }}>
                    <CheckCircle size={14} /> {pwdSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pwdLoading || !newPassword}
                  className="btn-outline"
                  style={{ alignSelf: "flex-start", marginTop: "4px" }}
                >
                  <KeyRound size={14} />
                  {pwdLoading ? "Updating…" : "Update Password"}
                </button>
              </form>
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
