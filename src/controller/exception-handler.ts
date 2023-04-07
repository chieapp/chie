import gui from 'gui';

let quitOnException = true;

export function setQuitOnException(q: boolean) {
  quitOnException = q;
}

process.on('uncaughtException', showError);
process.on('unhandledRejection', showError);

function showError(error: Error) {
  const dialog = gui.MessageBox.create();
  dialog.setType('error');
  if (process.platform != 'darwin')
    dialog.setTitle('Error');
  dialog.setText(error.message);
  dialog.setInformativeText(error.stack);
  dialog.addButton('Copy error', 0);
  dialog.setDefaultResponse(0);
  dialog.addButton('Close', -1);
  if (dialog.run() == 0)
    gui.Clipboard.get().setText(`${error.message}\n${error.stack}`);
  if (quitOnException) {
    gui.MessageLoop.quit();
    process.exit(1);
  }
}
