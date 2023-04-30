import gui from 'gui';
import {Signal} from 'typed-signals';

import Param from '../model/param';
import basicStyle from './basic-style';

const labelWidth = 60;
const labelPadding = 8;

export const valueMarginLeft = labelWidth + labelPadding;

abstract class ParamRow<T extends gui.View = gui.View> {
  param: Param;
  view: T;

  row = gui.Container.create();
  affects: ParamRow[] = [];

  constructor(param: Param, view: T) {
    this.param = param;
    this.view = view;
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
  abstract setValue(value: string);
  abstract subscribeOnChange(callback: () => void);
}

class PickerParamRow extends ParamRow<gui.Picker> {
  constrainedBy?: ParamRow;
  description?: gui.Label;

  constructor(param: Param, constrainedBy?: ParamRow) {
    if (!param.selections)
      throw new Error('Property "selections" expected.');
    super(param, gui.Picker.create());

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
    if (param.selections.length > 0 && 'description' in param.selections[0].value) {
      // Note that creating an empty Label will trigger a bug that draws the
      // text always with black color.
      this.description = gui.Label.create('(description)');
      this.description.setAlign('start');
      this.description.setStyle({marginLeft: valueMarginLeft + 2});
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
    for (const selection of selections)
      this.view.addItem(selection.name);
    if (this.param.value)
      this.setValue(this.param.value);
    if (this.description)
      this.#updateDescription();
  }

  getValue() {
    const name = this.view.getSelectedItem();
    return this.param.selections.find(s => s.name == name)?.value;
  }

  setValue(value: string) {
    const index = this.view.getItems().indexOf(value);
    if (index == -1)
      return;
    this.view.selectItemAt(index);
    this.affects.forEach(p => p.update());
  }

  subscribeOnChange(callback: () => void) {
    this.view.onSelectionChange = callback;
  }

  #updateDescription() {
    const text = this.getValue()['description'] ?? '';
    this.description.setText(text);
  }
}

class EntryParamRow extends ParamRow<gui.Entry> {
  constructor(param: Param) {
    super(param, gui.Entry.create());
    if (param.value)
      this.setValue(param.value);
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

class ComboBoxParamRow extends ParamRow<gui.ComboBox> {
  constructor(param: Param) {
    super(param, gui.ComboBox.create());
    if (param.value)
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

export default class ParamsView {
  view = gui.Container.create();
  views: Record<string, ParamRow> = {};

  onActivate: Signal<() => void> = new Signal;

  constructor(params: Param[]) {
    for (const param of params) {
      let view: ParamRow;
      let constrainedBy: ParamRow;
      if (param.constrainedBy)
        constrainedBy = this.views[param.constrainedBy];
      if (param.type == 'string' || param.type == 'number') {
        if (param.preset) {
          view = new ComboBoxParamRow(param);
        } else {
          view = new EntryParamRow(param);
          (view as EntryParamRow).view.onActivate = () => this.onActivate.emit();
        }
      } else if (param.type == 'selection') {
        view = new PickerParamRow(param, constrainedBy);
      }
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
