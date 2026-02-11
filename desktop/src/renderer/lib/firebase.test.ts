import { describe, expect, it } from 'vitest'
import { auth, db } from './firebase'

describe('firebase config', () => {
  it('initializes auth and firestore apps', () => {
    expect(auth.app.name).toBe('[DEFAULT]')
    expect(db.app.name).toBe('[DEFAULT]')
  })

  it('loads required firebase options', () => {
    expect(auth.app.options.projectId).toBeTruthy()
    expect(auth.app.options.authDomain).toBeTruthy()
  })
})
