function posixRegex(field: string, placeholder: string, ignoreCase: boolean) {
  const operator = ignoreCase ? '~*' : '~';
  return `${field} ${operator} ${placeholder}`;
}

function regexp(field: string, placeholder: string) {
  return `${field} regexp ${placeholder} = 1`;
}

const questionPlaceholder = () => '?';
const $indexPlaceholder = (index: number) => `$${index}`;

export const oracle = {
  regexp: posixRegex,
  paramPlaceholder: $indexPlaceholder,
  escapeField: (field: string) => `"${field}"`,
};
export const pg = oracle;

export const mysql = {
  regexp,
  paramPlaceholder: questionPlaceholder,
  escapeField: (field: string) => `\`${field}\``,
};
export const sqlite = mysql;

export const mssql = {
  regexp() {
    throw new Error('"regexp" operator is not supported in MSSQL');
  },
  paramPlaceholder: questionPlaceholder,
  escapeField: (field: string) => `[${field}]`,
};
