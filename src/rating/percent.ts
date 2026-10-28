// Integer percent rounded down (Math.floor); null when there is nothing to count.
const percentOf = (part: number, total: number): number | null => {
	if (total === 0) {
		return null;
	}

	return Math.floor((part * 100) / total);
};

export const ratingPct = (
	approved: number,
	rejected: number,
	late: number,
): number | null => percentOf(approved, approved + rejected + late);

export const rejectPct = (approved: number, rejected: number): number | null =>
	percentOf(rejected, approved + rejected);
