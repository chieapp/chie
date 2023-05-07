import fs from 'fs-extra';
import gui from 'gui';

import ChatService from '../model/chat-service';

export function runExportMenu(win: gui.Window, service: ChatService) {
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
      onClick: () => exportToFile(win, `${service.getTitle()}.json`, chatToJSON(service)),
    },
    {
      label: 'Export to Text',
      onClick: () => exportToFile(win, `${service.getTitle()}.txt`, chatToText(service)),
    },
  ]);
  menu.popup();
}

function chatToJSON(service: ChatService) {
  return JSON.stringify({
    title: service.getTitle(),
    conversation: service.getHistory().map(m => ({
      role: m.role.toString(),
      content: m.content,
    })),
  }, null, 2);
}

function chatToText(service: ChatService) {
  const separator = '\n\n-------------------\n\n';
  return `Title: ${service.getTitle()}` + separator + service.getHistory().map(m => `${m.role.toString()}:\n${m.content.trim()}`).join(separator);
}

async function exportToFile(win: gui.Window, filename: string, content: string) {
  const dialog = gui.FileSaveDialog.create();
  dialog.setTitle('Export conversation');
  dialog.setFilename(filename);
  const chosen = win ? dialog.runForWindow(win) : dialog.run();
  if (chosen)
    await fs.writeFile(dialog.getResult(), content);
}
