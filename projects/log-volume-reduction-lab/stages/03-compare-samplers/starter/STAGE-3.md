`sample(records:&[Record],budget:usize,policy:&str)->Result<Vec<Record>,String>`. Policy is exactly uniform or rarity. Zero budget and empty input return an empty vector; a budget beyond the input returns every record once.

Spend a fixed record budget on common or rare templates.
