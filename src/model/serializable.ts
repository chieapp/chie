// Unfortunately TypeScript does not support static methods in interface, so
// we are leaving out deserialize here but it is assumed to be implemented by
// subclasses.
//
// Check this question if we want to add type check for deserialize:
// https://stackoverflow.com/questions/65846848/typescript-static-methods-in-interfaces
export default interface Serializable {
  serialize(): object;
}
