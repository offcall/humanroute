export enum AvatarTone {
	Plain = "",
	Indigo = "avatar--indigo",
	Green = "avatar--green",
	Red = "avatar--red",
}

type Props = {
	name: string | null;
	tone?: AvatarTone | undefined;
	small?: boolean;
};

// First letters of the first two words: "Nairobi Lingua" → "NL"
export const initials = (name: string): string =>
	name
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.slice(0, 2)
		.map((word) => word.charAt(0).toUpperCase())
		.join("");

// Decorative: the name is always shown as text next to it. No name: dashed "?".
export const Avatar = ({
	name,
	tone = AvatarTone.Plain,
	small = false,
}: Props) => {
	const classes = ["avatar", tone, small ? "avatar--sm" : ""];
	if (name === null) {
		classes.push("avatar--none", "avatar--dashed");
	}

	return (
		<span className={classes.filter(Boolean).join(" ")} aria-hidden="true">
			{name === null ? "?" : initials(name)}
		</span>
	);
};
