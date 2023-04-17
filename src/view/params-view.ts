import gui from 'gui';

import Param from '../model/param';

export default class ParamsView {
  view = gui.Container.create();
  params: Record<string, Param> = {};

  #views: Record<string, gui.View> = {};

  constructor(params: Param[]) {
    for (const param of params) {
      this.params[param.id] = param;
      this.view.addChildView(this.#createLabelRow(param));
    }
  }

  getValue(id: string) {
    const param = this.params[id];
    if (param.type == 'string' || param.type == 'number') {
      return (this.#views[id] as gui.Entry).getText();
    } else if (param.type == 'selection') {
      const name = (this.#views[id] as gui.Picker).getSelectedItem();
      return param.selections.find(s => s.name == name).value;
    } else {
      throw new Error(`Invalid param type: ${param.type}.`);
    }
  }

  requestAttention(id: string) {
    this.#views[id].focus();
  }

  #createLabelRow(param: Param) {
    const row = gui.Container.create();
    row.setStyle({flexDirection: 'row', marginBottom: 4});
    const label = gui.Label.create(param.name);
    label.setStyle({width: 60});
    label.setAlign('start');
    row.addChildView(label);
    row.addChildView(this.#createViewForParam(param));
    return row;
  }

  #createViewForParam(param: Param) {
    // Create view by param type.
    let view: gui.View;
    if (param.type == 'selection') {
      const picker = gui.Picker.create();
      this.#updatePickerItems(picker, param);
      // Listen to controlling param's change and update.
      if (param.constrainedBy) {
        this.#subscribeOnChange(param.constrainedBy, () => {
          this.#updatePickerItems(picker, param);
          // Iterate all params constrained by this.
          for (const p of Object.values(this.params)) {
            if (p.constrainedBy == param.id)
              this.#updatePickerItems(this.#views[p.id] as gui.Picker, p);
          }
        });
      }
      view = picker;
    } else {
      view = gui.Entry.create();
      if (param.constrainedBy)
        throw new Error('Can not constrain the value of non-selection pram.');
    }
    // Save it.
    this.#views[param.id] = view;
    view.setStyle({flex: 1});
    return view;
  }

  // Update the values in a picker according to its constrains.
  #updatePickerItems(picker: gui.Picker, param: Param) {
    let selections = param.selections;
    if (param.constrainedBy) {
      selections = selections.filter(s => {
        const controllingValue = this.getValue(param.constrainedBy);
        return param.constrain(controllingValue, s.value);
      });
    }
    picker.clear();
    for (const selection of selections)
      picker.addItem(selection.name);
  }

  // Subscribe to changes happened in the view of param with |id|.
  #subscribeOnChange(id: string, callback: () => void) {
    const param = this.params[id];
    if (!param)
      throw new Error(`Can not find param with id "${id}".`);
    if (param.type == 'string' || param.type == 'number')
      (this.#views[id] as gui.Entry).onTextChange = callback;
    else if (param.type == 'selection')
      (this.#views[id] as gui.Picker).onSelectionChange = callback;
    else
      throw new Error(`Invalid param type: ${param.type}.`);
  }
}
