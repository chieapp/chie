import TextWindow from '../view/text-window';
import {CancelledError} from '../model/errors';

export default async function prompt(message: string, value: string) {
  const win = new TextWindow('prompt', value);
  win.window.setTitle(message);
  win.showWithWidth(200, {minWidth: 200, minHeight: 80});

  const promise = new Promise<string>((resolve, reject) => {
    const submit = () => resolve(win.input.entry.getText().trim());
    win.connectYueSignal(win.window.onClose, () => {
      reject(new CancelledError('Window is closed.'));
    });
    win.connectYueSignal(win.defaultButton.onClick, submit);
    win.input.entry.shouldInsertNewLine = () => {
      submit();
      return false;
    };
  });
  try {
    return await promise;
  } catch (error) {
    if (error instanceof CancelledError)
      return null;
    else
      throw error;
  } finally {
    win.close();
  }
}
