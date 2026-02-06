import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from './firebase'

/**
 * Google Sign-In for Electron
 *
 * Uses Firebase's signInWithPopup which should work in Electron's
 * BrowserWindow context.
 */
export async function signInWithGoogleElectron(): Promise<void> {
  const provider = new GoogleAuthProvider()

  // Add scopes
  provider.addScope('profile')
  provider.addScope('email')

  // Use popup method
  // This should work in Electron as long as:
  // 1. The auth domain is in authorized domains in Firebase Console
  // 2. localhost is in authorized domains
  try {
    await signInWithPopup(auth, provider)
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this application.')
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled')
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error(
        'This domain is not authorized for OAuth operations. ' +
        'Please add it to the authorized domains in Firebase Console.'
      )
    } else {
      // Re-throw with original error
      throw error
    }
  }
}
