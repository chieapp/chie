import gui from 'gui';
import {Signal} from 'typed-signals';

import Icon from '../model/icon';
import Param from '../model/param';
import ToggleButton from './toggle-button';
import basicStyle from './basic-style';
import {style} from './dashboard-window';

export const labelWidth = 100;
export const labelPadding = 8;
export const valueMarginLeft = labelWidth + labelPadding;

abstract class ParamRow<T extends gui.View = gui.View> {
  param: Param;
  view: T;
  nullable: boolean;

  row = gui.Container.create();
  affects: ParamRow[] = [];

  constructor(param: Param, view: T, nullable: boolean) {
    this.param = param;
    this.view = view;
    this.nullable = nullable;
    this.row.setStyle({flexDirection: 'row', marginBottom: basicStyle.padding / 2});
    const label = gui.Label.create(`${param.readableName ?? param.name}:`);
    label.setStyle({width: labelWidth, marginRight: labelPadding});
    label.setAlign('end');
    this.row.addChildView(label);
    view.setStyle({flex: 1});
    this.row.addChildView(view);
  }

  addToView(container: gui.Container) {
    container.addChildView(this.row);
  }

  update() {
    // Nothing to update by default.
  }

  abstract getValue();
  abstract setValue(value);
  abstract subscribeOnChange(callback: () => void);
}

class PickerParamRow extends ParamRow<gui.Picker> {
  constrainedBy?: ParamRow;
  description?: gui.Label;

  constructor(param: Param, constrainedBy?: ParamRow, nullable = false) {
    if (!param.selections)
      throw new Error('Property "selections" expected.');
    super(param, gui.Picker.create(), nullable);

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
    if (param.selections.length > 0 &&
        typeof param.selections[0].value == 'object' &&
        'description' in param.selections[0].value) {
      // Note that creating an empty Label will trigger a bug that draws the
      // text always with black color.
      this.description = gui.Label.create('(description)');
      this.description.setAlign('start');
      this.description.setStyle({
        marginLeft: valueMarginLeft + 2,
        marginBottom: basicStyle.padding / 2,
      });
      this.subscribeOnChange(() => this.#updateDescription());
    }
    // Fill the picker with selections.
    this.update();
  }

  addToView(container: gui.Container) {
    super.addToView(container);
    if (this.description)
      container.addChildView(this.description);
  }

  update() {
    let selections = this.param.selections;
    if (this.param.constrain && this.constrainedBy) {
      const controllingValue = this.constrainedBy.getValue();
      selections = selections.filter(s => this.param.constrain(controllingValue, s.value));
    }
    this.view.clear();
    if (this.nullable)
      this.view.addItem('');
    for (const selection of selections)
      this.view.addItem(selection.name);
    if (this.param.selection)
      this.#setSelection(this.param.selection);
    else if (this.param.value)
      this.setValue(this.param.value);
    if (this.description)
      this.#updateDescription();
  }

  getValue() {
    const name = this.view.getSelectedItem();
    return this.param.selections.find(s => s.name == name)?.value;
  }

  setValue(value) {
    if (this.nullable && !value) {
      this.view.selectItemAt(0);
      return;
    }
    const selection = this.param.selections.find(s => s.value == value)?.name;
    if (selection)
      this.#setSelection(selection);
  }

  subscribeOnChange(callback: () => void) {
    this.view.onSelectionChange = callback;
  }

  #setSelection(name: string) {
    const index = this.view.getItems().indexOf(name);
    if (index == -1)
      return;
    this.view.selectItemAt(index);
    this.affects.forEach(p => p.update());
  }

  #updateDescription() {
    const text = this.getValue()['description'] ?? '';
    this.description.setText(text);
  }
}

class EntryParamRow extends ParamRow<gui.Entry> {
  constructor(param: Param, nullable: boolean) {
    super(param, gui.Entry.create(), nullable);
    if (param.value)
      this.setValue(param.value);
  }

