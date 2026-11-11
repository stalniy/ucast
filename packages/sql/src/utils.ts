export const hasOwn = Object.hasOwn ?? ((hasOwnProperty) =>
  (object: object, key: PropertyKey) => hasOwnProperty(object, key)
)(Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty));
