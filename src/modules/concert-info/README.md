# Concert Info Display Module

## Purpose

Display concert metadata overlay.

## Responsibility

**ONLY** handles:

- Rendering concert information (band, venue, date)
- Fade in/out animations
- Responsive layout

**Does NOT** handle:

- Loading concert data (see `data-service`)
- Determining what to display (see App orchestrator)
- Audio playback (see `audio-playback` module)

---

## API Contract

### Component: `InfoDisplay`

**Input**:

```typescript
{
  concert: Concert | null;       // Concert to display, null to hide
  isVisible: boolean;            // Control visibility independently
  className?: string;            // Additional CSS classes
}
```

**Output**: React component (pure UI, no side effects)

---

## Styling

Uses CSS Modules for:

- Responsive, stacked layout that fits below the camera view
- Smooth transitions
- Card-style design with badges, metadata grid, and prompt
- Custom color palette via CSS variables

**Performance**: CSS transitions (GPU-accelerated)

---

## Usage Example

```typescript
import { InfoDisplay } from '@/modules/concert-info';

function App() {
  const [concert, setConcert] = useState(null);
  const [visible, setVisible] = useState(false);

  return (
    <>
      <InfoDisplay
        concert={concert}
        isVisible={visible}
        position="bottom"
      />
    </>
  );
}
```

---

## Accessibility

- Semantic HTML (`h1`, `p` tags)
- Readable text contrast
- Smooth transitions (respects prefers-reduced-motion)
- `aria-label` applied to the section for screen readers

---

## Performance

- Pure component (no side effects)
- CSS transitions only (GPU accelerated)
- Minimal re-renders

---

## Future Enhancements

- [ ] Multiple layout options (center, corner, fullscreen)
- [ ] Custom color themes per concert
- [ ] Album artwork display
- [ ] Animated text effects
- [ ] QR code for sharing

---

## Dependencies

- CSS Modules (`InfoDisplay.module.css`)
- Custom CSS variables in `src/index.css` for color palette
- `types` module (Concert interface)
