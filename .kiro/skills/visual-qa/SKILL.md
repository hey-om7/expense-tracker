---
name: visual-qa
description: Review rendered web interfaces for visual quality, composition, typography, imagery, responsiveness, spacing, interaction states, accessibility, and signs of generic AI-generated design. Use after implementing or modifying frontend UI.
---

# Visual QA

You are performing a professional visual design review.

The rendered website, not the source code, is the final source of truth.

Do not approve a page simply because it compiles.

---

# REVIEW PROCESS

## Step 1 — Render

Open the relevant page in a browser or available rendering environment.

Inspect the page at:

- mobile
- tablet
- desktop
- large desktop

If browser inspection is unavailable, state that visual validation could not
be fully performed.

---

# STEP 2 — FIRST IMPRESSION

Look at the page for approximately three seconds.

Determine:

- What do I notice first?
- Is the hierarchy obvious?
- Does the page have a visual identity?
- Does it feel premium?
- Does it feel generic?

---

# STEP 3 — AI-GENERATED AESTHETIC TEST

Look specifically for:

- excessive cards
- excessive rounded corners
- generic gradients
- generic hero composition
- repetitive sections
- random decorative blobs
- predictable layouts
- poor imagery
- generic icons
- weak typography

If multiple patterns appear, mark the page as needing iteration.

---

# STEP 4 — TYPOGRAPHY

Check:

- font loading
- headline scale
- line length
- line breaks
- line height
- tracking
- hierarchy
- contrast
- responsive scaling

Look for:

- orphan words
- awkward wraps
- excessively wide text
- tiny body text
- insufficient hierarchy

---

# STEP 5 — IMAGERY

Check:

- resolution
- relevance
- crop
- focal point
- object position
- contrast
- aspect ratio

Hero imagery receives special attention.

---

# STEP 6 — SPACING

Check:

- section spacing
- internal spacing
- alignment
- whitespace
- density
- transitions between sections

Look for mechanically repeated spacing.

---

# STEP 7 — COMPOSITION

Ask:

- Are sections visually differentiated?
- Is there asymmetry where useful?
- Are elements aligned intentionally?
- Is the page too centered?
- Is there excessive containerization?
- Is the visual rhythm interesting?

---

# STEP 8 — COMPONENTS

Look for:

- excessive cards
- unnecessary wrappers
- repetitive structures
- visual monotony

---

# STEP 9 — INTERACTION

Check:

- hover
- focus
- active
- disabled
- loading

where applicable.

Transitions should feel polished.

---

# STEP 10 — RESPONSIVE

Check:

- mobile headline wrapping
- image crops
- navigation
- buttons
- content order
- horizontal overflow
- spacing
- touch targets

---

# STEP 11 — ACCESSIBILITY

Check:

- semantic elements
- focus visibility
- contrast
- alt text
- keyboard behavior
- reduced motion

---

# STEP 12 — PERFORMANCE

Look for:

- huge images
- unnecessary video
- excessive animation
- layout shift
- unnecessary client-side work

---

# SCORING

Score each category from 1–10.

Visual hierarchy
Typography
Imagery
Composition
Spacing
Responsive design
Interaction
Accessibility
Performance
Distinctiveness

Calculate an overall qualitative assessment.

---

# APPROVAL STANDARD

Do not approve a page simply because every category is above 5.

The page should generally reach:

Typography: 8+
Imagery: 8+
Composition: 8+
Distinctiveness: 8+

If any of these are below 7, recommend another iteration.

---

# OUTPUT

Return:

## Overall assessment

PASS / NEEDS POLISH / NEEDS REDESIGN

## Biggest issues

List the 3–7 most important problems.

## Specific fixes

Give concrete implementation changes.

Bad:

"Make it more premium."

Good:

"Reduce the number of bordered cards in the feature section from six to
three. Use an asymmetric 7/5 grid, increase the primary visual to occupy
approximately 55% of the section, and move the supporting copy into the
remaining column."

## Priority

P0 = prevents visual approval
P1 = significant improvement
P2 = polish

Fix P0 and P1 before declaring the page complete.