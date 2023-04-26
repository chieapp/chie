// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

export default function deepAssign<T extends AnyObject, S extends AnyObject>(target: T, source: S): T {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (typeof value == 'object' && value !== null) {
      // eslint-disable-next-line no-prototype-builtins
      if (target.hasOwnProperty(key))
        deepAssign(target[key], value);
      else
        target[key as keyof T] = value;
    } else {
      target[key as keyof T] = value;
    }
  }
  return target;
}
