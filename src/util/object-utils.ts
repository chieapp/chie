// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

export function deepAssign<T extends AnyObject, S extends AnyObject>(target: T, source: S): T {
  if (!source)
    return target;
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

export function isEmptyObject(obj: object) {
  return !obj || Object.keys(obj).length == 0;
}

export function shallowEqual(a: object, b: object) {
  return Object.keys(a).every(k => Object.prototype.hasOwnProperty.call(b, k) && a[k] == b[k]) &&
         Object.keys(b).every(k => Object.prototype.hasOwnProperty.call(a, k));
}