  getValue() {
    const value = this.view.getText().trim();
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
      this.view.setText('');
      return;
    }
    if (typeof value != this.param.type)
      throw new Error(`Type of param "${this.param.name}" is ${this.param.type} but got ${typeof value}.`);
    if (typeof value == 'string')
      this.view.setText(value ?? '');
    else if (typeof value == 'number')
      this.view.setText(String(value));
  }

  subscribeOnChange(callback: () => void) {
    this.view.onTextChange = callback;
  }
}

class ComboBoxParamRow extends ParamRow<gui.ComboBox> {
  constructor(param: Param, nullable: boolean) {
    super(param, gui.ComboBox.create(), nullable);
    if (param.value && typeof param.value == 'string')
      this.setValue(param.value);
    if (param.preset)
      param.preset.forEach(p => this.view.addItem(p));
  }

  getValue() {
    return this.view.getText().trim();
  }

  setValue(value: string) {
    this.view.setText(value ?? '');
  }

  subscribeOnChange(callback: () => void) {
    this.view.onTextChange = callback;
  }
}

class IconParamRow extends ParamRow<gui.Container> {
  button: ToggleButton;
  icon?: Icon;
  callback?: () => void;

  constructor(param: Param, nullable: boolean) {
    super(param, gui.Container.create(), nullable);
    this.view.setStyle({flexDirection: 'row'});
    this.button = new ToggleButton();
    this.button.setSelected(true);
    this.button.view.setStyle({
      width: style.buttonSize,
      height: style.buttonSize,
    });
    this.view.addChildView(this.button.view);

    // Button to revert the icon to the default one in param.
    const revertButton = gui.Button.create('Use default icon');
    revertButton.onClick = () => {
      this.setValue(param.value);
      if (this.callback)
        this.callback();
    };
    revertButton.setStyle({marginLeft: basicStyle.padding / 2});
    this.view.addChildView(revertButton);

    // Button to choose an icon from the disk.
    const editButton = gui.Button.create('Choose from disk...');
    editButton.onClick = () => this.#chooseIconFromDisk();
    editButton.setStyle({marginLeft: basicStyle.padding / 2});
    this.view.addChildView(editButton);

    if (param.value)
      this.setValue(param.value);
  }

  getValue() {
    return this.icon;
  }

  setValue(value: Icon) {
    this.icon = value;
    this.button.setImage(value?.getImage());
  }

  subscribeOnChange(callback: () => void) {
    this.callback = callback;
  }

  #chooseIconFromDisk() {
    const dialog = gui.FileOpenDialog.create();
    dialog.setTitle('Choose icon');
    if (!dialog.runForWindow(this.view.getWindow()))
      return;
    this.setValue(new Icon({filePath: dialog.getResult()}));
    if (this.callback)
      this.callback();
  }
}

export default class ParamsView {
  view = gui.Container.create();
  views: Record<string, ParamRow> = {};

  onActivate: Signal<() => void> = new Signal;

  constructor(params: Param[], nullable = false) {
    for (const param of params) {
      let view: ParamRow;
      let constrainedBy: ParamRow;
      if (param.constrainedBy)
        constrainedBy = this.views[param.constrainedBy];
      if (param.type == 'string' || param.type == 'number') {
        if (param.preset) {
          view = new ComboBoxParamRow(param, nullable);
        } else {
          view = new EntryParamRow(param, nullable);
          (view as EntryParamRow).view.onActivate = () => this.onActivate.emit();
        }
      } else if (param.type == 'selection') {
        view = new PickerParamRow(param, constrainedBy, nullable);
      } else if (param.type == 'image') {
        view = new IconParamRow(param, nullable);
      }
      view.nullable = nullable;
      view.addToView(this.view);
      this.views[param.name] = view;
    }
  }

  getView(name: string) {
    return this.views[name];
  }

  getValue(name: string) {
    return this.getView(name)?.getValue();
  }

  requestAttention(name: string) {
    return this.getView(name)?.view.focus();
  }
}
