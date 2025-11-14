# Accessibility Guide

This document outlines the accessibility standards and implementation details for Photo Signal, ensuring the app is usable by everyone, including people with disabilities.

## WCAG AA Compliance

Photo Signal aims to meet **WCAG 2.1 Level AA** standards for web accessibility.

### Color Contrast Standards

All text and interactive elements meet the following minimum contrast ratios:

- **Normal text**: 4.5:1 minimum
- **Large text** (18pt+ or 14pt+ bold): 3:0:1 minimum
- **Interactive elements**: 3:1 minimum (for UI components and graphical objects)

## Color Palette

### Dark Mode (Default Theme)

All colors tested against background `#0a0a0a`:

| Variable               | Color     | Contrast Ratio | Status |
| ---------------------- | --------- | -------------- | ------ |
| `--color-main-text`    | `#f5f5f5` | 18.16:1        | ✓ PASS |
| `--color-sub-text`     | `#cbd5e1` | 13.33:1        | ✓ PASS |
| `--color-bonus-text`   | `#a1a1aa` | 7.72:1         | ✓ PASS |
| `--color-text`         | `#f5f5f5` | 18.16:1        | ✓ PASS |
| `--color-accent`       | `#4a90e2` | 6.01:1         | ✓ PASS |
| `--color-accent-light` | `#5595de` | 6.35:1         | ✓ PASS |
| `--color-accent-hover` | `#5090db` | 5.99:1         | ✓ PASS |
| `--color-text-muted`   | `#999999` | 6.95:1         | ✓ PASS |
| `--color-error`        | `#ef4444` | 5.26:1         | ✓ PASS |
| `--color-success`      | `#22c55e` | 8.69:1         | ✓ PASS |
| `--color-warning`      | `#fbbf24` | 11.86:1        | ✓ PASS |

### Light Mode Theme

All colors tested against background `#f5f5f4`:

| Variable               | Color     | Contrast Ratio | Status |
| ---------------------- | --------- | -------------- | ------ |
| `--color-main-text`    | `#0f172a` | 16.36:1        | ✓ PASS |
| `--color-sub-text`     | `#44403c` | 9.42:1         | ✓ PASS |
| `--color-bonus-text`   | `#3f3f46` | 9.57:1         | ✓ PASS |
| `--color-text`         | `#0f172a` | 16.36:1        | ✓ PASS |
| `--color-accent`       | `#2563eb` | 4.74:1         | ✓ PASS |
| `--color-accent-light` | `#1d4ed8` | 6.14:1         | ✓ PASS |
| `--color-accent-hover` | `#1e40af` | 8.00:1         | ✓ PASS |
| `--color-text-muted`   | `#555555` | 6.83:1         | ✓ PASS |
| `--color-error`        | `#b91c1c` | 5.93:1         | ✓ PASS |
| `--color-success`      | `#15803d` | 4.60:1         | ✓ PASS |
| `--color-warning`      | `#a16207` | 4.51:1         | ✓ PASS |

## Focus Indicators

All interactive elements have visible focus indicators for keyboard navigation:

```css
--color-focus: #60a5fa; /* Dark mode */
--color-focus: #1d4ed8; /* Light mode */
--focus-ring-width: 2px;
--focus-ring-offset: 2px;
```

### Implementation

Focus indicators are applied consistently across all components:

```css
.element:focus {
  outline: var(--focus-ring-width, 2px) solid var(--color-focus, #60a5fa);
  outline-offset: var(--focus-ring-offset, 2px);
}
```

### Affected Elements

- Buttons (all types)
- Checkboxes
- Select dropdowns
- Range sliders
- Links (future)
- Form inputs (future)

## Keyboard Navigation

All interactive elements are accessible via keyboard:

- **Tab**: Navigate forward through interactive elements
- **Shift + Tab**: Navigate backward
- **Enter/Space**: Activate buttons and controls
- **Arrow keys**: Adjust range sliders (future enhancement)
- **Escape**: Close modals and overlays

## Testing Accessibility

### Manual Testing

1. **Contrast Testing**:
   - Use browser DevTools "Inspect" > "Accessibility" tab
   - Verify contrast ratios for all text and UI elements
   - Test in both light and dark modes

