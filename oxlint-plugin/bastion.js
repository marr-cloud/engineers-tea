const noEmptyRecipeRemove = {
    meta: {
        type: "problem",
        docs: { description: "Disallow event.remove({}), which removes every recipe." },
    },
    create(context) {
        return {
            CallExpression(node) {
                const { callee, arguments: args } = node;
                if (callee.type !== "MemberExpression" || callee.computed) return;
                if (callee.property.name !== "remove") return;
                if (args.length !== 1) return;
                const [arg] = args;
                if (arg.type === "ObjectExpression" && arg.properties.length === 0) {
                    context.report({
                        node,
                        message:
                            "event.remove({}) removes every recipe in the game. Pass a filter like { output: 'mod:item' }.",
                    });
                }
            },
        };
    },
};

export default {
    meta: { name: "bastion" },
    rules: { "no-empty-recipe-remove": noEmptyRecipeRemove },
};
