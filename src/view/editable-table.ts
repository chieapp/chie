import gui from 'gui';
import {Signal} from 'typed-signals';

import ButtonsArea from '../view/buttons-area';
import alert from '../util/alert';

interface ColumnDescriptor {
  title: string;
  key: string;
}

export default class EditableTable<T extends object> {
  onEditRow: Signal<(index: number, row: T) => void> = new Signal;
  onRemoveRow: Signal<(index: number, row: T) => void> = new Signal;

  data: T[];

  view: gui.Container = gui.Container.create();
  table: gui.Table = gui.Table.create();

  buttonsArea: ButtonsArea;
  editButton: gui.Button;
  removeButton: gui.Button;

  constructor(public columns: ColumnDescriptor[]) {
    for (const column of columns)
      this.table.addColumn(column.title);
    this.table.setHasBorder(true);
    this.table.setStyle({flex: 1});
    this.table.onRowActivate = this.#editSelectedRow.bind(this);
    this.table.onSelectionChange = () => {
      const hasSelection = this.table.getSelectedRow() != -1;
      this.editButton.setEnabled(hasSelection);
      this.removeButton.setEnabled(hasSelection);
    };
    this.view.addChildView(this.table);

    this.buttonsArea = new ButtonsArea({hideSeparator: true});
    this.removeButton = this.buttonsArea.addButton('Remove');
    this.removeButton.setEnabled(false);
    this.removeButton.onClick = this.#removeSelectedRow.bind(this);
    this.editButton = this.buttonsArea.addButton('Edit');
    this.editButton.setEnabled(false);
    this.editButton.onClick = this.#editSelectedRow.bind(this);
    this.view.addChildView(this.buttonsArea.view);
  }

  setData(data: T[]) {
    this.data = data;
    // Recreate the model to fill data.
    const model = gui.SimpleTableModel.create(this.columns.length);
    const rows = data.map(d => this.columns.map(column => d[column.key]));
    for (const row of rows)
      model.addRow(row);
    this.table.setModel(model);
    // After changing model, all items are unselected.
    this.editButton.setEnabled(false);
    this.removeButton.setEnabled(false);
  }

  #editSelectedRow() {
    const index = this.table.getSelectedRow();
    if (index == -1)
      return;
    this.onEditRow.emit(index, this.data[index]);
  }

  #removeSelectedRow() {
    const index = this.table.getSelectedRow();
    if (index == -1)
      return;
    try {
      this.onRemoveRow.emit(index, this.data[index]);
    } catch (error) {
      alert(error.message);
    }
  }
}
