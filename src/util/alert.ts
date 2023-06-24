import gui from 'gui';

export default function alert(message, options: {window?: gui.Window} = {}) {
  const dialog = gui.MessageBox.create();
  dialog.setText(message);
  dialog.addButton('OK', 0);
  dialog.setDefaultResponse(0);
  if (options?.window)
    dialog.runForWindow(options.window);
  else
    dialog.run();
}
