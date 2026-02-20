# Accessibility Standards and Best Practices

## Overview

This document outlines the accessibility standards and best practices implemented in the Photo Signal application. All UI components are designed to meet WCAG 2.1 Level AA compliance.

## Color Contrast Standards

### WCAG AA Requirements

- **Normal text (< 18pt or < 14pt bold)**: Minimum 4.5:1 contrast ratio
- **Large text (≥ 18pt or ≥ 14pt bold)**: Minimum 3:1 contrast ratio
- **Interactive elements and focus indicators**: Minimum 3:1 contrast ratio

### Color Palette

#### Dark Mode (Default Theme)

| Variable                 | Color   | Contrast | Usage                        |
| ------------------------ | ------- | -------- | ---------------------------- |
| `--color-main-text`      | #f5f5f5 | 18.16:1  | Primary headings, body text  |
| `--color-sub-text`       | #cbd5e1 | 13.33:1  | Secondary text, descriptions |
| `--color-bonus-text`     | #a1a1aa | 7.72:1   | Tertiary text, labels        |
| `--color-text-muted`     | #a8a8a8 | 8.33:1   | Muted text, hints            |
| `--color-accent`         | #4a90e2 | 6.01:1   | Primary action color         |
| `--color-accent-light`   | #6ba3e8 | 7.57:1   | Light accent, hover states   |
| `--color-accent-hover`   | #5ca3e6 | 7.22:1   | Hover states for accents     |
| `--color-background`     | #0a0a0a | N/A      | Main background              |
| `--color-sub-background` | #1a1a1a | N/A      | Secondary backgrounds        |

#### Light Mode

| Variable                 | Color   | Contrast | Usage                        |
| ------------------------ | ------- | -------- | ---------------------------- |
| `--color-main-text`      | #0f172a | 16.36:1  | Primary headings, body text  |
| `--color-sub-text`       | #44403c | 9.42:1   | Secondary text, descriptions |
| `--color-bonus-text`     | #3f3f46 | 9.57:1   | Tertiary text, labels        |
| `--color-text-muted`     | #595959 | 6.42:1   | Muted text, hints            |
| `--color-accent`         | #2563eb | 4.74:1   | Primary action color         |
| `--color-accent-light`   | #1d4ed8 | 6.14:1   | Light accent, hover states   |
| `--color-accent-hover`   | #1e40af | 7.93:1   | Hover states for accents     |
| `--color-background`     | #f5f5f4 | N/A      | Main background              |
| `--color-sub-background` | #cbd5e1 | N/A      | Secondary backgrounds        |

**All colors meet or exceed WCAG AA standards for their respective use cases.**

## Focus Indicators

### Global Focus Styles

Focus indicators are critical for keyboard navigation accessibility. All interactive elements have visible focus indicators that meet WCAG standards.

#### CSS Variables

```css
--focus-ring-color: #6ba3e8 (dark) / #2563eb (light) --focus-ring-width: 2px
  --focus-ring-offset: 2px --focus-ring-style: solid;
```

#### Implementation

Focus styles are applied globally to:

- Buttons
- Links
- Form inputs (text, select, textarea)
- Checkboxes and radio buttons
- Range sliders
- All focusable interactive elements

Example:

```css
*:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
  border-radius: 2px;
}
```

### Focus-Visible vs Focus

The application uses `:focus-visible` to show focus indicators only when keyboard navigation is used, preventing unnecessary outlines during mouse/touch interactions while maintaining accessibility.

## Button States

### Standard Button States

All buttons support the following states with appropriate contrast:

1. **Default**: Base button appearance
2. **Hover**: Visual feedback on mouse hover
3. **Focus**: Keyboard focus indicator
4. **Active**: Pressed state
5. **Disabled**: Non-interactive state with reduced opacity

#### Button Color Variables

```css
/* Dark Mode */
--color-button-bg: #f5f5f5 --color-button-text: #0a0a0a --color-button-hover-bg: #e5e7eb
  --color-button-disabled-bg: #3a3a3a --color-button-disabled-text: #6b6b6b /* Light Mode */
  --color-button-bg: #0f172a --color-button-text: #f5f5f4 --color-button-hover-bg: #1e293b
  --color-button-disabled-bg: #cbd5e1 --color-button-disabled-text: #94a3b8;
```

### Button Implementation Tips

- Prefer semantic `<button>` elements over click handlers on `div` or `span`
- Use descriptive text or `aria-label` values so screen readers announce intent
- Keep focus indicators visible; never remove `outline` without an accessible replacement
- Target at least 44x44 CSS pixels on touch devices for comfortable activation

## Interactive Element Guidelines

### Minimum Touch/Click Targets

While not enforced in CSS, all interactive elements should meet minimum size requirements:

- **Mobile**: 44x44 CSS pixels (iOS) or 48x48 CSS pixels (Android Material Design)
- **Desktop**: 24x24 CSS pixels minimum

### Hover States

All interactive elements provide visual feedback on hover:

- Buttons change background color
- Links show underlines or color changes
- Form elements show border changes

### Disabled States

Disabled elements:

- Use reduced contrast colors
- Show `cursor: not-allowed`
- Cannot receive focus
- Are clearly distinguishable from active elements

### Form Guidelines

- Associate every input with a `<label>` via matching `for` / `id`
- Provide inline helper text and error messaging that does not rely on color alone
- Indicate required fields with text or `aria-required="true"`
- Ensure custom controls (sliders, selects) support keyboard input and focus indicators
- Group related controls with `<fieldset>` and `<legend>` when helpful for context

### Modal Guidelines

