# Courier Design System

Modern minimalist design aesthetic inspired by Linear, Radix UI, and Vercel.

## Design Principles

- **Minimalist**: Clean interfaces with hairline borders (1px) instead of heavy shadows
- **High-contrast**: Clear hierarchy with proper semantic color usage
- **Accessible**: WCAG 2.1 AA compliant color contrast
- **Consistent**: Design tokens ensure visual coherence across the app

## Color System

### Overview

Built on **Radix Colors** with full dark mode support. Each color has a 12-step scale where:
- **1-2**: App/subtle backgrounds
- **3-5**: Component backgrounds (hover, active states)
- **6**: Subtle borders, separators (hairline borders)
- **7**: UI element borders, focus rings
- **8**: Hovered borders
- **9**: Solid backgrounds (buttons)
- **10**: Hovered solid backgrounds
- **11**: Low-contrast text, links
- **12**: High-contrast text

### Color Scales

#### Primary - Jade (Green-Teal)
Use for: Primary actions, links, interactive elements, success states

```tsx
// Tailwind classes
bg-primary-9      // Solid button background
text-primary-11   // Links
border-primary-6  // Borders
bg-primary-3      // Subtle background
```

```tsx
// CSS variables
var(--jade-9)     // Solid backgrounds
var(--jade-11)    // Text/links
var(--jade-6)     // Borders
```

#### Accent - Pink
Use for: Highlights, badges, notifications, special emphasis

```tsx
bg-accent-9       // Solid background
text-accent-11    // Text
border-accent-6   // Border
```

#### Neutral - Slate
Use for: Backgrounds, borders, body text, UI chrome

```tsx
bg-slate-1        // App background (light mode)
bg-slate-3        // Subtle element background
border-slate-6    // Hairline borders (default)
text-slate-11     // Body text
text-slate-12     // High-contrast text (headings)
text-slate-9      // Muted text (placeholders)
```

#### Destructive - Red
Use for: Errors, delete actions, warnings

```tsx
bg-red-9          // Error button
text-red-11       // Error text
border-red-6      // Error border
```

### Semantic Colors

Shorthand semantic colors for shadcn/ui compatibility:

```tsx
bg-background     // Page background
text-foreground   // Default text
bg-muted          // Muted backgrounds
text-muted-foreground  // Secondary text
border-border     // Default border (slate-6)
```

## Typography

### Font Families

**Primary**: Geist Variable (sans-serif)
**Monospace**: Geist Mono Variable

```tsx
font-sans   // Geist Variable + system fallbacks
font-mono   // Geist Mono Variable + system fallbacks
```

Fonts are loaded via `@fontsource-variable/geist` packages for optimal performance.

### Type Scale

```tsx
text-xs     // 12px - Captions, metadata
text-sm     // 14px - Labels, secondary text
text-base   // 16px - Body text (default)
text-lg     // 18px - Emphasized text
text-xl     // 20px - H4 headings
text-2xl    // 24px - H3 headings
text-3xl    // 30px - H2 headings
text-4xl    // 36px - H1 headings
```

### Font Weights

```tsx
font-normal    // 400 - Body text
font-medium    // 500 - Labels, emphasized text
font-semibold  // 600 - Subheadings
font-bold      // 700 - Major headings
```

### Examples

```tsx
// Heading hierarchy
<h1 className="text-3xl font-bold">Page Title</h1>
<h2 className="text-2xl font-semibold">Section</h2>
<h3 className="text-xl font-semibold">Subsection</h3>

// Body text
<p className="text-base">Regular paragraph text</p>
<p className="text-sm text-slate-11">Secondary information</p>
<p className="text-xs text-slate-9">Metadata or captions</p>

// Code/monospace
<code className="font-mono text-sm">const foo = 'bar'</code>
```

## Spacing System

Based on a **4px base unit** (0.25rem).

```tsx
gap-1   // 4px
gap-2   // 8px
gap-3   // 12px
gap-4   // 16px
gap-6   // 24px
gap-8   // 32px
gap-12  // 48px
```

### Common Spacing Patterns

```tsx
// Section spacing
<section className="space-y-4">  // 16px between children

// Card padding
<div className="p-4">            // 16px padding
<div className="p-6">            // 24px padding

// Layout gaps
<div className="flex gap-3">     // 12px gap
<div className="grid gap-4">     // 16px gap
```

