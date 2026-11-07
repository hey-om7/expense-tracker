---
inclusion: always
---

# Frontend Architecture & Implementation Standards

## Purpose

Build frontend interfaces that are visually sophisticated while remaining
maintainable, accessible, responsive, performant and easy to iterate.

Visual quality and engineering quality are equally important.

---

# 1. GENERAL PRINCIPLE

Do not optimize for the smallest amount of code.

Optimize for:

- clarity
- maintainability
- composability
- visual fidelity
- responsive behavior
- accessibility
- performance

Do not abstract prematurely.

Do not create generic components simply because two things happen to look
similar.

---

# 2. COMPONENT DESIGN

Components should represent meaningful UI concepts.

Good:

- Hero
- Navigation
- ProductShowcase
- EditorialSection
- FeatureComparison
- Testimonial
- PricingTable
- Footer

Avoid components such as:

- GenericBox
- GenericSection
- UniversalCard
- ContentContainerEverything
- FancyWrapper

unless they genuinely provide architectural value.

---

# 3. COMPONENT RESPONSIBILITIES

A component should have one clear responsibility.

Prefer:

Page
→ section
→ meaningful component
→ primitives

rather than:

Page
→ 30 nested generic wrappers

---

# 4. DESIGN TOKENS

Centralize visual primitives where appropriate.

Tokens should cover:

- colors
- typography
- spacing
- radius
- shadows
- motion
- breakpoints
- container widths

Do not scatter arbitrary values throughout the codebase.

However:

Do not force every visual value into a token if doing so damages visual
fidelity.

Exceptional editorial compositions may require deliberate one-off values.

---

# 5. CSS

Prefer readable CSS and established project conventions.

Do not create enormous utility-class strings that become impossible to
understand.

If a component requires complex styling, extract it into an appropriate
abstraction.

Avoid excessive `!important`.

Avoid inline styles unless there is a genuine dynamic requirement.

---

# 6. RESPONSIVE IMPLEMENTATION

Use intentional breakpoints.

Do not create dozens of arbitrary breakpoints.

Use fluid techniques when appropriate:

- clamp()
- min()
- max()
- CSS grid
- flexbox
- container queries

Typography should generally scale fluidly where appropriate.

---

# 7. IMAGES

Images should be responsive.

Use the framework's image optimization system where available.

For major images determine:

- intrinsic dimensions
- responsive sizes
- loading strategy
- object positioning
- crop
- aspect ratio

Do not use layout-breaking fixed dimensions.

---

# 8. HERO IMAGES

Hero imagery is performance-critical.

For hero images:

- prioritize loading
- use correct dimensions
- use modern image formats
- avoid layout shifts
- avoid unnecessarily massive assets

Do not sacrifice perceived image quality merely to reduce file size.

---

# 9. IMAGE COMPONENTS

If the project uses a shared Image component, it should support:

- responsive sizing
- aspect ratio
- object positioning
- priority loading
- lazy loading
- alt text
- placeholder handling

Do not hide all image decisions behind a component that prevents art direction.

---

# 10. TYPOGRAPHY IMPLEMENTATION

Fonts should be loaded intentionally.

Avoid loading unnecessary font families and weights.

Prefer a limited, coherent font system.

Define typography styles rather than repeatedly inventing font combinations.

---

# 11. ACCESSIBILITY

Every interactive element must be keyboard accessible.

Use semantic HTML.

Do not use:

<div onClick={...}>

when a button or link is appropriate.

Images require appropriate alt text.

Decorative images should use empty alt attributes where appropriate.

Do not use color as the only indicator of state.

---

# 12. MOTION

Use a consistent motion system.

Prefer short, subtle transitions.

Avoid:

- animation everywhere
- infinite decorative animation
- unnecessary parallax
- expensive blur effects
- animation that blocks interaction

Respect:

prefers-reduced-motion

---

# 13. PERFORMANCE

Avoid unnecessary client-side JavaScript.

Prefer server-rendered content when supported.

Do not convert an entire page to client-side rendering merely to animate
one component.

Avoid unnecessary dependencies.

Before installing a package ask:

"Can the existing stack solve this cleanly?"

---

# 14. VISUAL FIDELITY

Do not simplify a design merely because it is easier to implement.

If the design requires:

- layered imagery
- unusual grids
- clipping
- masks
- overlapping elements
- responsive art direction
- custom animation

implement it properly.

Do not replace a designed interaction with a generic component simply
because the component already exists.

---

# 15. NO PLACEHOLDER UI IN FINAL OUTPUT

During development placeholders are acceptable.

Before completion, remove:

- Lorem ipsum
- placeholder image blocks
- generic gradient rectangles
- "Image Here"
- fake buttons
- unfinished cards
- debug borders
- temporary icons
- TODO visual states

If an asset is genuinely missing, clearly identify it rather than silently
shipping a poor substitute.

---

# 16. DESIGN SYSTEM CONSISTENCY

Reuse:

- buttons
- navigation
- typography
- form controls
- icons
- spacing primitives

when appropriate.

But do not force visually distinct editorial sections into identical
component templates.

Consistency should exist at the design-language level, not necessarily
at the exact component-shape level.

---

# 17. PAGE STRUCTURE

Pages should generally be organized around meaningful sections.

Example:

<Page>
  <Navigation />
  <Hero />
  <Intro />
  <ProductStory />
  <FeatureShowcase />
  <Proof />
  <CTA />
  <Footer />
</Page>

Do not build pages as huge monolithic components.

---

# 18. DATA-DRIVEN UI

Use data-driven rendering when content genuinely shares a structure.

Do not turn every section into:

items.map(...)

if every item requires materially different composition.

Sometimes explicit markup is more maintainable and produces better design.

---

# 19. ERROR / LOADING / EMPTY STATES

These are part of the product design.

Do not leave them as generic:

Loading...

Error

No data

Create appropriate visual treatments.

---

# 20. MOBILE

Do not treat mobile as an afterthought.

Test:

- 320px
- 375px
- 390px
- 430px

where relevant.

Check:

- headline wrapping
- image crops
- navigation
- CTA layout
- horizontal overflow
- tap targets
- section spacing
- animation
- content order

---

# 21. DESKTOP

Test large widths.

Pay particular attention to:

- 1280px
- 1440px
- 1600px
- 1920px

Avoid allowing content to become excessively wide.

Use max-width intelligently.

---

# 22. BROWSER VALIDATION

Whenever possible, inspect the actual rendered page.

Source code is not sufficient to determine visual quality.

The rendered result is the source of truth.

---

# 23. FINAL IMPLEMENTATION CHECK

Before completing a task:

1. Build succeeds.
2. No console errors.
3. No broken images.
4. No horizontal overflow.
5. Responsive behavior works.
6. Typography wraps correctly.
7. Interactive states work.
8. Images are optimized.
9. Accessibility basics pass.
10. Visual design review has been performed.