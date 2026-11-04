function basename(filename) {
  return filename.split(/[\\/]/).pop() ?? filename;
}

const singleDashFilename = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Allow at most one dash in a filename.',
    },
    schema: [],
    messages: {
      multiDash: 'Filename "{{name}}" has {{count}} dashes; at most one is allowed.',
    },
  },
  create(context) {
    let filename = '';
    if (typeof context.filename === 'string') {
      filename = context.filename;
    } else if (typeof context.getFilename === 'function') {
      filename = context.getFilename();
    }

    return {
      Program(node) {
        if (!filename || filename === '<input>' || filename === '<text>') return;
        const name = basename(filename);
        const count = (name.match(/-/g) ?? []).length;
        if (count > 1) {
          context.report({
            node,
            messageId: 'multiDash',
            data: { name, count: String(count) },
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'filename' },
  rules: { 'single-dash': singleDashFilename },
};
