import { languageName, type Task } from "../shared";

// Source clamped to 2 lines; "Full text" opens all of it.
export const SourceFold = ({ task }: { task: Task }) => (
	<details className="src-fold">
		<summary>
			<span className="field__label">
				{languageName(task.sourceLang)} · source
			</span>
			<span className="src-fold__more">Full text</span>
			<span className="text-src clamp-2" lang={task.sourceLang} dir="auto">
				{task.text}
			</span>
		</summary>
		<p className="text-src" lang={task.sourceLang} dir="auto">
			{task.text}
		</p>
	</details>
);
