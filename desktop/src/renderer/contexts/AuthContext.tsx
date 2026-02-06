import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { signInWithGoogleElectron } from '@/lib/googleAuth'

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'canceled' | 'expired'
export type AccountType = 'unknown' | 'early_bird' | 'friend' | 'paid'

interface UserProfile {
  email: string
  displayName: string | null
  subscriptionTier: SubscriptionTier
  subscriptionStatus: SubscriptionStatus
  accountType: AccountType
  hasAccess: boolean
  createdAt: Date
  lastSeen: Date
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        // User signed in - sync with Firestore
        await syncUserDocument(firebaseUser)
      } else {
        // User signed out
        setUserProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribeAuth()
  }, [])

  // Listen to user profile changes in Firestore
  useEffect(() => {
    if (!user) return

    const userDocRef = doc(db, 'users', user.uid)
    const unsubscribeFirestore = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data()
          const derivedAccountType: AccountType =
            (data.accountType as AccountType) ||
            (data.dayOneUser || data.day_one_user ? "early_bird" : "unknown")

          // If we inferred account type from legacy flag, persist it
          if (!data.accountType && derivedAccountType !== "unknown") {
            setDoc(docSnapshot.ref, { accountType: derivedAccountType }, { merge: true })
          }

          setUserProfile({
            email: data.email,
            displayName: data.displayName || null,
            subscriptionTier: data.subscriptionTier || 'free',
            subscriptionStatus: data.subscriptionStatus || 'active',
            accountType: derivedAccountType,
            hasAccess: data.hasAccess !== undefined ? data.hasAccess : true,
            createdAt: data.createdAt?.toDate() || new Date(),
            lastSeen: data.lastSeen?.toDate() || new Date(),
          })
        }
      },
      (error) => {
        console.error('Error listening to user profile:', error)
      }
    )

    return () => unsubscribeFirestore()
  }, [user])

  // Sync user document in Firestore
  const syncUserDocument = async (firebaseUser: User) => {
    const userDocRef = doc(db, 'users', firebaseUser.uid)
    const userDoc = await getDoc(userDocRef)

    if (!userDoc.exists()) {
      // First time sign in - create user document
      await setDoc(userDocRef, {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || null,
        subscriptionTier: 'free',
        subscriptionStatus: 'active',
        accountType: 'unknown',
        hasAccess: true,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      })
    } else {
      // Update last seen
      await setDoc(
        userDocRef,
        {
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      )
    }
  }

  // Sign up with email and password
  const signUp = async (email: string, password: string, displayName?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)

    // Create user document with display name
    const userDocRef = doc(db, 'users', userCredential.user.uid)
    await setDoc(userDocRef, {
      email: userCredential.user.email,
      displayName: displayName || null,
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      accountType: 'unknown',
      hasAccess: true,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    })
  }

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    await signInWithGoogleElectron()
  }

  // Sign out
  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
