export type ParamType = 'string' | 'selection' | 'number';

export interface Selection {
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
}

export default class Param {
  name: string;
  type: ParamType;
  readableName?: string;

  // This param will own a switcher button in toolbar.
  hasSwitcher?: boolean;

  // This param is only used for authentication.
  authOnly?: boolean;

  // Default value.
  value?: string | number;

  // Some preset values that users can choose from.
  preset?: string[];

  // The range of number.
  range?: [number, number];

  // The param has a set of values to select.
  selections?: Selection[];

  // Name of the default selection.
  selection?: string;

  // The id of param that will constrain whether a selection is usable.
  constrainedBy?: string;
  // Filter function used to determine whether a selection is usable.
  constrain?: (controllingValue, value) => boolean;

  constructor(init: Partial<Param>) {
    if (!init.name || !init.type)
      throw new Error('The "name" and "type" are required in Param.');
    Object.assign(this, init);
  }
}
