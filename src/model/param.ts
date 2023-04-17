export type ParamType = 'string' | 'selection' | 'number';

export interface Selection<T = object> {
  name: string,
  value: T,
}

export default class Param {
  id: string;
  name: string;
  type: ParamType;
  range?: [number, number];
  selections?: Selection[];

  // The id of param that will constrain whether a selection is usable.
  constrainedBy?: string;
  // Filter function used to determine whether a selection is usable.
  constrain?: (controllingValue, value) => boolean;

  constructor(init: Partial<Param>) {
    Object.assign(this, init);
  }
}
