// Fixture: must be reported by bastion/no-empty-recipe-remove.
ServerEvents.recipes((event) => {
    event.remove({});
});
