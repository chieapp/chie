import fs from 'fs-extra';
import gui from 'gui';

import BaseChatService from '../model/base-chat-service';

export function runExportMenu(view: gui.View, service: BaseChatService) {
  const menu = gui.Menu.create([
    {
      label: 'Copy JSON',
      onClick: () => gui.Clipboard.get().setText(chatToJSON(service)),
    },
    {
      label: 'Copy Text',
      onClick: () => gui.Clipboard.get().setText(chatToText(service)),
    },
    {type: 'separator'},
    {
      label: 'Export to JSON',
      onClick: () => exportToFile(view.getWindow(), `${service.getTitle()}.json`, chatToJSON(service)),
    },
    {
      label: 'Export to Text',
      onClick: () => exportToFile(view.getWindow(), `${service.getTitle()}.txt`, chatToText(service)),
    },
  ]);
  const point = view.getBoundsInScreen();
  point.y += point.height;
  if (process.platform == 'darwin')  // macOS slightly shows menu higher
    point.y += 8;
  menu.popupAt(point);
}

function chatToJSON(service: BaseChatService) {
  return JSON.stringify({
    title: service.getTitle(),
    conversation: service.history.map(m => ({
      role: m.role.toString(),
      content: m.content,
    })),
  }, null, 2);
}

function chatToText(service: BaseChatService) {
  const separator = '\n\n-------------------\n\n';
  return `Title: ${service.getTitle()}` + separator + service.history.map(m => `${m.role.toString()}:\n${m.content.trim()}`).join(separator);
}

async function exportToFile(win: gui.Window, filename: string, content: string) {
  const dialog = gui.FileSaveDialog.create();
  dialog.setTitle('Export conversation');
  dialog.setFilename(filename);
  const chosen = win ? dialog.runForWindow(win) : dialog.run();
  if (chosen)
    await fs.writeFile(dialog.getResult(), content);
}
