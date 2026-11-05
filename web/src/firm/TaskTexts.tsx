import { useState } from "react";
import { Icon, IconName, languageName, type Task, wordsLabel } from "../shared";
import { TextCols } from "./ReviewTexts";

// Before delivery: the source under a disclosure; after: both texts with a Copy button.
export const TaskTexts = ({ task }: { task: Task }) => {
	const [copy, setCopy] = useState<string | undefined>(undefined);
	const result = task.result;
	if (result === null) {
		return (
			<details className="fb-src">
				<summary>
					What you sent · {languageName(task.sourceLang)} ·{" "}
					{wordsLabel(task.text)}
				</summary>
				<p className="text-src" lang={task.sourceLang} dir="auto">
					{task.text}
				</p>
			</details>
		);
	}
	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(result);
			setCopy("Copied");
		} catch {
			setCopy("Copy failed");
		}
	};

	return (
		<div className="fb-result">
			<div className="row row--between">
				<p className="kicker">The translation</p>
				<button
					type="button"
					className="btn btn--ghost btn--xs"
					onClick={onCopy}
				>
					<Icon name={IconName.Copy} size={15} />
					{copy ?? `Copy ${languageName(task.targetLang)}`}
				</button>
			</div>
			<TextCols task={task} />
		</div>
	);
};
