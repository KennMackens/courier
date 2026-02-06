# Firestore Manual Update Required

## Add hasAccess Field to Existing Users

Since we added a new `hasAccess` field, you need to manually update existing user documents in Firestore.

### Steps:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **otto-fec4b**
3. Go to **Firestore Database**
4. Navigate to the `users` collection
5. Click on your user document (the one with your email)
6. Click **"Add field"**
7. Set:
   - Field name: `hasAccess`
   - Field type: `boolean`
   - Value: `true`
8. Click **Save**

### Or Use Firestore Console Query

Alternatively, you can run this in the Firestore console to update all users at once (if you have multiple):

```javascript
// This is just for reference - Firebase doesn't support batch updates via console
// You'd need to do this manually for each user or use Firebase CLI
```

## Updated Firestore Security Rules

Update your Firestore security rules to include the hasAccess field:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      // Users can update their own data except hasAccess and subscriptionTier
      allow write: if request.auth != null &&
                      request.auth.uid == userId &&
                      !request.resource.data.diff(resource.data).affectedKeys().hasAny(['hasAccess', 'subscriptionTier', 'subscriptionStatus']);
    }
  }
}
```

This prevents users from granting themselves access or changing their subscription tier.

## New User Document Schema

All new users will automatically get:

```typescript
{
  email: string
  displayName: string | null
  subscriptionTier: "free"
  subscriptionStatus: "active"
  hasAccess: true              // ← NEW FIELD
  createdAt: timestamp
  lastSeen: timestamp
}
```

## To Block a User

1. Go to Firestore console
2. Find the user's document
3. Change `hasAccess` to `false`
4. User will immediately see "Access Denied" screen on next auth state check
5. They'll be signed out and unable to use the app

---

**After updating your user document, delete this file.**
