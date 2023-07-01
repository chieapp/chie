import gui from 'gui';
import {Signal} from 'typed-signals';

import AppearanceAware from '../view/appearance-aware';
import Icon from '../model/icon';
import Param, {Selection} from '../model/param';
import ToggleButton from '../view/toggle-button';
import ShortcutEditor from '../view/shortcut-editor';
import basicStyle from '../view/basic-style';
import prompt from '../util/prompt';
import {style} from '../view/dashboard-window';

export const labelWidth = 110;
export const labelPadding = 8;
export const valueMarginLeft = labelWidth + labelPadding;

let descriptionFont: gui.Font;
const descriptionColor = {
  light: '#444',
  dark: '#BBB',
};

abstract class ParamRow<T extends gui.View = gui.View> extends AppearanceAware {
  param: Param;
  label: gui.Label;
  editor: T;
  nullable: boolean;
  description?: gui.Label;
  onChange?: Signal<() => void>;

  affects: ParamRow[] = [];

  constructor(param: Param, editor: T, nullable: boolean = true) {
    super();
    this.param = param;
    this.editor = editor;
    this.nullable = nullable;

    // Label on the left.
    this.view.setStyle({flexDirection: 'row'});
    this.label = gui.Label.create(`${param.displayName ?? param.name}:`);
    this.label.setStyle({width: labelWidth, marginRight: labelPadding});
    this.label.setAlign('end');
    this.view.addChildView(this.label);

    // Editor view on the right.
    editor.setStyle({flex: 1, alignSelf: 'flex-end'});
    this.view.addChildView(editor);

    // Description view on another line.
    if (param.description)
      this.createDescription(param.description);
  }

  onColorSchemeChange() {
    super.onColorSchemeChange();
    this.description?.setColor(descriptionColor[this.darkMode ? 'dark' : 'light']);
  }

  addToView(container: gui.Container) {
    container.addChildView(this.view);
    if (this.description)
      container.addChildView(this.description);
  }

  // Update the content after controlling view has been changed.
  update() {
    // Nothing to update by default.
  }

  // Helper for rows that do not use standard view.
  subscribeOnChange(callback: () => void) {
    if (!this.onChange)
      this.onChange = new Signal();
    this.connections.add(this.onChange.connect(callback));
  }

  abstract getValue();
  abstract setValue(value);

  protected createDescription(text = '') {
    if (this.description)
      throw new Error('There is already description for the param.');
    this.description = gui.Label.create(text);
    this.description.setAlign('start');
    this.description.setStyle({
      marginTop: -4,
      marginLeft: valueMarginLeft + 2,
    });
    if (!descriptionFont)
      descriptionFont = gui.Font.default().derive(-2, 'normal', 'normal');
    this.description.setFont(descriptionFont);
    this.onColorSchemeChange();
  }
}

export class PickerParamRow extends ParamRow<gui.Picker> {
  selections?: Selection[];
  constrainedBy?: ParamRow;

  constructor(param: Param, constrainedBy?: ParamRow, nullable = false) {
    if (!param.selections)
      throw new Error('Property "selections" expected.');
    super(param, gui.Picker.create(), nullable);

    this.selections = param.selections instanceof Function ? param.selections() : param.selections;

    // Listen to controlling param's change and update.
    if (constrainedBy) {
      this.constrainedBy = constrainedBy;
      constrainedBy.affects.push(this);
      constrainedBy.subscribeOnChange(() => {
        this.update();
        // Iterate all params constrained by this.
        this.affects.forEach(p => p.update());
      });
    }
    // There is a description field in selection.
    if (this.selections.length > 0 &&
        typeof this.selections[0].value == 'object' &&
        'description' in this.selections[0].value) {
      this.createDescription();
      this.subscribeOnChange(() => this.#updateDescription());
    }
    // Fill the picker with selections.
    this.update();
  }

  update() {
    let selections = this.selections;
    if (this.param.constrain && this.constrainedBy) {
      const controllingValue = this.constrainedBy.getValue();
      if (controllingValue)
        selections = selections.filter(s => this.param.constrain(controllingValue, s.value));
      else
        selections = [];
    }
    this.editor.clear();
    if (this.nullable)
      this.editor.addItem('');
    for (const selection of selections)
      this.editor.addItem(selection.name);
    if (typeof this.param.selected == 'string')
      this.#setSelected(this.param.selected);
    else if (this.param.value)
      this.setValue(this.param.value);
    if (this.description)
      this.#updateDescription();
  }

  subscribeOnChange(callback: () => void) {
    this.connectYueSignal(this.editor.onSelectionChange, callback);
  }

  getValue() {
    const name = this.editor.getSelectedItem();
    return this.selections.find(s => s.name == name)?.value;
  }

  setValue(value) {
    if (this.nullable && !value) {
      this.editor.selectItemAt(0);
      return;
    }
    const selected = this.selections.find(s => s.value == value)?.name;
    if (selected)
      this.#setSelected(selected);
  }

  #setSelected(name: string) {
    const index = this.editor.getItems().indexOf(name);
    if (index == -1)
      return;
    this.editor.selectItemAt(index);
    this.affects.forEach(p => p.update());
  }

