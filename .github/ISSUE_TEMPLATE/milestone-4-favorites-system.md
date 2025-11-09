---
name: 'M4.2: Implement Favorites System'
about: Add ability to favorite concerts and view favorites list
title: 'Implement Favorites System'
labels: ['milestone-4', 'feature', 'ui', 'ux']
assignees: ''
---

## Milestone

Milestone 4: User Experience Enhancements

## Objective

Enable users to favorite concerts and maintain a list of favorites that persists across sessions.

## Parallel Development

This feature can be built by **multiple agents working in parallel**:

### Agent A: Favorites Logic Module

Create `src/modules/favorites/` with state management

### Agent B: Favorites UI Module

Create `src/modules/favorites-ui/` with button and list components

### Agent C: Storage Service (if needed)

Create `src/services/storage-service/` for persistence

All three can work simultaneously with zero conflicts!

---

## Tasks for Agent A: Favorites Logic

- [ ] Create favorites module
  - Create `src/modules/favorites/` directory
  - Create `useFavorites.ts` hook
  - Create `types.ts`
  - Create `index.ts`
  - Create `README.md`

- [ ] Implement useFavorites hook

  ```typescript
  interface UseFavoritesReturn {
    favorites: number[]; // Array of concert IDs
    isFavorite: (id: number) => boolean;
    toggleFavorite: (id: number) => void;
    addFavorite: (id: number) => void;
    removeFavorite: (id: number) => void;
    clearFavorites: () => void;
  }
  ```

- [ ] Implement persistence
  - Load favorites from localStorage on mount
  - Save favorites on every change
  - Handle localStorage errors gracefully

---

## Tasks for Agent B: Favorites UI

- [ ] Create favorites UI module
  - Create `src/modules/favorites-ui/` directory
  - Create `FavoriteButton.tsx` component
  - Create `FavoritesList.tsx` component
  - Create `types.ts`
  - Create `index.ts`
  - Create `README.md`

- [ ] Create FavoriteButton component
  - Heart icon that toggles filled/unfilled
  - Shows current favorite state
  - Calls toggleFavorite on click
  - Accessible with keyboard
  - Smooth animation on toggle

- [ ] Create FavoritesList component
  - Displays list of favorited concerts
  - Shows concert details (band, venue, date)
  - Allows removing from favorites
  - Shows empty state when no favorites
  - Allows playing concert from list

- [ ] Add favorites page/modal
  - Create route or modal for viewing all favorites
  - Filter concert data to show only favorites
  - Add "Clear All" button
  - Mobile-responsive design

---

## Tasks for Agent C: Storage Service

- [ ] Create storage service (if doesn't exist)
  - Create `src/services/storage-service/` directory
  - Create `StorageService.ts`
  - Create `types.ts`
  - Create `index.ts`
  - Create `README.md`

- [ ] Implement localStorage wrapper

  ```typescript
  class StorageService {
    get<T>(key: string): T | null;
    set<T>(key: string, value: T): void;
    remove(key: string): void;
    clear(): void;
  }
  ```

- [ ] Add error handling
  - Handle quota exceeded
  - Handle private browsing mode
  - Provide fallback in-memory storage

---

## Integration Tasks

- [ ] Integrate FavoriteButton in InfoDisplay
  - Add button next to concert info
  - Pass concert ID and favorite state

- [ ] Add favorites navigation
  - Add favorites icon to header
  - Link to favorites list/modal

- [ ] Update App.tsx
  - Import and use useFavorites
  - Pass favorites state to components

## Acceptance Criteria

- [ ] Users can favorite/unfavorite concerts
- [ ] Favorites persist across page reloads
- [ ] Favorites list shows all favorited concerts
- [ ] Can play concert directly from favorites list
- [ ] Can remove from favorites
- [ ] Heart icon animation is smooth
- [ ] Works on mobile and desktop
- [ ] Module READMEs document contracts
- [ ] No breaking changes to existing code

## Dependencies

None - Can be done independently or in parallel by multiple agents

## Estimated Effort

- Agent A: 4-6 hours
- Agent B: 6-8 hours
- Agent C: 3-4 hours
- Integration: 2-3 hours
- **Total if parallel**: ~8-10 hours
- **Total if sequential**: ~15-21 hours

## Files to Create

**Agent A:**

- `src/modules/favorites/useFavorites.ts`
- `src/modules/favorites/types.ts`
- `src/modules/favorites/index.ts`
- `src/modules/favorites/README.md`

**Agent B:**

- `src/modules/favorites-ui/FavoriteButton.tsx`
- `src/modules/favorites-ui/FavoritesList.tsx`
- `src/modules/favorites-ui/types.ts`
- `src/modules/favorites-ui/index.ts`
- `src/modules/favorites-ui/README.md`

**Agent C:**

- `src/services/storage-service/StorageService.ts`
- `src/services/storage-service/types.ts`
- `src/services/storage-service/index.ts`
- `src/services/storage-service/README.md`

## Design Considerations

- Use heart icon (filled = favorited, outline = not favorited)
- Add haptic feedback on mobile (if supported)
- Show toast notification on favorite/unfavorite
- Consider adding favorite count to UI

## References

- [localStorage Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)
- [AI_AGENT_GUIDE.md](../../AI_AGENT_GUIDE.md) - Example 4 shows this exact pattern!
