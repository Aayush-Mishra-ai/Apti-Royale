import { useState } from "react";
import type { QuestionVisual as Visual } from "@/lib/question-visual";
import microscope from "@/assets/quiz-microscope.jpg";

export function QuestionVisual({ visual }: { visual: Visual | null }) {
  const [failed, setFailed] = useState(false);
  if (!visual) return null;
  if (visual.type === "image") {
    return (
      <figure className="mt-4">
        <figcaption className="mb-2 text-sm font-medium text-muted-foreground">{visual.title}</figcaption>
        {failed ? <p role="alert" className="text-destructive">Question image could not load. Please refresh.</p> : (
          <img src={microscope} alt={visual.alt} width={1024} height={768} loading="eager" onError={() => setFailed(true)} className="aspect-[4/3] max-h-64 w-full rounded-lg object-contain" />
        )}
      </figure>
    );
  }
  if (visual.type === "table") {
    return (
      <div className="mt-4 max-w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm tabular-nums">
          <caption className="p-3 text-left font-semibold text-foreground">{visual.title}</caption>
          <thead className="bg-muted text-muted-foreground"><tr>{visual.columns.map((c, i) => <th key={i} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
          <tbody>{visual.rows.map((row, i) => <tr key={i} className="border-t border-border">{row.map((cell, j) => j === 0 ? <th key={j} scope="row" className="px-3 py-2 font-medium text-foreground">{cell}</th> : <td key={j} className="px-3 py-2 text-foreground">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  const max = Math.max(...visual.data.map((d) => d.value), 1);
  const ceiling = Math.ceil(max / 4) * 4;
  const x = (i: number) => 55 + i * (400 / (visual.data.length - 1));
  const y = (value: number) => 185 - (value / ceiling) * 150;
  return (
    <figure className="mt-4">
      <figcaption className="mb-2 text-sm font-semibold text-foreground">{visual.title} <span className="font-normal text-muted-foreground">({visual.unit})</span></figcaption>
      <svg viewBox="0 0 510 225" role="img" aria-label={`${visual.title}: ${visual.data.map((d) => `${d.label} ${d.value}`).join(", ")}. ${visual.unit}.`} className="w-full text-foreground">
        {[0, 1, 2, 3, 4].map((i) => <g key={i}><line x1="40" x2="480" y1={y(i * ceiling / 4)} y2={y(i * ceiling / 4)} className="stroke-border" /><text x="33" y={y(i * ceiling / 4) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">{i * ceiling / 4}</text></g>)}
        {visual.type === "line" && <polyline points={visual.data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ")} fill="none" strokeWidth="3" className="stroke-accent" />}
        {visual.data.map((d, i) => <g key={i}>
          {visual.type === "bar" ? <rect x={x(i) - 14} y={y(d.value)} width="28" height={185 - y(d.value)} rx="3" className="fill-accent" /> : <circle cx={x(i)} cy={y(d.value)} r="5" className="fill-accent" />}
          <text x={x(i)} y={y(d.value) - 10} textAnchor="middle" fontSize="13" className="fill-foreground">{d.value}</text>
          <text x={x(i)} y="208" textAnchor="middle" fontSize="12" className="fill-muted-foreground">{d.label}</text>
        </g>)}
      </svg>
    </figure>
  );
}