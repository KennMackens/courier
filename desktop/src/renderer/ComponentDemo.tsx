/**
 * Component Demo Page - Showcases all UI components and their variants.
 *
 * This page demonstrates the shadcn/ui component library setup with all variants,
 * states, and accessibility features.
 */

import { useState, useEffect } from 'react'
import {
  Button,
  Input,
  Textarea,
  Label,
  Switch,
  Alert,
  AlertTitle,
  AlertDescription,
  Spinner,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastContainer,
} from './components/ui'
import {
  type Theme,
  getStoredTheme,
  setStoredTheme,
  applyTheme,
  onSystemThemeChange,
  getEffectiveTheme,
} from './lib/theme'

function ComponentDemo() {
  const [theme, setTheme] = useState<Theme>('system')
  const [switchChecked, setSwitchChecked] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; variant: 'default' | 'destructive' | 'success' }[]>([])
  const [toastId, setToastId] = useState(0)

  // Initialize theme
  useEffect(() => {
    const stored = getStoredTheme()
    setTheme(stored)
    applyTheme(stored)

    // Listen for system theme changes
    const unsubscribe = onSystemThemeChange(() => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    })

    return unsubscribe
  }, [])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    setStoredTheme(newTheme)
    applyTheme(newTheme)
  }

  const showToast = (variant: 'default' | 'destructive' | 'success') => {
    const id = toastId + 1
    setToastId(id)
    setToasts((prev) => [...prev, { id, variant }])

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="border-b pb-6">
          <h1 className="text-3xl font-bold mb-2">Component Library Demo</h1>
          <p className="text-muted-foreground">
            shadcn/ui components with Tailwind CSS
          </p>
        </header>

        {/* Theme Switcher */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Theme</h2>
          <div className="flex gap-2">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('light')}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('dark')}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleThemeChange('system')}
            >
              System {theme === 'system' && `(${getEffectiveTheme('system')})`}
            </Button>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Button</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled</Button>
              <Button variant="outline" disabled>Disabled Outline</Button>
            </div>
          </div>
        </section>

        {/* Input */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Input</h2>
          <div className="grid gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Enter password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disabled">Disabled</Label>
              <Input id="disabled" disabled placeholder="Disabled input" />
            </div>
          </div>
        </section>

        {/* Textarea */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Textarea</h2>
          <div className="grid gap-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="notes">Meeting Notes</Label>
              <Textarea
                id="notes"
                placeholder="Type your meeting notes here..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disabled-textarea">Disabled</Label>
              <Textarea
                id="disabled-textarea"
                disabled
                placeholder="Disabled textarea"
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* Label */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Label</h2>
          <div className="space-y-2">
            <Label>Default Label</Label>
            <Label className="text-muted-foreground">Muted Label</Label>
            <Label className="text-destructive">Error Label</Label>
          </div>
        </section>

        {/* Switch */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Switch</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="notifications"
                checked={switchChecked}
                onCheckedChange={setSwitchChecked}
              />
              <Label htmlFor="notifications">
                Enable notifications ({switchChecked ? 'On' : 'Off'})
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="disabled-switch" disabled />
              <Label htmlFor="disabled-switch" className="text-muted-foreground">
                Disabled switch
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="disabled-checked" disabled defaultChecked />
              <Label htmlFor="disabled-checked" className="text-muted-foreground">
                Disabled (checked)
              </Label>
            </div>
          </div>
        </section>

        {/* Alert */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Alert</h2>
          <div className="space-y-4 max-w-lg">
            <Alert>
              <AlertTitle>Default Alert</AlertTitle>
              <AlertDescription>
                This is a default alert message with some additional information.
              </AlertDescription>
            </Alert>
            <Alert variant="success">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Your meeting has been recorded successfully.
              </AlertDescription>
            </Alert>
            <Alert variant="warning">
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Low disk space. Consider clearing old recordings.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to connect to audio device. Please check permissions.
              </AlertDescription>
            </Alert>
          </div>
        </section>

        {/* Spinner */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Spinner</h2>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Spinner size="sm" />
              <span className="text-xs text-muted-foreground">Small</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="md" />
              <span className="text-xs text-muted-foreground">Medium</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <span className="text-xs text-muted-foreground">Large</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-md max-w-xs">
            <Spinner size="sm" />
            <span className="text-sm">Transcribing audio...</span>
          </div>
        </section>

        {/* Toast */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Toast</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => showToast('default')}>Show Default Toast</Button>
            <Button variant="secondary" onClick={() => showToast('success')}>
              Show Success Toast
            </Button>
            <Button variant="destructive" onClick={() => showToast('destructive')}>
              Show Error Toast
            </Button>
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Color Palette</h2>
          <div className="grid gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Primary (Teal)</h3>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <div
                    key={n}
                    className={`w-8 h-8 rounded bg-primary-${n}`}
                    title={`primary-${n}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Accent (Pink)</h3>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <div
                    key={n}
                    className={`w-8 h-8 rounded bg-accent-${n}`}
                    title={`accent-${n}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Semantic</h3>
              <div className="flex gap-1">
                <div className="w-12 h-8 rounded bg-background border" title="background" />
                <div className="w-12 h-8 rounded bg-foreground" title="foreground" />
                <div className="w-12 h-8 rounded bg-muted" title="muted" />
                <div className="w-12 h-8 rounded bg-secondary" title="secondary" />
                <div className="w-12 h-8 rounded bg-destructive" title="destructive" />
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Typography</h2>
          <div className="space-y-3">
            <p className="text-3xl font-bold">Heading 1 - 3xl Bold</p>
            <p className="text-2xl font-semibold">Heading 2 - 2xl Semibold</p>
            <p className="text-xl font-semibold">Heading 3 - xl Semibold</p>
            <p className="text-lg font-medium">Large Text - lg Medium</p>
            <p className="text-base">Body Text - base (16px)</p>
            <p className="text-sm text-muted-foreground">Small Muted - sm</p>
            <p className="text-xs text-muted-foreground">Extra Small - xs</p>
            <p className="font-mono text-sm">Monospace - for code</p>
          </div>
        </section>

        {/* Spacing */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Spacing Scale</h2>
          <div className="space-y-2">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-8 text-xs text-muted-foreground">{n * 4}px</span>
                <div
                  className={`h-4 bg-primary-9 rounded`}
                  style={{ width: `${n * 16}px` }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Accessibility Note */}
        <section className="space-y-4 border-t pt-6">
          <h2 className="text-xl font-semibold">Accessibility</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>All interactive components support keyboard navigation (Tab, Enter, Space)</li>
            <li>Focus states are clearly visible with ring indicators</li>
            <li>Components use semantic HTML and proper ARIA attributes</li>
            <li>Color contrast meets WCAG 2.1 AA standards</li>
            <li>Disabled states are visually distinct and prevent interaction</li>
          </ul>
        </section>
      </div>

      {/* Toast Container */}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast key={toast.id} variant={toast.variant} onClose={() => removeToast(toast.id)}>
            <ToastTitle>
              {toast.variant === 'default' && 'Notification'}
              {toast.variant === 'success' && 'Success'}
              {toast.variant === 'destructive' && 'Error'}
            </ToastTitle>
            <ToastDescription>
              {toast.variant === 'default' && 'This is a default toast notification.'}
              {toast.variant === 'success' && 'Recording saved successfully!'}
              {toast.variant === 'destructive' && 'Failed to save recording.'}
            </ToastDescription>
          </Toast>
        ))}
      </ToastContainer>
    </div>
  )
}

export default ComponentDemo
