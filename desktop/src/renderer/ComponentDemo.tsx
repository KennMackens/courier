/**
 * Component Demo Page - Showcases the design system with Radix colors + Geist typography.
 *
 * Design aesthetic: Modern minimalist inspired by Linear, Radix UI, and Vercel.
 * - Primary: Jade (green-teal)
 * - Accent: Pink
 * - Neutral: Slate
 * - Typography: Geist
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
        <header className="border-b border-slate-6 pb-6">
          <h1 className="text-3xl font-bold mb-2">Design System</h1>
          <p className="text-slate-11">
            Modern minimalist aesthetic with Radix colors + Geist typography
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
            <div>
              <p className="text-sm text-slate-11 mb-3">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="default">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="accent">Accent</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-11 mb-3">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                  </svg>
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-11 mb-3">Disabled states</p>
              <div className="flex flex-wrap gap-3">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled Outline</Button>
                <Button variant="secondary" disabled>Disabled Secondary</Button>
              </div>
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
            <Label className="text-slate-11">Muted Label</Label>
            <Label className="text-red-11">Error Label</Label>
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
              <Label htmlFor="disabled-switch" className="text-slate-11">
                Disabled switch
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="disabled-checked" disabled defaultChecked />
              <Label htmlFor="disabled-checked" className="text-slate-11">
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
              <span className="text-xs text-slate-11">Small</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="md" />
              <span className="text-xs text-slate-11">Medium</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <span className="text-xs text-slate-11">Large</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-4 bg-slate-3 rounded-md max-w-xs">
            <Spinner size="sm" />
            <span className="text-sm">Transcribing audio...</span>
          </div>
        </section>

        {/* Toast */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Toast</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => showToast('default')}>Show Default Toast</Button>
            <Button onClick={() => showToast('success')}>
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
          <p className="text-sm text-slate-11 mb-4">
            Radix color scales with automatic dark mode support
          </p>
          <div className="grid gap-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Primary (Jade)</h3>
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded bg-primary-1" title="primary-1" />
                <div className="w-8 h-8 rounded bg-primary-2" title="primary-2" />
                <div className="w-8 h-8 rounded bg-primary-3" title="primary-3" />
                <div className="w-8 h-8 rounded bg-primary-4" title="primary-4" />
                <div className="w-8 h-8 rounded bg-primary-5" title="primary-5" />
                <div className="w-8 h-8 rounded bg-primary-6" title="primary-6" />
                <div className="w-8 h-8 rounded bg-primary-7" title="primary-7" />
                <div className="w-8 h-8 rounded bg-primary-8" title="primary-8" />
                <div className="w-8 h-8 rounded bg-primary-9" title="primary-9" />
                <div className="w-8 h-8 rounded bg-primary-10" title="primary-10" />
                <div className="w-8 h-8 rounded bg-primary-11" title="primary-11" />
                <div className="w-8 h-8 rounded bg-primary-12" title="primary-12" />
              </div>
              <p className="text-xs text-slate-9 mt-1">
                9: Solid backgrounds, 11: Text/links, 6: Borders
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Accent (Pink)</h3>
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded bg-accent-1" title="accent-1" />
                <div className="w-8 h-8 rounded bg-accent-2" title="accent-2" />
                <div className="w-8 h-8 rounded bg-accent-3" title="accent-3" />
                <div className="w-8 h-8 rounded bg-accent-4" title="accent-4" />
                <div className="w-8 h-8 rounded bg-accent-5" title="accent-5" />
                <div className="w-8 h-8 rounded bg-accent-6" title="accent-6" />
                <div className="w-8 h-8 rounded bg-accent-7" title="accent-7" />
                <div className="w-8 h-8 rounded bg-accent-8" title="accent-8" />
                <div className="w-8 h-8 rounded bg-accent-9" title="accent-9" />
                <div className="w-8 h-8 rounded bg-accent-10" title="accent-10" />
                <div className="w-8 h-8 rounded bg-accent-11" title="accent-11" />
                <div className="w-8 h-8 rounded bg-accent-12" title="accent-12" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Neutral (Slate)</h3>
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded border border-slate-6 bg-slate-1" title="slate-1" />
                <div className="w-8 h-8 rounded bg-slate-2" title="slate-2" />
                <div className="w-8 h-8 rounded bg-slate-3" title="slate-3" />
                <div className="w-8 h-8 rounded bg-slate-4" title="slate-4" />
                <div className="w-8 h-8 rounded bg-slate-5" title="slate-5" />
                <div className="w-8 h-8 rounded bg-slate-6" title="slate-6" />
                <div className="w-8 h-8 rounded bg-slate-7" title="slate-7" />
                <div className="w-8 h-8 rounded bg-slate-8" title="slate-8" />
                <div className="w-8 h-8 rounded bg-slate-9" title="slate-9" />
                <div className="w-8 h-8 rounded bg-slate-10" title="slate-10" />
                <div className="w-8 h-8 rounded bg-slate-11" title="slate-11" />
                <div className="w-8 h-8 rounded bg-slate-12" title="slate-12" />
              </div>
              <p className="text-xs text-slate-9 mt-1">
                6: Hairline borders, 11: Body text, 12: High-contrast text
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Destructive (Red)</h3>
              <div className="flex gap-1">
                <div className="w-8 h-8 rounded bg-red-1" title="red-1" />
                <div className="w-8 h-8 rounded bg-red-2" title="red-2" />
                <div className="w-8 h-8 rounded bg-red-3" title="red-3" />
                <div className="w-8 h-8 rounded bg-red-4" title="red-4" />
                <div className="w-8 h-8 rounded bg-red-5" title="red-5" />
                <div className="w-8 h-8 rounded bg-red-6" title="red-6" />
                <div className="w-8 h-8 rounded bg-red-7" title="red-7" />
                <div className="w-8 h-8 rounded bg-red-8" title="red-8" />
                <div className="w-8 h-8 rounded bg-red-9" title="red-9" />
                <div className="w-8 h-8 rounded bg-red-10" title="red-10" />
                <div className="w-8 h-8 rounded bg-red-11" title="red-11" />
                <div className="w-8 h-8 rounded bg-red-12" title="red-12" />
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Typography</h2>
          <p className="text-sm text-slate-11 mb-4">
            Geist font family with system fallbacks
          </p>
          <div className="space-y-3">
            <p className="text-4xl font-bold">Heading 1 - 4xl Bold</p>
            <p className="text-3xl font-bold">Heading 2 - 3xl Bold</p>
            <p className="text-2xl font-semibold">Heading 3 - 2xl Semibold</p>
            <p className="text-xl font-semibold">Heading 4 - xl Semibold</p>
            <p className="text-lg font-medium">Large Text - lg Medium</p>
            <p className="text-base">Body Text - base (16px)</p>
            <p className="text-sm text-slate-11">Small Muted - sm</p>
            <p className="text-xs text-slate-11">Extra Small - xs</p>
            <p className="font-mono text-sm bg-slate-3 px-2 py-1 rounded inline-block">
              Monospace - Geist Mono
            </p>
          </div>
        </section>

        {/* Borders & Shadows */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Borders & Shadows</h2>
          <p className="text-sm text-slate-11 mb-4">
            Hairline borders and subtle shadows for a minimal aesthetic
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-lg">
            <div className="p-4 border border-slate-6 rounded-lg">
              <p className="text-sm font-medium">Hairline Border</p>
              <p className="text-xs text-slate-11">slate-6</p>
            </div>
            <div className="p-4 shadow-sm rounded-lg bg-background">
              <p className="text-sm font-medium">Shadow SM</p>
              <p className="text-xs text-slate-11">Subtle</p>
            </div>
            <div className="p-4 shadow-md rounded-lg bg-background">
              <p className="text-sm font-medium">Shadow MD</p>
              <p className="text-xs text-slate-11">Medium</p>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Spacing Scale</h2>
          <p className="text-sm text-slate-11 mb-4">
            4px base unit (0.25rem)
          </p>
          <div className="space-y-2">
            {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
              <div key={n} className="flex items-center gap-3">
                <span className="w-12 text-xs text-slate-11">{n * 4}px</span>
                <div
                  className="h-4 bg-primary-9 rounded"
                  style={{ width: `${n * 16}px` }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Accessibility Note */}
        <section className="space-y-4 border-t border-slate-6 pt-6">
          <h2 className="text-xl font-semibold">Accessibility</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-11">
            <li>All interactive components support keyboard navigation (Tab, Enter, Space)</li>
            <li>Focus states are clearly visible with Jade ring indicators</li>
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
