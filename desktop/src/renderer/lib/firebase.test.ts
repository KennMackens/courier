/**
 * Firebase Connection Test
 *
 * This file can be imported in App.tsx temporarily to test Firebase connection.
 *
 * Usage:
 * 1. Import this file in App.tsx: import './lib/firebase.test'
 * 2. Check browser console for "Firebase Auth initialized" message
 * 3. Remove import after verification
 */

import { auth, db } from './firebase'

console.log('🔥 Firebase Auth initialized:', auth.app.name) // Should print: "[DEFAULT]"
console.log('🔥 Firebase Firestore initialized:', db.app.name) // Should print: "[DEFAULT]"
console.log('🔥 Project ID:', auth.app.options.projectId)
console.log('🔥 Auth Domain:', auth.app.options.authDomain)

// Test auth state listener
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('✅ User is signed in:', user.email)
  } else {
    console.log('❌ No user signed in')
  }
})