2. **Keyboard Testing**:
   - Disable mouse/trackpad
   - Navigate entire app using only keyboard
   - Verify all interactive elements are reachable
   - Verify focus indicators are clearly visible

3. **Screen Reader Testing**:
   - Use VoiceOver (macOS), NVDA (Windows), or JAWS (Windows)
   - Verify all content is announced correctly
   - Verify proper heading hierarchy
   - Verify button labels are descriptive

### Automated Testing

#### Browser DevTools

Chrome/Edge:

1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Accessibility" category
4. Run audit

Firefox:

1. Open DevTools (F12)
2. Go to "Accessibility" tab
3. Review accessibility tree and issues

#### Third-Party Tools

- **axe DevTools**: [Chrome Extension](https://www.deque.com/axe/devtools/)
- **WAVE**: [Web Accessibility Evaluation Tool](https://wave.webaim.org/)
- **Contrast Checker**: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Best Practices for Contributors

### Adding New Colors

When adding new colors, always verify contrast ratios:

1. Use a contrast calculator (WebAIM, Contrast Ratio, etc.)
2. Test against both light and dark backgrounds
3. Ensure minimum 4.5:1 for normal text
4. Document contrast ratios in code comments

Example:

```css
/* Good: Documented contrast ratio */
--color-new-element: #4a90e2; /* 6.01:1 contrast on dark bg */

/* Bad: No verification */
--color-new-element: #abc123;
```

### Adding New Interactive Elements

Always include focus indicators:

```css
/* Required for all interactive elements */
.newButton:focus {
  outline: var(--focus-ring-width, 2px) solid var(--color-focus, #60a5fa);
  outline-offset: var(--focus-ring-offset, 2px);
}
```

### Use Semantic HTML

Prefer semantic HTML elements for better accessibility:

```html
<!-- Good: Semantic button -->
<button onClick="{handleClick}">Click me</button>

<!-- Bad: Non-semantic div -->
<div onClick="{handleClick}">Click me</div>
```

### Provide Alternative Text

Always provide alt text for images (when added in future):

```jsx
<!-- Good: Descriptive alt text -->
<img src="concert.jpg" alt="The Beatles concert at Shea Stadium, 1965" />

<!-- Bad: Missing or generic alt text -->
<img src="concert.jpg" />
<img src="concert.jpg" alt="image" />
```

## Component-Specific Guidelines

### Buttons

- Use `<button>` elements, not divs or spans
- Include visible focus indicators
- Ensure adequate color contrast (3:1 minimum for UI components)
- Use descriptive text or aria-label

### Forms (Future)

- Associate labels with inputs using `for`/`id`
- Provide clear error messages
- Indicate required fields
- Support keyboard navigation

### Modals

- Trap focus within modal when open
- Provide close button with keyboard shortcut (Escape)
- Return focus to trigger element when closed
- Use `aria-modal="true"` and `role="dialog"`

## Resources

### WCAG Guidelines

- [WCAG 2.1 Overview](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)
- [Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

### Tools

- [Accessible Color Palette Builder](https://toolness.github.io/accessible-color-matrix/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Testing

- [Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

## Accessibility Checklist

Use this checklist when adding new features:

- [ ] All text has 4.5:1 contrast ratio minimum
- [ ] All UI components have 3:1 contrast ratio minimum
- [ ] All interactive elements have visible focus indicators
- [ ] All interactive elements are keyboard accessible
- [ ] All functionality works without mouse
- [ ] Semantic HTML used where appropriate
- [ ] ARIA labels added where needed
- [ ] Tested with keyboard only
- [ ] Tested with screen reader (if applicable)
- [ ] Ran Lighthouse accessibility audit
- [ ] No accessibility errors in browser console

## Future Enhancements

Planned accessibility improvements:

- [ ] Add ARIA landmarks for page regions
- [ ] Implement skip navigation link
- [ ] Add reduced motion support (`prefers-reduced-motion`)
- [ ] Add high contrast mode
- [ ] Improve screen reader announcements for dynamic content
- [ ] Add keyboard shortcuts documentation
- [ ] Implement focus management for SPA navigation

## Contact

For accessibility questions or issues, please:

1. Open an issue on GitHub with the `accessibility` label
2. Include specific details about the accessibility barrier
3. Describe your assistive technology setup if relevant
4. Suggest improvements if you have ideas

We are committed to making Photo Signal accessible to everyone.
