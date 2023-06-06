import gui from 'gui';

import Icon from '../model/icon';
import windowManager from '../controller/window-manager';

interface TrayRecord {
  tray: gui.Tray;
  icon: Icon;
}

export class TrayManager {
  chatTrays: Record<string, TrayRecord> = {};

  setTrayForChatWindow(id: string, icon: Icon | null) {
    const record = this.chatTrays[id];
    if (!record && !icon)  // ignore when set null to null
      return;
    if (record?.icon == icon)  // ignore when icon is not changed
      return;
    if (record)  // remove existing tray
      record.tray.remove();
    if (icon) {  // create new one
      const tray = gui.Tray.createWithImage(icon.getImage());
      tray.onClick = () => windowManager.showChatWindow(id);
      this.chatTrays[id] = {tray, icon};
    } else {  // remove record
      delete this.chatTrays[id];
    }
  }
}

export default new TrayManager;
