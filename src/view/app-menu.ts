import gui from 'gui';

export default class AppMenu {
  menu: gui.MenuBar;

  constructor(win?: gui.Window) {
    const template = [];

    // The main menu.
    template.push({
      label: require('../../package.json').build.productName,
      submenu: [
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          onClick() {
            if (gui.MessageLoop.quit)
              gui.MessageLoop.quit();
            process.exit(0);
          }
        },
      ],
    });

    // Edit menu.
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'select-all' },
      ],
    });

    // Windows menu.
    template.push({
      label: 'Window',
      role: 'window',
      submenu: [
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          onClick() { win?.close(); }
        },
      ],
    });

    // Create the native menu.
    this.menu = gui.MenuBar.create(template);
  }
}
