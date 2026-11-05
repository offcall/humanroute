// Word count of a source text (data-gaps #1)
export const wordCount = (text: string): number =>
	text.split(/\s+/).filter((word) => word.length > 0).length;

export const wordsLabel = (text: string): string => {
	const count = wordCount(text);

	return count === 1 ? "1 word" : `${count} words`;
};
