
/**
 * Utility for WebAuthn (FaceID / TouchID / Windows Hello)
 * This allows "Quick Login" on the device after the first successful password login.
 */

export const isBiometricSupported = (): boolean => {
    return !!(window.PublicKeyCredential &&
        window.crypto &&
        window.crypto.subtle);
};

export const registerBiometrics = async (username: string): Promise<string | null> => {
    try {
        if (!isBiometricSupported()) return null;

        const challenge = window.crypto.getRandomValues(new Uint8Array(32));
        const userID = window.crypto.getRandomValues(new Uint8Array(16));

        const createCredentialOptions: CredentialCreationOptions = {
            publicKey: {
                challenge,
                rp: {
                    name: "MST Solar Tracker",
                    id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
                },
                user: {
                    id: userID,
                    name: username,
                    displayName: username,
                },
                pubKeyCredParams: [
                    { alg: -7, type: "public-key" }, // ES256
                    { alg: -257, type: "public-key" }, // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // This forces FaceID/TouchID/Windows Hello
                    userVerification: "required",
                },
                timeout: 60000,
                attestation: "none",
            },
        };

        const credential = await navigator.credentials.create(createCredentialOptions) as any;
        if (credential) {
            // In a real app, we'd send 'credential' to backend.
            // For this local-first app, we'll store the fact that biometrics are enabled 
            // and the username to log in as.
            localStorage.setItem('biometric_enabled', 'true');
            localStorage.setItem('biometric_username', username);
            return credential.id;
        }
    } catch (err) {
        console.error("Biometric registration failed:", err);
    }
    return null;
};

export const authenticateBiometrics = async (): Promise<string | null> => {
    try {
        if (!isBiometricSupported()) return null;

        const challenge = window.crypto.getRandomValues(new Uint8Array(32));

        const getCredentialOptions: CredentialRequestOptions = {
            publicKey: {
                challenge,
                rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
                userVerification: "required",
                timeout: 60000,
            },
        };

        const assertion = await navigator.credentials.get(getCredentialOptions) as any;
        if (assertion) {
            // Return the username linked to biometrics
            return localStorage.getItem('biometric_username');
        }
    } catch (err) {
        console.error("Biometric authentication failed:", err);
    }
    return null;
};