  #updateDescription() {
    const value = this.getValue();
    if (value) {
      const text = value['description'] ?? '';
      this.description.setText(text);
    }
  }
}

export class EntryParamRow extends ParamRow<gui.Entry> {
  constructor(param: Param, nullable: boolean) {
    super(param, gui.Entry.create(), nullable);
    if (param.value != null)
      this.setValue(param.value);
  }

  subscribeOnChange(callback: () => void) {
    this.connectYueSignal(this.editor.onTextChange, callback);
  }

  getValue() {
    const value = this.editor.getText().trim();
    if (this.param.type == 'string')
      return value;
    if (this.param.type == 'number') {
      const n = parseFloat(value);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  }

  setValue(value: string | number) {
    if (this.nullable && !value) {
      this.editor.setText('');
      return;
    }
    if (typeof value != this.param.type)
      throw new Error(`Type of param "${this.param.name}" is ${this.param.type} but got ${typeof value}.`);
    if (typeof value == 'string')
      this.editor.setText(value ?? '');
    else if (typeof value == 'number')
      this.editor.setText(String(value));
  }
}

export class ComboBoxParamRow extends ParamRow<gui.ComboBox> {
  constructor(param: Param, nullable: boolean) {
    super(param, gui.ComboBox.create(), nullable);
    if (param.value && typeof param.value == 'string')
      this.setValue(param.value);
    if (param.preset)
      param.preset.forEach(p => this.editor.addItem(p));
  }

  subscribeOnChange(callback: () => void) {
    this.connectYueSignal(this.editor.onTextChange, callback);
  }

  getValue() {
    return this.editor.getText().trim();
  }

  setValue(value: string) {
    this.editor.setText(value ?? '');
  }
}

export class MultiCheckboxParamRow extends ParamRow<gui.Container> {
  selections: Selection[];
  button?: gui.Button;
  checkboxes?: gui.Button[];

  constructor(param: Param) {
    super(param, gui.Container.create());
    this.selections = param.selections instanceof Function ? param.selections() : param.selections;
    this.editor.setStyle({flexDirection: 'row', flexWrap: 'warp', gap: 5});
    if (this.selections.length > 0) {
      // Show a list of checkboxes.
      this.checkboxes = [];
      for (const selection of this.selections) {
        const button = gui.Button.create({
          title: selection.name,
          type: 'checkbox',
        });
        button.onClick = () => this.onChange?.emit();
        this.checkboxes.push(button);
        this.editor.addChildView(button);
      }
    } else {
      // Show a button for action.
      this.button = gui.Button.create(`Add ${param.displayName}...`);
      this.button.onClick = param.callback;
      this.editor.addChildView(this.button);
    }
  }

  getValue() {
    if (!this.checkboxes)
      return null;
    const result = [];
    for (let i = 0; i < this.selections.length; ++i) {
      if (this.checkboxes[i].isChecked())
        result.push(this.selections[i].value);
    }
    return result.length == 0 ? null : result;
  }

  setValue(value?: string[]) {
    if (!this.checkboxes || !value)
      return;
    for (let i = 0; i < this.selections.length; ++i) {
      const checked = value.includes(this.selections[i].value);
      this.checkboxes[i].setChecked(checked);
    }
  }
}

export class CheckboxParamRow extends ParamRow<gui.Button> {
  constructor(param: Param, nullable: boolean) {
    super(param, gui.Button.create({type: 'checkbox', title: param.title}), nullable);
    this.setValue(param.value);
  }

  subscribeOnChange(callback: () => void) {
    this.connectYueSignal(this.editor.onClick, callback);
  }

  getValue() {
    return this.editor.isChecked();
  }

  setValue(value: boolean) {
    this.editor.setChecked(Boolean(value));
  }
}


export class IconParamRow extends ParamRow<gui.Container> {
  imageView: ToggleButton;
  revertButton: gui.Button;
  icon?: Icon;

  constructor(param: Param, nullable: boolean) {
    super(param, gui.Container.create(), nullable);
    this.editor.setStyle({flexDirection: 'row', gap: basicStyle.padding / 2});
    this.imageView = new ToggleButton();
    this.imageView.setSelected(true);
    this.imageView.view.setStyle({
      width: style.buttonSize,
      height: style.buttonSize,
    });
    this.editor.addChildView(this.imageView.view);

    // Button to choose an icon from the disk.
    const editButton = gui.Button.create('Choose from disk...');
    editButton.onClick = () => this.#chooseIconFromDisk();
    this.editor.addChildView(editButton);

    // Button to revert the icon to the default one in param.
    this.revertButton = gui.Button.create('Use default icon');
    this.revertButton.onClick = () => {
      this.setValue(param.value);
      this.onChange?.emit();
    };
    this.revertButton.setVisible(false);
    this.editor.addChildView(this.revertButton);

    if (param.value)
      this.setValue(param.value);
  }

  getValue() {
    return this.icon;
  }

  setValue(value: Icon | null) {
    this.icon = value;
    this.revertButton.setVisible(this.hasCustomIcon());
    this.imageView.setImage(value?.getImage());
  }