## Borders & Shadows

### Borders

Use **hairline borders** (1px) for a minimal aesthetic:

```tsx
border            // 1px solid (hairline)
border-slate-6    // Default border color (light)
border-slate-7    // Hovered border
rounded-md        // 6px border radius (default)
rounded-lg        // 8px border radius
```

### Shadows

Minimal, subtle shadows:

```tsx
shadow-sm   // Subtle card elevation
shadow-md   // Medium elevation (modals)
shadow-lg   // High elevation (overlays)
```

**Avoid heavy shadows** - prefer hairline borders instead.

## Components

### Button

```tsx
import { Button } from '@/components/ui'

// Variants
<Button variant="default">Primary Action</Button>    // Jade solid
<Button variant="secondary">Secondary</Button>       // Gray subtle
<Button variant="accent">Highlight</Button>          // Pink solid
<Button variant="destructive">Delete</Button>        // Red solid
<Button variant="outline">Outline</Button>           // Transparent with border
<Button variant="ghost">Ghost</Button>               // Transparent
<Button variant="link">Link</Button>                 // Text only

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>

// States
<Button disabled>Disabled</Button>
```

### Input & Textarea

```tsx
import { Input, Textarea, Label } from '@/components/ui'

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="email@example.com"
  />
</div>

<Textarea placeholder="Enter notes..." rows={4} />
```

**Features**:
- Hairline borders (slate-6)
- Primary-7 focus ring
- Hover state (slate-7 border)
- Disabled state (slate-2 background, 50% opacity)

### Switch

```tsx
import { Switch, Label } from '@/components/ui'

<div className="flex items-center gap-3">
  <Switch
    id="notifications"
    checked={enabled}
    onCheckedChange={setEnabled}
  />
  <Label htmlFor="notifications">Enable notifications</Label>
</div>
```

### Alert

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui'

<Alert variant="default">
  <AlertTitle>Info</AlertTitle>
  <AlertDescription>Helpful information</AlertDescription>
</Alert>

<Alert variant="success">Success message</Alert>
<Alert variant="warning">Warning message</Alert>
<Alert variant="destructive">Error message</Alert>
```

### Spinner

```tsx
import { Spinner } from '@/components/ui'

<Spinner size="sm" />
<Spinner size="md" />
<Spinner size="lg" />

// In context
<div className="flex items-center gap-2">
  <Spinner size="sm" />
  <span>Loading...</span>
</div>
```

### Toast

```tsx
import { Toast, ToastTitle, ToastDescription, ToastContainer } from '@/components/ui'

// Container (add once at app root)
<ToastContainer>
  <Toast variant="default" onClose={handleClose}>
    <ToastTitle>Notification</ToastTitle>
    <ToastDescription>Action completed</ToastDescription>
  </Toast>
</ToastContainer>
```

## Dark Mode

Dark mode is automatically applied when `<html>` has the `dark` class.

### Theme Switching

```tsx
import { setStoredTheme, applyTheme } from '@/lib/theme'

// Toggle theme
setStoredTheme('dark')
applyTheme('dark')

// Options: 'light', 'dark', 'system'
```

### Color Behavior

All color scales automatically switch between light/dark variants:
- `bg-primary-9` → Jade light in light mode, Jade dark in dark mode
- `text-slate-11` → Slate-11 light in light mode, Slate-11 dark in dark mode

No need to add `dark:` prefixes when using the design token colors.

## Layout Patterns

### Page Layout

```tsx
<div className="min-h-screen bg-background text-foreground p-8">
  <div className="max-w-4xl mx-auto space-y-12">
    <header className="border-b border-slate-6 pb-6">
      <h1 className="text-3xl font-bold">Page Title</h1>
      <p className="text-slate-11">Description</p>
    </header>

    <main>
      {/* Content */}
    </main>
  </div>
</div>
```

### Card Pattern

```tsx
<div className="border border-slate-6 rounded-lg p-4 bg-background">
  <h3 className="font-medium mb-2">Card Title</h3>
  <p className="text-sm text-slate-11">Card content</p>
</div>
```

### Section Pattern

```tsx
<section className="space-y-4">
  <h2 className="text-xl font-semibold">Section Title</h2>
  <div className="grid gap-4">
    {/* Section content */}
  </div>
