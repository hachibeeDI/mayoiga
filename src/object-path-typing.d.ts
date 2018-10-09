// ==================
// TODO: send PR?
interface ObjectPath {
  get(state: any, name: string): any;
}
declare module 'object-path' {
  const objectPath: ObjectPath;
  export default objectPath;
}
// ==================
