---
inclusion: always
name: asset-direction
description: Use when designing, implementing, reviewing, sourcing, generating, replacing, or optimizing visual assets such as photography, illustrations, product imagery, 3D graphics, textures, videos, icons, logos, diagrams, or other high-resolution website graphics.
---

# Asset Direction System

## Purpose

Visual assets are first-class components of the design.

Do not treat imagery as filler.

The correct asset can dramatically change the perceived quality of an
interface.

Every important visual asset should be selected or created intentionally.

---

# 1. ASSET-FIRST THINKING

When designing a visual section, ask:

"What visual should carry the emotional or informational weight of this
section?"

Possible answers:

- photography
- product render
- 3D object
- illustration
- diagram
- data visualization
- texture
- video
- typography
- iconography
- UI screenshot
- architectural composition
- abstract graphic
- generated artwork

Do not assume photography is always correct.

---

# 2. ASSET BRIEF

Before sourcing or generating an important asset, define:

## Subject

What is being shown?

## Context

Where does it exist?

## Mood

What emotion should it create?

## Lighting

Examples:

- natural
- studio
- cinematic
- soft
- dramatic
- high-key
- low-key

## Composition

Examples:

- centered
- asymmetric
- close-up
- wide
- macro
- environmental
- top-down
- side profile

## Focal position

Where should the primary subject be positioned?

This matters because text may occupy part of the image.

## Aspect ratio

Choose based on the actual layout.

Examples:

- 16:9
- 3:2
- 4:3
- 4:5
- 1:1
- 9:16
- custom editorial crop

## Color direction

Specify the desired visual relationship with the surrounding interface.

---

# 3. NEVER USE RANDOM STOCK

Do not select the first image that matches the keyword.

The image must fit:

- brand
- mood
- composition
- color
- subject
- crop
- visual quality

A technically relevant image can still be visually wrong.

---

# 4. IMAGE SEARCH STRATEGY

When searching for imagery, search using concepts rather than generic
keywords.

Weak:

"business person"

Better:

"cinematic editorial portrait founder dark studio"

Weak:

"office"

Better:

"minimalist brutalist architecture workspace natural light editorial"

Weak:

"technology"

Better:

"macro silicon semiconductor laboratory cinematic photography"

Search should reflect the intended art direction.

---

# 5. HIGH-RESOLUTION REQUIREMENT

For major visual assets, source enough resolution for the intended display.

Do not use a 600px image as a full-width desktop hero.

As a general guideline:

Hero images should normally have enough source resolution for at least
the largest intended display size.

For large screens, prefer appropriately large source files.

Do not unnecessarily use original camera files in production.

---

# 6. RESPONSIVE IMAGE ART DIRECTION

Do not assume one crop works at every viewport.

Desktop may use:

wide landscape

Mobile may require:

tighter portrait crop

If necessary, use responsive sources.

For important art-directed imagery, consider:

<picture>
or framework-specific responsive image mechanisms.

---

# 7. OBJECT POSITION

`object-fit: cover` is not enough.

Determine the correct focal position.

Examples:

object-position: center

object-position: 70% center

object-position: right center

object-position: 50% 30%

The exact value must be based on the composition.

---

# 8. TEXT OVER IMAGES

If text overlays an image:

Check:

- contrast
- readability
- focal point
- crop
- mobile behavior

Do not put text over the most visually important part of the image unless
the design intentionally calls for it.

Use overlays sparingly.

Do not automatically add a black gradient behind every text block.

---

# 9. IMAGE TREATMENT

Possible treatments:

- natural
- monochrome
- subtle color grade
- duotone
- grain
- blur
- masked crop
- clipping
- rounded crop
- hard-edge editorial crop

Treatment must be consistent with the visual identity.

Do not add grain/noise just because it is trendy.

---

# 10. VIDEO

Use video only when it adds meaningful value.

Good use cases:

- product demonstration
- cinematic hero
- manufacturing process
- motion-based storytelling
- interaction demonstration

Avoid:

- enormous autoplay videos
- video merely as background decoration
- unnecessary bandwidth consumption

Provide appropriate poster images.

Respect reduced-motion preferences.