</section>
```

### Form Pattern

```tsx
<form className="space-y-4 max-w-md">
  <div className="space-y-2">
    <Label htmlFor="field">Field Label</Label>
    <Input id="field" />
  </div>

  <Button type="submit">Submit</Button>
</form>
```

## Accessibility

### Focus States

All interactive components have visible focus rings:

```tsx
focus-visible:ring-2 focus-visible:ring-primary-7 focus-visible:ring-offset-2
```

### Color Contrast

- Body text (slate-11) meets WCAG AA on background
- Headings (slate-12) meet AAA contrast
- Button text has sufficient contrast on all solid backgrounds

### Keyboard Navigation

- All components support Tab navigation
- Buttons respond to Enter/Space
- Form controls follow native behavior

### Screen Readers

- Components use semantic HTML
- Proper ARIA attributes included
- Labels associated with form controls

## Best Practices

### DO ✓

- Use semantic color scales (primary-9 for buttons, slate-6 for borders)
- Maintain consistent spacing (multiples of 4px)
- Use hairline borders instead of heavy shadows
- Leverage the slate scale for neutral UI elements
- Test in both light and dark modes
- Keep component variants minimal and purposeful

### DON'T ✗

- Mix custom colors with design tokens
- Add unnecessary shadows or gradients
- Use colors outside the Radix scales
- Override component styles without good reason
- Forget to test dark mode
- Create one-off spacing values

## Design Token Files

Design tokens are located in `src/renderer/design/`:

```
design/
├── tokens/
│   ├── colors.ts       # Radix color scales
│   ├── typography.ts   # Font families, sizes, weights
│   ├── spacing.ts      # Spacing, borders, shadows
│   └── index.ts        # Exports all tokens
└── theme.ts            # CSS variable generation
```

Import tokens when needed:

```tsx
import { jade, pink, slate } from '@/design/tokens/colors'
import { typography } from '@/design/tokens/typography'
```

## Tailwind Configuration

Colors and fonts are configured in `tailwind.config.js` to use CSS variables defined in `globals.css`. This allows automatic theme switching without dark: prefixes.

## Component Demo

View the complete design system showcase:

```bash
# Development
npm run dev
# Then navigate to: http://localhost:5173/?demo
```

The demo page (`ComponentDemo.tsx`) shows all components, variants, and color scales in both light and dark modes.

## Migration Guide

When updating existing components to use the new design system:

1. **Replace color classes**:
   ```tsx
   // Before
   className="bg-teal-500 text-white"

   // After
   className="bg-primary-9 text-white"
   ```

2. **Replace custom buttons with Button component**:
   ```tsx
   // Before
   <button className="btn btn-primary">Click</button>

   // After
   <Button variant="default">Click</Button>
   ```

3. **Use semantic text colors**:
   ```tsx
   // Before
   className="text-gray-600"

   // After
   className="text-slate-11"
   ```

4. **Update borders**:
   ```tsx
   // Before
   className="border border-gray-300"

   // After
   className="border border-slate-6"
   ```

5. **Test in dark mode** to ensure colors adapt properly.

## Resources

- **Radix Colors**: https://www.radix-ui.com/colors
- **Geist Font**: https://vercel.com/font
- **shadcn/ui**: https://ui.shadcn.com
- **Tailwind CSS**: https://tailwindcss.com

## Component Library Status

| Component | Status | Location |
|-----------|--------|----------|
| Button | ✓ Complete | `components/ui/button.tsx` |
| Input | ✓ Complete | `components/ui/input.tsx` |
| Textarea | ✓ Complete | `components/ui/textarea.tsx` |
| Label | ✓ Complete | `components/ui/label.tsx` |
| Switch | ✓ Complete | `components/ui/switch.tsx` |
| Alert | ✓ Complete | `components/ui/alert.tsx` |
| Spinner | ✓ Complete | `components/ui/spinner.tsx` |
| Toast | ✓ Complete | `components/ui/toast.tsx` |

All components export from `@/components/ui` for convenient imports.

## Animation & Motion

### Transition Timing

Use consistent timing functions for smooth, predictable animations:

```tsx
// Tailwind duration classes
transition-none       // No animation
transition-all        // Animate all properties
transition            // Animate common properties (default)

// Duration
duration-75           // 75ms - Very fast (hover states)
duration-150          // 150ms - Fast (default interactions)
duration-300          // 300ms - Medium (modals, drawers)
duration-500          // 500ms - Slow (page transitions)

