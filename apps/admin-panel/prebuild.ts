import { read } from "@1password/op-js";

read.toFile(
	`op://${process.env.OP_VAULT_ID}/${process.env.OP_ITEM_ID}/notesPlain`,
	`.env`,
);
