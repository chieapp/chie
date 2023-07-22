import WebAPI from '../model/web-api';

export type ParamType = 'string' | 'selection' | 'multi-selection' | 'number' | 'boolean' | 'image' | 'paragraph' | 'shortcut';

export interface Selection {
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
}

export default interface Param {
  name: string;
  type: ParamType;
  displayName?: string;
  description?: string;

  // This param will own a switcher button in toolbar.
  hasSwitcher?: boolean;

  // This param is only used for authentication.
  authOnly?: boolean;

  // Default value.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;

  // Some preset values that users can choose from.
  choices?: string[];

  // The range of number.
  range?: [number, number];

  // The title of checkbox or button.
  title?: string;

  // Callback when user clicks on the button.
  activate?: () => void;

  // The param has a set of values to select.
  selections?: Selection[] | (() => Selection[]);

  // Name of the default selection.
  selected?: string | string[];

  // The id of param that will constrain whether a selection is usable.
  constrainedBy?: string;
  // Filter function used to determine whether a selection is usable.
  constrain?: (controllingValue, value) => boolean;

  // Used only by service parameter internally.
  requiredAPIClass?: typeof WebAPI;
}