- Trap focus within the modal and return focus to the trigger element when closing
- Provide a visible close button plus keyboard Escape support
- Apply `role="dialog"` and `aria-modal="true"`
- Prevent background scrolling while overlays are open
- Maintain WCAG-compliant contrast for modal text, controls, and outlines

## Testing Tools

### Recommended Tools

1. **Browser DevTools**
   - Chrome DevTools Accessibility Inspector
   - Firefox Accessibility Inspector
   - Edge Accessibility Checker

2. **Automated Testing**
   - Lighthouse (built into Chrome DevTools)
   - axe DevTools browser extension
   - WAVE browser extension

3. **Contrast Checkers**
   - WebAIM Contrast Checker
   - Color Contrast Analyzer
   - Accessible Color Palette Builder

### Manual Testing Checklist

- [ ] Test keyboard navigation through all interactive elements
- [ ] Verify focus indicators are visible in both themes
- [ ] Check color contrast with DevTools
- [ ] Test with screen reader (VoiceOver, NVDA, JAWS)
- [ ] Verify text is readable at 200% zoom
- [ ] Test all UI states (hover, focus, active, disabled)
- [ ] Validate with Lighthouse (score ≥ 90)

## Accessibility Checklist

- [ ] Text meets 4.5:1 contrast (3:1 for large text)
- [ ] UI components meet 3:1 contrast
- [ ] Focus indicators exist for every interactive element
- [ ] Entire experience works with keyboard only
- [ ] Semantic HTML (and ARIA where needed) describes controls accurately
- [ ] Screen readers announce meaningful labels for buttons, inputs, and toggles
- [ ] Hover, focus, active, and disabled states remain visually distinct
- [ ] Lighthouse accessibility audit passes locally
- [ ] No accessibility errors appear in browser DevTools console

## Theme Support

### Dark and Light Modes

The application supports both dark and light themes with full accessibility compliance in both modes. All colors are defined as CSS custom properties for easy theming.

To toggle themes:

```javascript
document.documentElement.setAttribute('data-theme', 'light');
document.documentElement.setAttribute('data-theme', 'dark');
```

### Classic UI Style

The application also supports a "classic" UI style with different typography and no texture overlay. Accessibility standards remain consistent across all UI styles.

## Component-Specific Notes

### CameraView

- All permission states use theme-aware colors
- Retry button meets contrast requirements in both themes
- Aspect ratio toggle button has clear focus indicator

### InfoDisplay

- Card background adapts to theme
- All text maintains proper contrast against card background
- Border provides clear visual separation

### GalleryLayout

- Begin button uses dedicated button color variables
- Disabled state clearly distinguishable
- Focus ring visible and meets standards

### SecretSettings

- Modal overlay provides sufficient contrast for content
- All form controls have focus indicators
- Checkbox accent color matches theme
- Range sliders have visible thumb with focus state
- Select dropdowns themed appropriately

### DebugOverlay

- Fixed position overlay with high contrast
- Status indicators use distinct colors
- Background provides sufficient contrast for all text

## Developer quick reference

### CSS variable usage

Always use CSS custom properties — never hardcode colors:

```css
/* Text */
color: var(--color-main-text); /* Primary headings, body */
color: var(--color-sub-text); /* Secondary text */
color: var(--color-bonus-text); /* Tertiary labels */
color: var(--color-text-muted); /* Hints, muted info */

/* Backgrounds */
background-color: var(--color-background);
background-color: var(--color-sub-background);
background-color: var(--modal-bg);

/* Interactive */
background-color: var(--color-button-bg);
color: var(--color-button-text);
background-color: var(--color-button-hover-bg); /* hover */
background-color: var(--color-button-disabled-bg); /* disabled */
```

### Common mistakes

```css
/* ❌ Don't: hardcoded colors */
color: #fff;
background: #000;
button:focus {
  outline: none;
} /* Never remove without replacement */

/* ✅ Do: use pre-tested variables */
color: var(--color-main-text);
background: var(--color-background);
button:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
}
```

### Checklist for new components

- Use semantic HTML (`<button>`, `<nav>`, `<main>`, `<label>`)
- Reference CSS variables, not hardcoded colors
- Verify focus indicators in both light and dark themes
- Support keyboard navigation (Tab, Enter, Escape)
- Touch targets ≥ 44×44px on mobile
- Associate every `<input>` with a `<label>`
- Run Lighthouse accessibility audit before shipping

## Resources

### WCAG Guidelines

- [WCAG 2.1 Overview](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Understanding Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)

### Tools

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Accessible Color Palette Builder](https://toolness.github.io/accessible-color-matrix/)
- [axe DevTools](https://www.deque.com/axe/devtools/)

### Testing

- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/accessibility/)
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [VoiceOver User Guide](https://www.apple.com/voiceover/info/guide/)

## Maintenance

### When Adding New Components

1. Use CSS custom properties for all colors
2. Test color contrast in both themes
3. Ensure focus indicators are visible
4. Support keyboard navigation
5. Add hover and disabled states
6. Run Lighthouse accessibility audit
7. Test with screen reader

### When Modifying Colors

1. Run contrast checker on all text
2. Verify in both light and dark modes
3. Update this documentation with new values
4. Test with Lighthouse
5. Verify focus indicators remain visible

## Contact

For accessibility questions or to report accessibility issues, please:

1. Open a GitHub issue with the "accessibility" label
2. Include specific WCAG criterion if applicable
3. Provide screenshots or screen recordings
4. Mention assistive technologies affected

---

**Last Updated**: 2025-11-14  
**WCAG Version**: 2.1 Level AA  
**Maintained By**: Photo Signal Development Team
