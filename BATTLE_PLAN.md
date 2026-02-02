# ADHD Browser → Browser.horse Clone
## Battle Plan

### Goal
Transform Min browser fork into a Trails-based browser like browser.horse.

### Core Transformation
**Current:** Flat tab list within Tasks
**Target:** Tree structure (Trails) where clicking links creates child nodes

---

## Phase 1: Trail Data Model
**Branch:** `feature/trail-data-model`

Modify `js/tabState/tab.js` to add tree structure:

```javascript
// Add to tab properties:
{
  parentId: null,        // ID of parent tab (null = root)
  childIds: [],          // Array of child tab IDs
  collapsed: false,      // Whether children are hidden
  trailName: null,       // Optional name for this trail branch
  trailEmoji: null,      // Optional emoji
  depth: 0,              // Nesting level (for indentation)
}
```

**Files to modify:**
- `js/tabState/tab.js` - Add new properties to tab schema
- `js/tabState/task.js` - Add tree traversal helpers

**New methods needed:**
- `getChildren(tabId)` - Get direct children
- `getDescendants(tabId)` - Get all descendants
- `getAncestors(tabId)` - Get path to root
- `reparent(tabId, newParentId)` - Move tab in tree
- `collapseTab(tabId)` / `expandTab(tabId)`

---

## Phase 2: Link Click Interception
**Branch:** `feature/link-interception`

When user clicks a link, create child tab instead of sibling.

**Files to modify:**
- `js/webviews.js` - Intercept navigation events
- `js/preload/` - Capture link clicks in page

**Logic:**
```javascript
// On link click or new-window event:
1. Get current tab ID
2. Create new tab with parentId = current tab ID
3. Update parent's childIds array
4. Calculate depth from parent
```

---

## Phase 3: Trail Sidebar UI
**Branch:** `feature/trail-sidebar`

New sidebar component showing trail tree.

**New files:**
- `js/trailSidebar/trailSidebar.js` - Main component
- `js/trailSidebar/trailNode.js` - Individual node renderer
- `css/trailSidebar.css` - Styles

**Features:**
- Tree view with indentation based on depth
- Collapse/expand toggles
- Current tab highlighted
- Drag-and-drop reordering
- Right-click context menu (rename, delete, collapse)

**UI Structure:**
```
[Trail Sidebar]
├── 📁 Research Project (collapsed)
├── 📂 Shopping
│   ├── Amazon search
│   │   ├── Product A
│   │   └── Product B
│   └── eBay search
└── 🔍 Current browsing
    └── Article about X
        └── Related article Y
```

---

## Phase 4: Trail Management
**Branch:** `feature/trail-management`

**Features:**
- Name trails (with emoji picker)
- Create new root trail
- Merge trails
- Prune (delete branches)
- Fold/hide trails for focus

**New files:**
- `js/trailManager.js` - Trail CRUD operations
- `js/emojiPicker.js` - Emoji selector component

**Keyboard shortcuts:**
- `Cmd+Shift+N` - New root trail
- `Cmd+[` / `Cmd+]` - Collapse/expand current
- `Cmd+Shift+R` - Rename current trail

---

## Phase 5: Persistence & Polish
**Branch:** `feature/persistence`

**Files to modify:**
- `js/sessionRestore.js` - Save/restore tree structure
- `main/main.js` - Handle window state

**Features:**
- Auto-save trail state
- Restore on launch
- Export trails as bookmarks/outline
- Performance optimization for large trees

---

## Git Branch Strategy

```
main
└── develop
    ├── feature/trail-data-model      (Phase 1)
    ├── feature/link-interception     (Phase 2)
    ├── feature/trail-sidebar         (Phase 3)
    ├── feature/trail-management      (Phase 4)
    └── feature/persistence           (Phase 5)
```

Phases 1+2 are dependencies. Phases 3+4+5 can parallelize after 1+2 merge.

---

## Sub-Agent Tasks

### Task A: Trail Data Model (Phase 1)
- Modify tab.js with parentId, childIds, depth, collapsed
- Add tree traversal methods to task.js
- Write unit tests
- **Output:** Branch `feature/trail-data-model`

### Task B: Link Interception (Phase 2)  
- Modify webviews.js to intercept new-window/navigation
- Update preload scripts to capture click source
- Create child tabs on link click
- **Output:** Branch `feature/link-interception`
- **Depends on:** Task A

### Task C: Trail Sidebar UI (Phase 3)
- Create trailSidebar component
- Render tree with indentation
- Add collapse/expand functionality
- Style with CSS
- **Output:** Branch `feature/trail-sidebar`
- **Depends on:** Task A

### Task D: Trail Management (Phase 4)
- Implement naming, emoji, merge, prune
- Add keyboard shortcuts
- Create context menus
- **Output:** Branch `feature/trail-management`
- **Depends on:** Task A, Task C

### Task E: Persistence (Phase 5)
- Modify sessionRestore for tree structure
- Test save/restore cycle
- **Output:** Branch `feature/persistence`
- **Depends on:** Task A

---

## Execution Order

```
[Task A: Data Model] ──────────────────────────────────┐
                                                        │
[Task B: Link Intercept] ─── (depends on A) ───────────┤
                                                        │
[Task C: Sidebar UI] ───── (depends on A) ─────────────┼──→ [Merge to develop]
                                                        │
[Task D: Management] ───── (depends on A, C) ──────────┤
                                                        │
[Task E: Persistence] ──── (depends on A) ─────────────┘
```

**Parallel execution:**
- Round 1: Task A (blocks everything)
- Round 2: Tasks B, C, E (parallel, all depend only on A)
- Round 3: Task D (depends on C)
- Round 4: Integration testing + merge

---

## Success Criteria

1. ✅ Clicking a link creates a child tab in the tree
2. ✅ Sidebar shows browsing history as a tree
3. ✅ Can collapse/expand branches
4. ✅ Can name trails with emoji
5. ✅ State persists across restart
6. ✅ Can prune/delete branches
7. ✅ Smooth performance with 100+ nodes