// Timing functions
ease-linear           // Linear
ease-in               // Accelerate
ease-out              // Decelerate (default for exits)
ease-in-out           // Smooth both ends (default for entrances)
```

### Motion Principles

**Reduce motion for accessibility**:
```tsx
// Respect user's motion preferences
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Common Animation Patterns

```tsx
// Hover transitions (fast)
className="transition-colors duration-75 hover:bg-slate-3"

// Button press
className="transition-transform active:scale-95"

// Focus ring (instant)
className="transition-none focus-visible:ring-2"

// Modal/drawer enter (medium)
className="transition-opacity duration-300 ease-out"

// Fade in
className="animate-in fade-in duration-200"

// Slide in from bottom
className="animate-in slide-in-from-bottom-4 duration-300"
```

### Best Practices

- **Keep it subtle**: Animations should enhance, not distract
- **Default to 150ms**: Most interactions feel snappy at this speed
- **Use ease-out for exits**: Objects accelerate as they leave
- **Use ease-in-out for entrances**: Smooth acceleration and deceleration
- **Animate transforms over position**: Better performance
- **Always respect prefers-reduced-motion**: Critical for accessibility

## Icons

### Icon Library

**Recommended**: [Lucide React](https://lucide.dev) - Clean, consistent, open-source icon set

```bash
npm install lucide-react
```

### Usage

```tsx
import { Search, Settings, User, ChevronDown } from 'lucide-react'

// Default size (24px)
<Search />

// Custom size
<Search size={16} />
<Search className="w-4 h-4" />

// With color
<Search className="text-primary-11" />
<Search className="text-slate-9" />

// In buttons
<Button size="icon">
  <Settings size={18} />
</Button>
```

### Icon Sizing Scale

```tsx
size={12}  // text-xs   - Inline with small text
size={14}  // text-sm   - Inline with labels
size={16}  // text-base - Default inline size
size={18}  // Button icons
size={20}  // Larger buttons, toolbar icons
size={24}  // Default standalone icons
size={32}  // Large feature icons
size={48}  // Hero icons
```

### Icon Patterns

```tsx
// Icon with text (aligned)
<div className="flex items-center gap-2">
  <Search size={16} className="text-slate-9" />
  <span>Search</span>
</div>

// Icon button
<button className="p-2 hover:bg-slate-3 rounded-md transition-colors">
  <Settings size={18} />
</button>

// Icon in input
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-9" size={16} />
  <Input className="pl-10" placeholder="Search..." />
</div>

// Icon with badge
<div className="relative">
  <Bell size={20} />
  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-9 rounded-full" />
</div>
```

### Icon Colors

```tsx
// Default (inherit text color)
<Icon />

// Muted (secondary UI elements)
<Icon className="text-slate-9" />

// Standard (body text)
<Icon className="text-slate-11" />

// Primary (interactive)
<Icon className="text-primary-11" />

// Accent
<Icon className="text-accent-11" />

// Destructive
<Icon className="text-red-11" />
```

### Best Practices

- **Consistent sizing**: Use the size scale, not arbitrary values
- **Align with text**: Use `flex items-center` for icon + text layouts
- **Default to 16px**: For inline icons next to text
- **Use 18-20px**: For button icons
- **Match text color**: Icons should inherit or match nearby text
- **Add aria-label**: For icon-only buttons

## Additional Components

### Dialog (Modal)

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>

    <div className="py-4">
      {/* Dialog content */}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Features**:
- Backdrop overlay (slate-12 at 50% opacity)
- Center-aligned by default
- Focus trap (Tab cycles within dialog)
- Escape key to close
- Click outside to close
- Smooth fade-in animation (300ms)

### Dropdown Menu

```tsx
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown'

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      Options <ChevronDown size={16} />
    </Button>
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={handleEdit}>
      <Edit size={16} />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={handleDuplicate}>
      <Copy size={16} />
      Duplicate
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={handleDelete} variant="destructive">
      <Trash size={16} />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Features**:
- Keyboard navigation (Arrow keys, Enter)
- Auto-positioning (flips if near viewport edge)
- Hairline border (slate-6)
- Shadow-md elevation
- Items have hover states

### Card

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Supporting description text</CardDescription>
  </CardHeader>

  <CardContent>
    <p>Card content goes here</p>
  </CardContent>

  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

**Styling**:
```tsx
// Default card
border border-slate-6 rounded-lg bg-background

// Hoverable card
hover:border-slate-7 transition-colors cursor-pointer

// Subtle card (no border)
bg-slate-2 rounded-lg
```

### Table

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-medium">John Doe</TableCell>
      <TableCell>
        <span className="px-2 py-1 bg-primary-3 text-primary-11 rounded text-xs">
          Active
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm">Edit</Button>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Features**:
- Hairline borders between rows
- Hover state on rows
- Responsive scroll container
- Sticky header option

### Badge

```tsx
import { Badge } from '@/components/ui/badge'

<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="accent">New</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

**Sizing**:
```tsx
text-xs px-2 py-1 rounded-md font-medium
```

### Tooltip

```tsx
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Info size={18} />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Helpful information</p>
  </TooltipContent>
</Tooltip>
```

**Features**:
- Appears on hover (200ms delay)
- Auto-positioning
- Small text (text-xs)
- Dark background in light mode
- Max-width constraint

### Skeleton

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Loading placeholder
<div className="space-y-3">
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-4 w-1/2" />
</div>

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-1/2 mt-2" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-32 w-full" />
  </CardContent>
</Card>
```

**Styling**:
```tsx
bg-slate-3 animate-pulse rounded
```

### Progress Bar

```tsx
import { Progress } from '@/components/ui/progress'

<Progress value={60} max={100} />

// With label
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Uploading...</span>
    <span className="text-slate-9">60%</span>
  </div>
  <Progress value={60} />
</div>
```

**Styling**:
```tsx
// Track
bg-slate-3 h-2 rounded-full

// Fill
bg-primary-9 h-full rounded-full transition-all
```

### Separator

```tsx
import { Separator } from '@/components/ui/separator'

<Separator />                          // Horizontal
<Separator orientation="vertical" />   // Vertical

// In context
<div>
  <p>Section 1</p>
  <Separator className="my-4" />
  <p>Section 2</p>
</div>
```

## Grid System

### Breakpoints

Desktop application with minimal responsive needs:

```tsx
// Tailwind breakpoints (if needed for future)
sm: '640px'   // Small tablets
md: '768px'   // Tablets
lg: '1024px'  // Desktop (default)
xl: '1280px'  // Large desktop
2xl: '1536px' // Extra large
```

**Note**: As a desktop-only app, prioritize fixed layouts over responsive breakpoints.

### Layout Grid

```tsx
// Two-column layout
<div className="grid grid-cols-2 gap-6">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

// Three-column layout
<div className="grid grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id}>{item.name}</Card>)}
</div>

// Sidebar + main content
<div className="grid grid-cols-[240px_1fr] gap-6">
  <aside>Sidebar</aside>
  <main>Content</main>
</div>

// Auto-fit responsive cards
<div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
  {cards}
</div>
```

### Flexbox Patterns

```tsx
// Horizontal stack with space between
<div className="flex justify-between items-center">
  <h2>Title</h2>
  <Button>Action</Button>
</div>

// Centered content
<div className="flex items-center justify-center min-h-screen">
  <Card>Centered content</Card>
</div>

// Vertical stack
<div className="flex flex-col gap-4">
  {items}
</div>

// Horizontal list with wrapping
<div className="flex flex-wrap gap-2">
  {tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
</div>
```

### Container Widths

```tsx
max-w-sm    // 384px - Narrow forms
max-w-md    // 448px - Standard forms
max-w-lg    // 512px - Medium content
max-w-xl    // 576px - Wide forms
max-w-2xl   // 672px - Articles
max-w-4xl   // 896px - Standard pages
max-w-6xl   // 1152px - Wide layouts
max-w-7xl   // 1280px - Very wide layouts
```

### Common Layout Patterns

```tsx
// Centered page
<div className="min-h-screen bg-background p-8">
  <div className="max-w-4xl mx-auto">
    {content}
  </div>
</div>

// Sidebar layout
<div className="flex h-screen">
  <aside className="w-64 border-r border-slate-6 p-4">
    Sidebar
  </aside>
  <main className="flex-1 overflow-auto p-8">
    Content
  </main>
</div>

// Dashboard grid
<div className="grid grid-cols-12 gap-6">
  <div className="col-span-8">Main content</div>
  <div className="col-span-4">Sidebar</div>
</div>
```

## Responsive Design

While Courier is a desktop application, these patterns ensure proper layout adaptation:

### Viewport Handling

```tsx
// Full viewport height
min-h-screen

// Viewport-aware containers
h-screen      // 100vh
w-screen      // 100vw

// Safe areas (for macOS notch/camera)
className="pt-safe-top"  // If needed in future
```

### Window States

Design for these macOS window states:
- **Full screen**: 1280px+ typical
- **Split view (1/2)**: 640px per app
- **Split view (2/3)**: 853px main, 427px secondary

```tsx
// Minimum comfortable width: 600px
// Optimal range: 800px - 1400px
```

### Adaptive Layouts

```tsx
// Stack vertically at narrow widths
<div className="flex flex-col lg:flex-row gap-6">
  <div className="lg:w-1/3">Sidebar</div>
  <div className="lg:w-2/3">Main</div>
</div>

// Hide secondary content when narrow
<div className="hidden lg:block">
  Optional content
</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items}
</div>
```

### Text Scaling

```tsx
// Responsive text sizes
<h1 className="text-2xl lg:text-3xl font-bold">
  Scales with viewport
</h1>

// Clamp for fluid typography
className="text-[clamp(1rem,2vw,1.5rem)]"
```

## Testing UI Components

### Visual Testing

**Manual testing checklist**:
- [ ] Light mode appearance
- [ ] Dark mode appearance
- [ ] Hover states
- [ ] Focus states (keyboard navigation)
- [ ] Disabled states
- [ ] Loading states
- [ ] Error states
- [ ] Different content lengths (short, long, overflow)
- [ ] Narrow window widths (600px minimum)
- [ ] macOS system accent colors

### Interaction Testing

```tsx
// Test component with various states
<ComponentDemo>
  <Button>Default</Button>
  <Button disabled>Disabled</Button>
  <Button variant="destructive">Destructive</Button>
</ComponentDemo>
```

### Accessibility Testing

**Keyboard navigation**:
- Tab through all interactive elements
- Verify visible focus indicators
- Test Enter/Space on buttons
- Test Escape to close modals/dropdowns
- Test Arrow keys in menus

**Screen reader testing**:
```bash
# macOS VoiceOver
Cmd + F5  # Toggle VoiceOver
```

**Automated testing**:
```bash
# Install axe DevTools browser extension
# Or use testing library
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

```tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

test('button is accessible', () => {
  render(<Button>Click me</Button>)
  const button = screen.getByRole('button', { name: /click me/i })
  expect(button).toBeInTheDocument()
  expect(button).not.toBeDisabled()
})
```

### Component Testing Template

```tsx
describe('Button Component', () => {
  it('renders correctly', () => {
    // Render test
  })

  it('handles click events', () => {
    // Interaction test
  })

  it('displays all variants', () => {
    // Visual regression test
  })

  it('supports keyboard navigation', () => {
    // Accessibility test
  })

  it('shows disabled state', () => {
    // State test
  })
})
```

### Testing Best Practices

- **Test behavior, not implementation**: Focus on what users experience
- **Use semantic queries**: `getByRole`, `getByLabelText` over `getByTestId`
- **Test accessibility**: Every component should be keyboard navigable
- **Visual regression**: Screenshot tests for critical UI
- **Real user scenarios**: Test complete flows, not isolated components
- **Dark mode**: Always test both themes

## Performance

### Component Optimization

**Use React.memo for expensive components**:
```tsx
import { memo } from 'react'

export const ExpensiveList = memo(({ items }) => {
  return (
    <div>
      {items.map(item => <ExpensiveItem key={item.id} {...item} />)}
    </div>
  )
})
```

**Lazy load heavy components**:
```tsx
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyComponent />
    </Suspense>
  )
}
```

**Virtualize long lists**:
```tsx
// For 100+ items, use virtual scrolling
import { VirtualList } from '@/components/virtual-list'

<VirtualList
  items={thousands}
  itemHeight={48}
  renderItem={(item) => <ListItem {...item} />}
/>
```

### CSS Performance

**Avoid expensive CSS**:
```tsx
// ✗ Expensive
className="shadow-2xl blur-lg backdrop-blur-xl"

// ✓ Performant
className="border border-slate-6"
```

**Use transform for animations**:
```tsx
// ✗ Causes layout recalculation
className="transition-all hover:top-2"

// ✓ GPU-accelerated
className="transition-transform hover:-translate-y-2"
```

**Minimize layout thrashing**:
```tsx
// ✗ Forces reflow
elements.forEach(el => {
  const height = el.offsetHeight
  el.style.height = height + 10 + 'px'
})

// ✓ Batch reads, then writes
const heights = elements.map(el => el.offsetHeight)
elements.forEach((el, i) => {
  el.style.height = heights[i] + 10 + 'px'
})
```

### Image Optimization

```tsx
// Use appropriate formats
.png  // Screenshots, UI with transparency
.jpg  // Photos, complex images
.svg  // Icons, logos, illustrations

// Optimize images
// Use ImageOptim, Squoosh, or build tools
```

### Font Loading

Geist Variable fonts are already optimized:
```tsx
// Preload critical fonts
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />

// Font display strategy
font-display: swap; // Show fallback immediately, swap when loaded
```

### Bundle Size

**Analyze bundle**:
```bash
npm run build -- --analyze
```

**Code splitting**:
```tsx
// Split by route
const SettingsPage = lazy(() => import('./pages/Settings'))

// Split by feature
const AdvancedFeature = lazy(() => import('./features/Advanced'))
```

**Tree shaking**:
```tsx
// ✓ Import only what you need
import { Button } from '@/components/ui/button'

// ✗ Imports entire library
import * as UI from '@/components/ui'
```

### Rendering Performance

**Debounce expensive operations**:
```tsx
import { useDebouncedCallback } from 'use-debounce'

const debouncedSearch = useDebouncedCallback(
  (query) => performSearch(query),
  300 // 300ms delay
)
```

**Throttle rapid events**:
```tsx
import { useThrottledCallback } from 'use-throttle'

const throttledScroll = useThrottledCallback(
  (event) => handleScroll(event),
  100 // Max once per 100ms
)
```

**Avoid inline functions in props**:
```tsx
// ✗ Creates new function every render
<Button onClick={() => handleClick(id)}>Click</Button>

// ✓ Memoized callback
const handleClickMemo = useCallback(() => handleClick(id), [id])
<Button onClick={handleClickMemo}>Click</Button>
```

### Performance Budget

Target metrics for desktop application:
- **First Paint**: < 500ms
- **Time to Interactive**: < 1s
- **60 FPS**: All animations and scrolling
- **Bundle Size**: < 500KB (gzipped)
- **Memory**: < 200MB idle

### Performance Monitoring

```tsx
// React DevTools Profiler
import { Profiler } from 'react'

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>

function onRenderCallback(
  id, // component id
  phase, // "mount" or "update"
  actualDuration, // ms spent rendering
  baseDuration, // estimated ms without memoization
  startTime,
  commitTime
) {
  console.log(`${id} took ${actualDuration}ms to ${phase}`)
}
```

### Performance Best Practices

- **Measure first**: Use profiler before optimizing
- **Optimize the slow path**: Focus on bottlenecks, not everything
- **Use production builds**: Always test performance in production mode
- **Lazy load**: Don't load what users don't see
- **Memoize expensive computations**: `useMemo` for heavy calculations
- **Debounce user input**: Reduce unnecessary renders
- **Virtual scrolling**: For lists with 100+ items
- **Code split**: By route and feature
- **Minimize re-renders**: Use React.memo and proper state structure

---

## Quick Reference

### Color Scale Quick Reference
```
1-2:  Backgrounds
3-5:  Component backgrounds
6:    Subtle borders (hairline)
7:    UI borders
8:    Hovered borders
9:    Solid backgrounds
10:   Hovered solid
11:   Text/links
12:   High-contrast text
```

### Spacing Quick Reference
```
gap-1  = 4px    gap-2  = 8px    gap-3  = 12px
gap-4  = 16px   gap-6  = 24px   gap-8  = 32px
gap-12 = 48px   gap-16 = 64px
```

### Common Class Combinations
```tsx
// Card
"border border-slate-6 rounded-lg p-4 bg-background"

// Button
"px-4 py-2 rounded-md bg-primary-9 text-white font-medium"

// Input
"border border-slate-6 rounded-md px-3 py-2 focus-visible:ring-2 focus-visible:ring-primary-7"

// Modal
"fixed inset-0 bg-slate-12/50 flex items-center justify-center"

// Badge
"px-2 py-1 rounded-md text-xs font-medium bg-primary-3 text-primary-11"
```

---

*Last updated: 2026-01-26*
