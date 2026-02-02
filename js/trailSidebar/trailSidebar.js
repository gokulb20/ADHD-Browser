const webviews = require('webviews.js')
const urlParser = require('util/urlParser.js')

const trailSidebar = {
  container: null,
  contextMenu: null,
  visible: false,
  collapsedNodes: new Set(), // Track which nodes are collapsed in the UI

  initialize () {
    // Create sidebar container
    this.container = document.createElement('div')
    this.container.className = 'trail-sidebar'
    this.container.id = 'trail-sidebar'
    this.container.setAttribute('hidden', '')

    // Add header
    const header = document.createElement('div')
    header.className = 'trail-sidebar-header'
    
    const headerTitle = document.createElement('span')
    headerTitle.className = 'trail-sidebar-title'
    headerTitle.textContent = 'Trail'
    header.appendChild(headerTitle)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'trail-sidebar-close i carbon:close'
    closeBtn.addEventListener('click', () => this.hide())
    header.appendChild(closeBtn)

    this.container.appendChild(header)

    // Add tree container
    const treeContainer = document.createElement('div')
    treeContainer.className = 'trail-tree'
    treeContainer.id = 'trail-tree'
    this.container.appendChild(treeContainer)

    // Create context menu
    this.createContextMenu()

    // Insert into DOM (after navbar, before webviews)
    const webviewsEl = document.getElementById('webviews')
    document.body.insertBefore(this.container, webviewsEl)

    // Close context menu on click outside
    document.addEventListener('click', () => this.hideContextMenu())
    document.addEventListener('contextmenu', (e) => {
      if (!this.container.contains(e.target)) {
        this.hideContextMenu()
      }
    })

    // Listen for tab events to update tree
    this.setupEventListeners()
  },

  createContextMenu () {
    this.contextMenu = document.createElement('div')
    this.contextMenu.className = 'trail-context-menu'
    this.contextMenu.id = 'trail-context-menu'
    this.contextMenu.setAttribute('hidden', '')
    document.body.appendChild(this.contextMenu)
  },

  showContextMenu (x, y, tabId) {
    this.hideContextMenu()
    
    const tab = tabs.get(tabId)
    if (!tab) return

    const children = tasks.getChildren(tabId)
    const hasChildren = children.length > 0

    // Build menu items
    const menuItems = [
      { label: 'Rename Trail...', action: () => this.promptRenameTrail(tabId) },
      { label: 'Set Emoji...', action: () => this.promptSetEmoji(tabId) },
      { type: 'separator' },
      { label: 'Collapse All Children', action: () => this.collapseAllChildren(tabId), disabled: !hasChildren },
      { label: 'Expand All Children', action: () => this.expandAllChildren(tabId), disabled: !hasChildren },
      { type: 'separator' },
      { label: 'Delete Branch', action: () => this.deleteBranch(tabId), className: 'danger' },
      { label: 'Prune Children', action: () => this.pruneChildren(tabId), disabled: !hasChildren, className: 'danger' }
    ]

    this.contextMenu.innerHTML = ''
    menuItems.forEach(item => {
      if (item.type === 'separator') {
        const sep = document.createElement('div')
        sep.className = 'trail-context-separator'
        this.contextMenu.appendChild(sep)
      } else {
        const menuItem = document.createElement('div')
        menuItem.className = 'trail-context-item'
        if (item.disabled) menuItem.classList.add('disabled')
        if (item.className) menuItem.classList.add(item.className)
        menuItem.textContent = item.label
        if (!item.disabled) {
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation()
            this.hideContextMenu()
            item.action()
          })
        }
        this.contextMenu.appendChild(menuItem)
      }
    })

    // Position menu
    this.contextMenu.style.left = x + 'px'
    this.contextMenu.style.top = y + 'px'
    this.contextMenu.removeAttribute('hidden')

    // Adjust if menu goes off screen
    const rect = this.contextMenu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = (window.innerWidth - rect.width - 5) + 'px'
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = (window.innerHeight - rect.height - 5) + 'px'
    }
  },

  hideContextMenu () {
    if (this.contextMenu) {
      this.contextMenu.setAttribute('hidden', '')
    }
  },

  // Trail Management Functions
  promptRenameTrail (tabId) {
    const tab = tabs.get(tabId)
    if (!tab) return

    const currentName = tab.trailName || tab.title || ''
    const newName = prompt('Enter trail name:', currentName)
    
    if (newName !== null) {
      tabs.update(tabId, { trailName: newName || null })
      this.render()
    }
  },

  promptSetEmoji (tabId) {
    const tab = tabs.get(tabId)
    if (!tab) return

    const currentEmoji = tab.trailEmoji || ''
    const newEmoji = prompt('Enter emoji for this trail:', currentEmoji)
    
    if (newEmoji !== null) {
      tabs.update(tabId, { trailEmoji: newEmoji || null })
      this.render()
    }
  },

  collapseAllChildren (tabId) {
    const descendants = tasks.getDescendants(tabId)
    descendants.forEach(child => {
      const hasGrandchildren = tasks.getChildren(child.id).length > 0
      if (hasGrandchildren) {
        tasks.collapseTab(child.id)
        this.collapsedNodes.add(child.id)
      }
    })
    // Also collapse the target node
    tasks.collapseTab(tabId)
    this.collapsedNodes.add(tabId)
    this.render()
  },

  expandAllChildren (tabId) {
    const descendants = tasks.getDescendants(tabId)
    descendants.forEach(child => {
      tasks.expandTab(child.id)
      this.collapsedNodes.delete(child.id)
    })
    // Also expand the target node
    tasks.expandTab(tabId)
    this.collapsedNodes.delete(tabId)
    this.render()
  },

  deleteBranch (tabId) {
    const tab = tabs.get(tabId)
    if (!tab) return

    const descendants = tasks.getDescendants(tabId)
    const count = descendants.length + 1

    if (count > 1 && !confirm(`Delete this tab and ${descendants.length} descendant${descendants.length > 1 ? 's' : ''}?`)) {
      return
    }

    const browserUI = require('browserUI.js')
    
    // Delete descendants first (deepest first to avoid issues)
    const sortedDescendants = descendants.reverse()
    sortedDescendants.forEach(d => {
      browserUI.destroyTab(d.id)
    })
    
    // Delete the main tab
    browserUI.destroyTab(tabId)
  },

  pruneChildren (tabId) {
    const tab = tabs.get(tabId)
    if (!tab) return

    const descendants = tasks.getDescendants(tabId)
    if (descendants.length === 0) return

    if (!confirm(`Delete ${descendants.length} descendant tab${descendants.length > 1 ? 's' : ''}?`)) {
      return
    }

    const browserUI = require('browserUI.js')
    
    // Delete all descendants (deepest first)
    const sortedDescendants = descendants.reverse()
    sortedDescendants.forEach(d => {
      browserUI.destroyTab(d.id)
    })
    
    // Clear childIds on the parent
    tabs.update(tabId, { childIds: [] })
    this.render()
  },

  // Collapse/expand current trail (for keyboard shortcuts)
  collapseCurrentTrail () {
    const selectedTabId = tabs.getSelected()
    if (!selectedTabId) return
    
    const children = tasks.getChildren(selectedTabId)
    if (children.length > 0) {
      tasks.collapseTab(selectedTabId)
      this.collapsedNodes.add(selectedTabId)
      this.render()
    }
  },

  expandCurrentTrail () {
    const selectedTabId = tabs.getSelected()
    if (!selectedTabId) return
    
    tasks.expandTab(selectedTabId)
    this.collapsedNodes.delete(selectedTabId)
    this.render()
  },

  renameCurrentTrail () {
    const selectedTabId = tabs.getSelected()
    if (selectedTabId) {
      this.promptRenameTrail(selectedTabId)
    }
  },

  setupEventListeners () {
    // Update on tab changes
    tasks.on('tab-added', () => this.render())
    tasks.on('tab-destroyed', () => this.render())
    tasks.on('tab-selected', () => this.render())
    tasks.on('tab-updated', (id, key) => {
      if (['title', 'url', 'trailName', 'trailEmoji'].includes(key)) {
        this.render()
      }
    })
    tasks.on('tab-reparented', () => this.render())
    tasks.on('tab-collapsed', () => this.render())
    tasks.on('tab-expanded', () => this.render())
    tasks.on('task-selected', () => this.render())
  },

  render () {
    if (!this.visible) return

    const treeContainer = document.getElementById('trail-tree')
    if (!treeContainer) return

    // Clear existing content
    treeContainer.innerHTML = ''

    const currentTask = tasks.getSelected()
    if (!currentTask) return

    // Get all root tabs (no parent)
    const rootTabs = tasks.getRootTabs(currentTask.id)
    const selectedTabId = tabs.getSelected()

    // Render each root and its descendants
    rootTabs.forEach(rootTab => {
      this.renderNode(rootTab, 0, treeContainer, selectedTabId)
    })
  },

  renderNode (tab, depth, container, selectedTabId) {
    const nodeEl = document.createElement('div')
    nodeEl.className = 'trail-node'
    nodeEl.setAttribute('data-tab-id', tab.id)
    nodeEl.style.setProperty('--depth', depth)

    if (tab.id === selectedTabId) {
      nodeEl.classList.add('selected')
    }

    // Get children for this tab
    const children = tasks.getChildren(tab.id)
    const hasChildren = children.length > 0
    const isCollapsed = tab.collapsed || this.collapsedNodes.has(tab.id)

    // Collapse/expand button
    const collapseBtn = document.createElement('span')
    collapseBtn.className = 'trail-collapse-btn'
    if (hasChildren) {
      collapseBtn.textContent = isCollapsed ? '▶' : '▼'
      collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.toggleNodeCollapse(tab.id)
      })
    } else {
      collapseBtn.textContent = '•'
      collapseBtn.classList.add('trail-collapse-btn-leaf')
    }
    nodeEl.appendChild(collapseBtn)

    // Emoji (if set)
    if (tab.trailEmoji) {
      const emojiEl = document.createElement('span')
      emojiEl.className = 'trail-emoji'
      emojiEl.textContent = tab.trailEmoji
      nodeEl.appendChild(emojiEl)
    } else {
      // Favicon (only if no emoji)
      const favicon = document.createElement('img')
      favicon.className = 'trail-favicon'
      const domain = urlParser.getDomain(tab.url)
      if (domain && !urlParser.isInternalURL(tab.url)) {
        favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
        favicon.onerror = () => {
          favicon.style.display = 'none'
        }
      } else {
        favicon.style.display = 'none'
      }
      nodeEl.appendChild(favicon)
    }

    // Title (use trailName if set, otherwise page title)
    const titleEl = document.createElement('span')
    titleEl.className = 'trail-title'
    
    let displayTitle = tab.trailName || tab.title || tab.url || 'New Tab'
    let fullTitle = tab.trailName || tab.title || tab.url || 'New Tab'
    
    // Truncate long titles
    if (displayTitle.length > 40) {
      displayTitle = displayTitle.substring(0, 40) + '…'
    }
    titleEl.textContent = displayTitle
    titleEl.title = fullTitle // Full title on hover
    
    // Add custom name indicator
    if (tab.trailName) {
      nodeEl.classList.add('has-trail-name')
    }
    nodeEl.appendChild(titleEl)

    // Click handler to switch tabs
    nodeEl.addEventListener('click', () => {
      const browserUI = require('browserUI.js')
      browserUI.switchToTab(tab.id)
    })

    // Right-click context menu
    nodeEl.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.showContextMenu(e.clientX, e.clientY, tab.id)
    })

    container.appendChild(nodeEl)

    // Render children if not collapsed
    if (hasChildren && !isCollapsed) {
      children.forEach(child => {
        this.renderNode(child, depth + 1, container, selectedTabId)
      })
    }
  },

  toggleNodeCollapse (tabId) {
    const task = tasks.getTaskContainingTab(tabId)
    if (!task) return

    const tab = tabs.get(tabId)
    if (!tab) return

    // Toggle collapsed state
    if (tab.collapsed) {
      tasks.expandTab(tabId)
      this.collapsedNodes.delete(tabId)
    } else {
      tasks.collapseTab(tabId)
      this.collapsedNodes.add(tabId)
    }
  },

  show () {
    if (!this.container) return
    
    this.visible = true
    this.container.removeAttribute('hidden')
    document.body.classList.add('trail-sidebar-visible')
    this.render()
  },

  hide () {
    if (!this.container) return
    
    this.visible = false
    this.container.setAttribute('hidden', '')
    document.body.classList.remove('trail-sidebar-visible')
  },

  toggle () {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  },

  isVisible () {
    return this.visible
  }
}

module.exports = trailSidebar
