# Accessibility Quick Reference

> Quick guide for developers to maintain WCAG AA accessibility standards

## ✅ Checklist for New Features

### Before Coding
- [ ] Review color palette in `docs/ACCESSIBILITY.md`
- [ ] Plan for keyboard navigation
- [ ] Consider screen reader users

### During Development
- [ ] Use CSS custom properties (not hardcoded colors)
- [ ] Add focus indicators to all interactive elements
- [ ] Include hover states for all buttons/links
- [ ] Add disabled states where applicable
- [ ] Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)

### Before Committing
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Verify focus indicators are visible
- [ ] Run Lighthouse accessibility audit
- [ ] Test in both light and dark modes
- [ ] Check contrast with browser DevTools

## 🎨 Using Color Variables

### Text Colors
```css
/* Always use CSS variables */
color: var(--color-main-text);      /* Primary text */
color: var(--color-sub-text);       /* Secondary text */
color: var(--color-bonus-text);     /* Tertiary text */
color: var(--color-text-muted);     /* Muted/hint text */
```

### Background Colors
```css
background-color: var(--color-background);     /* Main background */
background-color: var(--color-sub-background); /* Secondary background */
background-color: var(--modal-bg);             /* Modal/card background */
```

### Interactive Elements
```css
/* Buttons */
background-color: var(--color-button-bg);
color: var(--color-button-text);

/* Hover */
background-color: var(--color-button-hover-bg);

/* Disabled */
background-color: var(--color-button-disabled-bg);
color: var(--color-button-disabled-text);

/* Accent colors */
background-color: var(--color-accent);        /* Primary accent */
background-color: var(--color-accent-light);  /* Light accent */
background-color: var(--color-accent-hover);  /* Hover state */
```

## 🎯 Focus Indicators

### Automatic (Global)
Most elements get focus indicators automatically from global styles:
```css
*:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

### Custom (When Needed)
For custom focus styles, use the variables:
```css
.customElement:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
  border-radius: 4px; /* Optional */
}
```

## 🔍 Testing Colors

### Browser DevTools
1. Open DevTools (F12)
2. Inspect element
3. Find "Accessibility" panel
4. Check "Contrast" section
5. Verify ratio meets requirements

### Requirements
- Normal text: **4.5:1** minimum
- Large text (18pt+): **3.1** minimum
- Interactive elements: **3:1** minimum

## 🚫 Common Mistakes

### ❌ Don't Do This
```css
/* Hardcoded colors */
color: #fff;
background: #000;

/* Missing focus indicator */
button:focus {
  outline: none; /* Never remove without replacement */
}

/* Low contrast */
color: #888; /* May not meet WCAG AA on all backgrounds */
```

### ✅ Do This Instead
```css
/* Use CSS variables */
color: var(--color-text);
background: var(--color-background);

/* Keep focus indicators */
button:focus-visible {
  outline: var(--focus-ring-width) var(--focus-ring-style) var(--focus-ring-color);
}

/* Use accessible colors */
color: var(--color-text-muted); /* Pre-tested for WCAG AA */
```

## 🧪 Quick Testing Commands

```bash
# Lint and format
npm run lint:fix
npm run format

# Type check
npm run type-check

# Run tests
npm run test:run

# Build (checks for errors)
npm run build
```

## 📱 Keyboard Navigation

### Essential Keys
- **Tab**: Move to next interactive element
- **Shift + Tab**: Move to previous element
- **Enter/Space**: Activate buttons
- **Escape**: Close modals/dialogs
- **Arrow keys**: Navigate within components

### Testing Checklist
1. Can you reach all interactive elements with Tab?
2. Is focus order logical?
3. Can you activate all buttons with Enter/Space?
4. Can you close modals with Escape?
5. Are focus indicators visible at each step?

## 🎨 Color Contrast Quick Reference

### Dark Mode (on #0a0a0a)
| Color | Variable | Contrast |
|-------|----------|----------|
| #f5f5f5 | `--color-main-text` | 18.16:1 ✓ |
| #cbd5e1 | `--color-sub-text` | 13.33:1 ✓ |
| #a1a1aa | `--color-bonus-text` | 7.72:1 ✓ |
| #a8a8a8 | `--color-text-muted` | 8.33:1 ✓ |

### Light Mode (on #f5f5f4)
| Color | Variable | Contrast |
|-------|----------|----------|
| #0f172a | `--color-main-text` | 16.36:1 ✓ |
| #44403c | `--color-sub-text` | 9.42:1 ✓ |
| #3f3f46 | `--color-bonus-text` | 9.57:1 ✓ |
| #595959 | `--color-text-muted` | 6.42:1 ✓ |

## 🔗 Quick Links

- [Full Accessibility Documentation](./ACCESSIBILITY.md)
- [WCAG Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Lighthouse in Chrome DevTools](chrome://lighthouse)

## 💡 Tips

1. **Start with structure**: Use semantic HTML before styling
2. **Test early**: Don't wait until the end to check accessibility
3. **Think keyboard-first**: Can you use it without a mouse?
4. **Test both themes**: Check light AND dark mode
5. **Use DevTools**: The Accessibility panel is your friend

## 🆘 Need Help?

- Check `docs/ACCESSIBILITY.md` for detailed information
- Run Lighthouse for automated suggestions
- Ask in GitHub issues with "accessibility" label
- Test with a screen reader (VoiceOver, NVDA)

---

**Remember**: Accessibility isn't an add-on, it's a core requirement!
