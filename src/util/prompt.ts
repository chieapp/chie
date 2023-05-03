import TextWindow from '../view/text-window';
import {CancelledError} from '../model/errors';

interface PromptOptions {
  width?: number;
  height?: number;
  multiLines?: boolean;
}

export default async function prompt(message: string, value: string, options: PromptOptions = {}) {
  const win = new TextWindow('prompt', value);
  win.window.setTitle(message);
  const width = options?.width ?? 200;
  win.showWithWidth(width, {minWidth: width, minHeight: options?.height ?? 80});

  const promise = new Promise<string>((resolve, reject) => {
    const submit = () => resolve(win.input.entry.getText().trim());
    win.connectYueSignal(win.window.onClose, () => {
      reject(new CancelledError('Window is closed.'));
    });
    win.connectYueSignal(win.defaultButton.onClick, submit);
    if (!options?.multiLines) {
      win.input.entry.shouldInsertNewLine = () => {
        submit();
        return false;
      };
    }
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
