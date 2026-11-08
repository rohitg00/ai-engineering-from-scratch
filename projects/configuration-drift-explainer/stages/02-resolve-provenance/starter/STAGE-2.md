`Resolve(layers []Layer) map[string]Effective`, where `Effective{Value any, History []Source}` and `Source{Layer string, Value any}`. Empty layers produce an empty map.

Keep every shadowed setting while choosing the last declared value.
