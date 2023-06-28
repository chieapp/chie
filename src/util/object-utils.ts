// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

// Like Object.assign but does a deep copy.
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

// Like Object.assign but ignore null or undefined properties.
export function nonNullAssign<T extends object, S extends object>(target: T, source: S): T {
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] != null)
      target[key as unknown as keyof T] = source[key] as unknown as T[keyof T];
  }
  return target;
}

// Return true if |obj| is not an object or it has no properties.
export function isEmptyObject(obj: object) {
  return !obj || Object.keys(obj).length == 0;
}

// Do a shadow compare of |a| and |b|'s properties.
export function shallowEqual(a: object, b: object) {
  return Object.keys(a).every(k => Object.prototype.hasOwnProperty.call(b, k) && a[k] == b[k]) &&
         Object.keys(b).every(k => Object.prototype.hasOwnProperty.call(a, k));
}

// Return if |parent| equals |child| or |parent| is a parent of |child|.
export function matchClass(parent: object, child: object) {
  return parent == child || Object.prototype.isPrototypeOf.call(parent, child);
}
