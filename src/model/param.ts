export type ParamType = 'string' | 'selection' | 'number';

export interface Selection<T = object> {
  name: string,
  value: T,
}

export default class Param {
  name: string;
  type: ParamType;

  readableName?: string;

  // Default value.
  value?: string;

  // Some preset values that users can choose from.
  preset?: string[];

  // The range of number.
  range?: [number, number];

  // The param has a set of values to select.
  selections?: Selection[];

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
