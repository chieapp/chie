// Create an unique readable id from |name| different from |existings|.
export function getNextId(name: string, existings: string[]) {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() + '-';
  const ids = existings
    .filter(k => k.startsWith(prefix))  // id is in the form of "name-1"
    .map(n => parseInt(n.substr(prefix.length)))  // get the number part
    .filter(n => Number.isInteger(n))  // valid id must be integer
    .sort((a: number, b: number) => b - a);  // descend
  if (ids.length == 0)
    return prefix + '1';
  const nextId = prefix + String(ids[0] + 1);
  if (existings.includes(nextId))  // should not happen
    throw new Error(`Duplicate ID generated: ${nextId}`);
  return nextId;
}
