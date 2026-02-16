"use client";

export default function VoteBar({ pro = 0, con = 0, draw = 0 }) {
  const total = pro + con + draw || 1;
  const proP = Math.round((pro / total) * 100);
  const conP = Math.round((con / total) * 100);
  const drawP = 100 - proP - conP;

  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden bg-arena-border">
        {proP > 0 && (
          <div className="bg-arena-pro transition-all" style={{ width: `${proP}%` }} />
        )}
        {drawP > 0 && (
          <div className="bg-arena-muted/40 transition-all" style={{ width: `${drawP}%` }} />
        )}
        {conP > 0 && (
          <div className="bg-arena-con transition-all" style={{ width: `${conP}%` }} />
        )}
      </div>
      <div className="flex justify-between text-xs text-arena-muted mt-1">
        <span className="text-arena-pro">Pro {proP}%</span>
        <span>Draw {drawP}%</span>
        <span className="text-arena-con">Con {conP}%</span>
      </div>
    </div>
  );
}
