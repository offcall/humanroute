import "./art.css";
import "./art-ticket.css";
import { Icon, IconName, Stamp, StampKind } from "../shared";

// Static, labelled example (owner, 2026-11-05): no API data, nothing clickable, frozen timer.
const SOURCE =
	"Ibuprofen 200 mg film-coated tablets. Take one tablet every 6 to 8 hours with a glass of water. Do not take more than 3 tablets in 24 hours.";

const Port = ({ code, name }: { code: string; name: string }) => (
	<span className="land-tk__port">
		<b>{code}</b>
		<span>{name}</span>
	</span>
);

const Field = ({ label, value }: { label: string; value: string }) => (
	<div>
		<span>{label}</span>
		<b>{value}</b>
	</div>
);

const Ticket = () => (
	<div className="land-tk">
		<div className="land-tk__body">
			<div className="land-tk__route">
				<Port code="EN" name="English" />
				<span className="land-tk__arrow">
					<Icon name={IconName.Arrow} size={24} />
				</span>
				<Port code="ES" name="Spanish" />
				<span className="land-tk__fare">
					<span>Pay</span>
					<b>0.50</b>
					<span>USDC</span>
				</span>
			</div>
			<div className="land-tk__fields">
				<Field label="Client" value="MedSafe-Rx" />
				<Field label="Agency" value="Nairobi Lingua" />
				<Field label="Words" value="43" />
			</div>
			<p className="land-tk__src" lang="en">
				{SOURCE}
			</p>
		</div>
		<div className="land-tk__perf" />
		<div className="land-tk__stub">
			<div className="land-tk__times">
				<Field label="Closes in" value="0:57" />
				<Field label="Due" value="10:13:03" />
			</div>
			<div className="land-tk__drain">
				<i />
			</div>
			<span className="btn btn--white btn--block">
				Claim ticket · 0.50 USDC
			</span>
		</div>
	</div>
);

export const LandingArt = () => (
	<figure className="land-art">
		<div className="land-art__stack" aria-hidden="true">
			<Ticket />
			<div className="land-art__link">
				<span className="tag tag--paid">
					<Icon name={IconName.Check} size={14} />
					Approved
				</span>
				<span className="land-art__line" />
				<span className="land-art__tx">tx 2Vx4…9Lm</span>
			</div>
			<div className="land-art__done">
				<span>
					<b>EN → DE</b>
					<span>MedSafe-Rx → Baltic Words · 10:13</span>
				</span>
				<Stamp kind={StampKind.Paid} note="+0.50 USDC" still />
			</div>
		</div>
		<figcaption className="land-art__cap">
			Example: the MedSafe-Rx leaflet in three languages. 1.50 USDC is held
			until each translation is approved, then paid to the linguist, the agency
			and the fee.
		</figcaption>
	</figure>
);
