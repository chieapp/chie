import gui from 'gui';

export default function alert(message) {
  const dialog = gui.MessageBox.create();
  dialog.setText(message);
  dialog.addButton('OK', 0);
  dialog.setDefaultResponse(0);
  dialog.run();
}