  hasCustomIcon() {
    return this.icon && !this.icon.filePath.startsWith(Icon.builtinIconsPath);
  }

  #chooseIconFromDisk() {
    const dialog = gui.FileOpenDialog.create();
    dialog.setTitle('Choose icon');
    if (!dialog.runForWindow(this.editor.getWindow()))
      return;
    this.setValue(new Icon({filePath: dialog.getResult()}));
    this.onChange?.emit();
  }
}

export class ParagraphParamRow extends ParamRow<gui.Container> {
  paragraph: gui.Label;
  editButton: gui.Button;
  text?: string;

  constructor(param: Param, nullable: boolean) {
    super(param, gui.Container.create(), nullable);
    // Edit button on the first line.
    this.editButton = gui.Button.create(`Add ${param.displayName}...`);
    this.editButton.onClick = async () => {
      const options = {width: 400, height: 300, multiLines: true};
      const result = await prompt(`Edit ${this.param.displayName}`, this.getValue() ?? '', options);
      if (result === null)  // cancelled
        return;
      this.setValue(result);
      this.onChange?.emit();
    };
    this.editButton.setStyle({alignSelf: 'flex-start'});
    this.editor.addChildView(this.editButton);
    // The paragraph will be added on second line.
    this.paragraph = gui.Label.create('');
    this.paragraph.setStyle({
      marginTop: -4,
      marginLeft: valueMarginLeft + 2,
    });
    this.paragraph.setAlign('start');
    this.paragraph.setVisible(false);
    if (param.value)
      this.setValue(param.value);
  }

  addToView(container: gui.Container) {
    super.addToView(container);
    container.addChildView(this.paragraph);
  }

  getValue() {
    return this.text;
  }

  setValue(value: string) {
    if (value) {
      this.text = value;
      this.paragraph.setText(value.length > 100 ? value.substring(0, 100) + '...' : value);
      this.paragraph.setVisible(true);
      this.editButton.setTitle(`Edit ${this.param.displayName}...`);
    } else {
      this.text = null;
      this.paragraph.setText('');
      this.paragraph.setVisible(false);
      this.editButton.setTitle(`Add ${this.param.displayName}...`);
    }
  }
}

export class ShortcutParamRow extends ParamRow<gui.Container> {
  shortcutEditor: ShortcutEditor;

  constructor(param: Param, nullable: boolean) {
    const shortcutEditor = new ShortcutEditor();
    super(param, shortcutEditor.view, nullable);
    this.shortcutEditor = shortcutEditor;
    this.setValue(param.value);
  }

  subscribeOnChange(callback: () => void) {
    this.shortcutEditor.onChange = callback;
  }

  getValue() {
    return this.shortcutEditor.accelerator;
  }

  setValue(value: string) {
    this.shortcutEditor.setAccelerator(value);
  }
}


export default class ParamsView {
  view = gui.Container.create();
  rows: Record<string, ParamRow> = {};

  onActivate: Signal<() => void> = new Signal;

  constructor(params: Param[], nullable = false) {
    this.view.setStyle({gap: basicStyle.padding / 2});
    for (const param of params) {
      let row: ParamRow;
      let constrainedBy: ParamRow;
      if (param.constrainedBy)
        constrainedBy = this.rows[param.constrainedBy];
      if (param.type == 'string' || param.type == 'number') {
        if (param.preset) {
          row = new ComboBoxParamRow(param, nullable);
        } else {
          row = new EntryParamRow(param, nullable);
          (row as EntryParamRow).editor.onActivate = () => this.onActivate.emit();
        }
      } else if (param.type == 'selection') {
        row = new PickerParamRow(param, constrainedBy, nullable);
      } else if (param.type == 'multi-selection') {
        row = new MultiCheckboxParamRow(param);
      } else if (param.type == 'boolean') {
        row = new CheckboxParamRow(param, nullable);
      } else if (param.type == 'image') {
        row = new IconParamRow(param, nullable);
      } else if (param.type == 'paragraph') {
        row = new ParagraphParamRow(param, nullable);
      } else if (param.type == 'shortcut') {
        row = new ShortcutParamRow(param, nullable);
        (row as ShortcutParamRow).shortcutEditor.onActivate = () => this.onActivate.emit();
      }
      row.nullable = nullable;
      row.addToView(this.view);
      this.rows[param.name] = row;
    }
  }

  destructor() {
    for (const name in this.rows)
      this.rows[name].destructor();
  }

  fillParams(params: object) {
    for (const name in params)
      this.getRow(name)?.setValue(params[name]);
  }

  clearParams() {
    for (const name in this.rows)
      this.getRow(name).setValue('');
  }

  readParams(): object {
    if (!this.rows)
      return null;
    const params: object = {};
    for (const name in this.rows) {
      const value = this.getValue(name);
      if (value)
        params[name] = value;
    }
    return params;
  }

  getRow(name: string) {
    return this.rows[name];
  }

  getValue(name: string) {
    return this.getRow(name)?.getValue();
  }

  requestAttention(name: string) {
    return this.getRow(name)?.editor.focus();
  }
}
