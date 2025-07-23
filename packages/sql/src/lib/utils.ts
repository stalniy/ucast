export function splitRelationName(input: string) : [string, string | undefined] {
  const separatorIndex = input.indexOf('.');

  if (separatorIndex === -1) {
    return [input, ''];
  }

  return [
    input.substring(0, separatorIndex),
    input.substring(separatorIndex + 1),
  ];
}