---

# 11. 3D

3D can be used for:

- product visualization
- hero objects
- technical concepts
- spatial storytelling

Avoid generic floating 3D blobs.

If using 3D, define:

- material
- lighting
- camera
- environment
- shadows
- composition
- animation

The result should feel art-directed.

---

# 12. GENERATED GRAPHICS

If image generation is available, generated imagery should still follow a
clear art direction.

Never prompt:

"Make a cool modern image."

Instead define:

- subject
- environment
- camera
- lighting
- composition
- palette
- texture
- mood
- aspect ratio
- negative constraints

Example:

"Editorial architectural photograph of a brutalist concrete research
facility at blue hour, extremely clean geometric composition, low camera
angle, subtle atmospheric haze, large negative space on the left for
white headline typography, realistic materials, premium architecture
magazine aesthetic."

---

# 13. PRODUCT SCREENSHOTS

Product screenshots should be treated as designed assets.

Check:

- resolution
- browser chrome
- scaling
- device frame
- crop
- surrounding whitespace
- visual hierarchy

Do not insert screenshots at arbitrary sizes.

---

# 14. LOGOS

Do not distort logos.

Maintain:

- aspect ratio
- clear space
- appropriate resolution
- correct color treatment

Use SVG where possible.

---

# 15. ICONS

Use one icon family.

Prefer a consistent source.

Do not mix:

- filled icons
- thin line icons
- emoji
- random SVGs

unless intentionally designed that way.

---

# 16. ILLUSTRATIONS

Illustrations should share a visual language.

Consider:

- stroke
- color
- geometry
- shading
- perspective
- level of detail

Do not mix unrelated illustration styles.

---

# 17. ASSET NAMING

Use meaningful filenames.

Good:

hero-founder-studio.webp
product-dashboard-desktop.webp
product-dashboard-mobile.webp
research-lab-wide.webp

Bad:

IMG_2394.jpg
image2.png
final-final.png
newthing.webp

---

# 18. ASSET DIRECTORY

Prefer a predictable structure.

Example:

public/
  images/
    hero/
    editorial/
    product/
    team/
    backgrounds/
  icons/
  logos/
  video/

---

# 19. OPTIMIZATION

Optimize assets without visibly degrading quality.

Prefer:

- AVIF
- WebP
- SVG for vectors
- responsive image sizes
- compression
- lazy loading

Critical hero imagery should be handled appropriately for fast perceived
rendering.

---

# 20. PLACEHOLDER POLICY

During development, placeholders are acceptable.

Before final completion:

NO:

- gray boxes
- generic gradient placeholders
- "IMAGE"
- random Unsplash URLs
- broken images
- low-resolution temporary assets

If the correct asset does not exist, explicitly tell the user which asset
is missing.

Do not hide the problem.

---

# 21. ASSET QUALITY REVIEW

For each major asset ask:

### Relevance
Does this image actually support the content?

### Quality
Is it high-resolution and professional?

### Composition
Does the composition work inside the UI?

### Crop
Does it survive responsive cropping?

### Brand
Does it belong to the visual identity?

### Hierarchy
Does it compete with the headline?

### Emotion
Does it create the intended feeling?

### Performance
Is the delivery optimized?

---

# 22. VISUAL ASSET PRIORITY

When time is limited, prioritize:

1. Hero imagery
2. Major product imagery
3. Large editorial visuals
4. Product screenshots
5. Supporting imagery
6. Decorative imagery

Do not spend 30 minutes perfecting a tiny icon while the hero image is
poor.

---

# 23. ASSET FAILURE BEHAVIOR

If a required visual asset cannot be found:

Do NOT silently substitute a generic image.

Instead:

1. Identify the missing asset.
2. Explain what type of asset is required.
3. Continue implementation with a clearly marked development placeholder
   only if necessary.
4. Do not consider the page visually complete.

---

# 24. FINAL ASSET CHECK

Before completion:

- no broken images
- no low-resolution hero images
- no random stock
- no stretched images
- no accidental crops
- no incorrect object positioning
- no missing alt text
- no unnecessary huge files
- no development placeholders
- mobile crops verified
- desktop crops verified