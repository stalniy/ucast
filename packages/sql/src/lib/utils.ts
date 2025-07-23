export function splitRelationName(input: string) : [string, string] {
  const separatorIndex = input.indexOf('.');

  if (separatorIndex === -1) {
    return [input, ''];
  }

  return [
    input.slice(0, separatorIndex),
    input.slice(separatorIndex + 1),
  ];
}

export const hasOwn = Object.hasOwn ||
  Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
