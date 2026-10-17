/**
 * biometrics.js — WebAuthn Platform Authenticator & Biometric Clock-In
 * Supports Touch ID, Face ID, Windows Hello, and Android Biometrics.
 */

const CREDENTIAL_STORAGE_KEY = "zoneclock_biometric_credential";

/**
 * Checks if the current browser/device supports WebAuthn platform biometrics.
 */
export async function isBiometricsAvailable() {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Checks if user has already enrolled a biometric credential on this device.
 */
export function isBiometricEnrolled() {
  try {
    return !!localStorage.getItem(CREDENTIAL_STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Registers a new biometric credential for the user (Windows Hello, Face ID, Touch ID).
 */
export async function registerBiometricCredential(userEmail = "user@zoneclock.app") {
  const available = await isBiometricsAvailable();
  if (!available) {
    throw new Error("Biometric authentication is not supported or not configured on this device.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "ZoneClock Time Tracking",
      id: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
    },
    user: {
      id: userId,
      name: userEmail,
      displayName: userEmail.split("@")[0],
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" },  // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Face ID, Touch ID, Windows Hello
      userVerification: "required",
      requireResidentKey: false,
    },
    timeout: 60000,
    attestation: "none",
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    });

    if (credential) {
      // Store the enrolled credential ID base64
      const idBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify({
        id: idBase64,
        email: userEmail,
        createdAt: new Date().toISOString(),
      }));
      return { success: true, credentialId: idBase64 };
    }
    throw new Error("No credential was returned by the biometric authenticator.");
  } catch (err) {
    if (err.name === "NotAllowedError") {
      throw new Error("Biometric registration was cancelled or timed out.");
    }
    throw err;
  }
}

/**
 * Prompts user for 1-tap biometric verification (Fingerprint / Face ID / PIN) to authorize clock-in.
 */
export async function verifyBiometricClockIn(userEmail = "user@zoneclock.app") {
  const available = await isBiometricsAvailable();
  if (!available) {
    return { success: true, method: "fallback_device_unsupported" };
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  let allowCredentials = [];
  try {
    const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.id) {
        const rawId = Uint8Array.from(atob(parsed.id), (c) => c.charCodeAt(0));
        allowCredentials = [{ id: rawId, type: "public-key" }];
      }
    }
  } catch (e) {
    console.warn("Could not read stored credential ID", e);
  }

  const publicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: "required",
    rpId: window.location.hostname === "localhost" ? "localhost" : window.location.hostname,
  };

  if (allowCredentials.length > 0) {
    publicKeyCredentialRequestOptions.allowCredentials = allowCredentials;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });
    return {
      success: !!assertion,
      method: "platform_biometrics",
      timestamp: Date.now(),
    };
  } catch (err) {
    if (err.name === "NotAllowedError") {
      throw new Error("Biometric scan cancelled. Please try again or use standard check-in.");
    }
    // If credential was not found or enrolled on different origin, allow re-enrollment
    throw err;
  }
}

/**
 * Removes enrolled biometric credential.
 */
export function removeBiometricCredential() {
  try {
    localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to remove biometric credential", e);
  }
}
