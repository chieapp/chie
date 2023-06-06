import gui from 'gui';

import windowManager from '../controller/window-manager';

interface ShortcutRecord {
  shortcutId: number;
  accelerator: string;
}

export class ShortcutManager {
  dashboarShortcut?: ShortcutRecord;
  chatWindowShortcuts: Record<string, ShortcutRecord> = {};

  setDashboardShortcut(accelerator: string | null) {
    if (this.dashboarShortcut)
      gui.globalShortcut.unregister(this.dashboarShortcut.shortcutId);
    if (accelerator) {
      const shortcutId = gui.globalShortcut.register(accelerator, () => windowManager.showNamedWindow('dashboard'));
      this.dashboarShortcut = {shortcutId, accelerator};
    } else {
      this.dashboarShortcut = null;
    }
  }

  setShortcutForChatWindow(id: string, accelerator: string | null) {
    const existing = this.chatWindowShortcuts[id];
    if (existing)
      gui.globalShortcut.unregister(existing.shortcutId);
    if (accelerator) {
      const shortcutId = gui.globalShortcut.register(accelerator, () => windowManager.showChatWindow(id));
      this.chatWindowShortcuts[id] = {shortcutId, accelerator};
    } else {
      delete this.chatWindowShortcuts[id];
    }
  }
}

export default new ShortcutManager;
